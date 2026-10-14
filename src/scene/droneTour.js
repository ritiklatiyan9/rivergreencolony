const mix = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const centre = polygon => polygon.reduce((p, q) => [p[0] + q[0] / polygon.length, p[1] + q[1] / polygon.length], [0, 0]);
const nearestBearing = (value, previous) => previous + ((value - previous + 180) % 360 + 360) % 360 - 180;

// Fit a ground-plane disc at every bearing, accounting for perspective on
// the near edge. Unlike rotating a geographic bounding box, this fits the
// actual colony radius without including a second box of empty surroundings.
export function droneOrbitDistance({ radius, aspect, fov, pitch = 50, fill = .82 }) {
  const tan = Math.tan(fov * Math.PI / 360), angle = pitch * Math.PI / 180;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  return radius * Math.max(sin + cos / (tan * fill), Math.hypot(sin, 1 / (tan * aspect * fill))) * 1.04;
}

// Road targets come from the rendered plan, including its expanded frontage.
// Straight flight legs meet at the boulevard, rather than cutting across plots.
export function droneTourLandmarks(plan) {
  const boulevard = plan.roads.find(road => road.kind === 'boulevard').polygon;
  const x = (Math.min(...boulevard.map(p => p[0])) + Math.max(...boulevard.map(p => p[0]))) / 2;
  const minY = Math.min(...boulevard.map(p => p[1])), maxY = Math.max(...boulevard.map(p => p[1]));
  const fountain = plan.roundabout.center;
  const street = side => plan.roads.filter(road => road.kind === 'crossroad')
    .map(road => ({ road, point: centre(road.polygon) }))
    .filter(value => side === 'west' ? value.point[0] < x && value.point[1] > fountain[1] : value.point[0] > x && value.point[1] < fountain[1])
    .sort((a, b) => Math.abs(a.point[1] - fountain[1] - (side === 'west' ? 200 : -200)) - Math.abs(b.point[1] - fountain[1] - (side === 'west' ? 200 : -200)))[0];
  const west = street('west'), east = street('east');
  const garden = plan.landscaping.find(value => value.kind === 'garden' && centre(value.polygon)[0] < x && centre(value.polygon)[1] > fountain[1]) || plan.landscaping[0];
  return {
    entry: [x, maxY - 16], avenue: [x, (maxY + fountain[1]) / 2], fountain,
    gardens: garden ? centre(garden.polygon) : fountain,
    west: west?.point || [x, fountain[1] + 200], westJunction: [x, west?.point[1] || fountain[1] + 200],
    east: east?.point || [x, fountain[1] - 200], eastJunction: [x, east?.point[1] || fountain[1] - 200],
    rear: [x, minY + 45],
  };
}

export function interpolateDroneCamera(from, to, t) {
  return { center: from.center.map((value, i) => mix(value, to.center[i], t)),
    zoom: mix(from.zoom, to.zoom, t), pitch: mix(from.pitch, to.pitch, t), bearing: mix(from.bearing, to.bearing, t) };
}

// Camera coordinates can be geographic (MapLibre) or native X/Z (Three.js).
export function createDroneTourRoute({ plan, project, overview, heading = 0, entry, forecourt }) {
  const landmarks = droneTourLandmarks(plan), segments = [];
  let previous = { ...overview, center: [...overview.center] }, duration = 0;
  const camera = (point, zoom, bearing = heading, pitch = 62) => ({ center: project(point), zoom: (overview.shotZoom ?? overview.zoom) + zoom, bearing, pitch });
  const add = (id, label, to, seconds, orbit = false) => {
    to = { ...to, center: [...to.center], bearing: orbit ? previous.bearing + 360 : nearestBearing(to.bearing, previous.bearing) };
    segments.push({ id, label, from: previous, to, start: duration, duration: seconds, orbit });
    duration += seconds; previous = to;
  };
  const gate = entry || camera(landmarks.entry, 1.65);
  add('orbit', '360° colony panorama', overview, 28, true);
  add('entrance', 'Entrance & shops', gate, 6);
  if (forecourt) {
    add('frontage', 'Landscaped frontage', forecourt, 6);
    add('frontage', 'Landscaped frontage', gate, 5);
  }
  add('avenue', 'Palm-lined avenue', camera(landmarks.avenue, 2.65), 8);
  const fountain = camera(landmarks.fountain, 3.4, heading, 64);
  add('fountain', 'Central fountain', fountain, 6);
  // A slower partial orbit makes the jets and surrounding gardens visible.
  add('fountain', 'Central fountain', { ...fountain, bearing: heading + 110 }, 10);
  const gardens = camera(landmarks.gardens, 3.05, heading + 125, 58);
  add('parks', 'Parks & gardens', gardens, 6);
  add('parks', 'Parks & gardens', { ...gardens, bearing: heading + 175 }, 6);
  add('streets-west', 'Residential streets · west', camera(landmarks.westJunction, 2.6, heading + 90), 5);
  add('streets-west', 'Residential streets · west', camera(landmarks.west, 2.6, heading + 90), 7);
  add('streets-west', 'Residential streets · west', camera(landmarks.westJunction, 2.6, heading - 90), 6);
  add('avenue-rear', 'Along the main avenue', camera(landmarks.rear, 2.45), 9);
  add('streets-east', 'Residential streets · east', camera(landmarks.eastJunction, 2.6), 6);
  add('streets-east', 'Residential streets · east', camera(landmarks.east, 2.6, heading - 90), 7);
  add('streets-east', 'Residential streets · east', camera(landmarks.eastJunction, 2.6, heading + 90), 6);
  add('return', 'Return to the entrance', camera(landmarks.entry, 1.65), 9);
  add('overview', 'The whole colony', overview, 7);
  const stops = segments.filter((segment, i) => !i || segment.id !== segments[i - 1].id);
  return { segments, stops, duration, sample(seconds) {
    const time = ((seconds % duration) + duration) % duration;
    const segment = segments.find(value => time < value.start + value.duration) || segments.at(-1);
    const t = (time - segment.start) / segment.duration;
    const index = stops.findIndex(value => value.id === segment.id);
    return { camera: interpolateDroneCamera(segment.from, segment.to, ease(t)), label: segment.label, index, count: stops.length };
  } };
}

// Integrate only visible frames. Reset the clock during scroll/background
// suspension, so returning to the map never jumps ahead in the itinerary.
export function createDroneTourPlayer(route, onChange = () => {}) {
  let active = false, running = false, elapsed = 0, lastTime = null, blend = null, published = '';
  const state = () => { const { label, index, count } = route.sample(elapsed); return { active, running, label, index, count }; };
  const publish = () => { const value = state(), key = JSON.stringify(value); if (key !== published) { published = key; onChange(value); } };
  const transition = camera => {
    const target = route.sample(elapsed).camera;
    blend = camera ? { from: { ...camera, center: [...camera.center] }, to: { ...target, bearing: nearestBearing(target.bearing, camera.bearing) }, time: 0 } : null;
    lastTime = null;
  };
  return {
    get active() { return active; }, get running() { return running; },
    start(camera, reducedMotion = false) { elapsed = 0; active = true; running = !reducedMotion; transition(running ? camera : null); publish(); return route.sample(elapsed).camera; },
    pause() { if (!running) return; running = false; lastTime = null; publish(); },
    resume(camera) { if (!active) return; running = true; transition(camera); publish(); },
    stop() { active = false; running = false; lastTime = null; blend = null; publish(); },
    suspend() { lastTime = null; },
    reframe(nextRoute, camera) { route = nextRoute; if (active && running) transition(camera); publish(); },
    next(camera) {
      if (!active) return null;
      const next = (route.sample(elapsed).index + 1) % route.stops.length;
      // Skip the arrival leg when inspecting a stop with motion paused.
      elapsed = route.stops[next].start + (running ? 0 : route.stops[next].duration - 1e-6);
      transition(running ? camera : null); publish();
      return running ? null : route.sample(elapsed).camera;
    },
    tick(time, suspended = false) {
      if (!running || suspended) { lastTime = null; return null; }
      const delta = lastTime === null ? 0 : Math.min(Math.max((time - lastTime) / 1000, 0), .25);
      lastTime = time;
      let camera;
      if (blend) {
        blend.time += delta;
        camera = interpolateDroneCamera(blend.from, blend.to, ease(Math.min(blend.time / 2.2, 1)));
        if (blend.time >= 2.2) blend = null;
      } else { elapsed = (elapsed + delta) % route.duration; camera = route.sample(elapsed).camera; }
      publish(); return camera;
    },
  };
}
