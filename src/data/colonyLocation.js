import { createSiteFit } from './colonySiteFit.js';
// The destination pin is taken from the supplied River Green directions URL.
// Keep the POI for directions; model placement is calibrated separately below.
export const RIVER_GREEN_LOCATION = Object.freeze({ lat: 29.4697908, lng: 77.2956644 });
// Alignment points from the actual Esri imagery used by the map (level 18).
// They follow the paved colony perimeter, excluding the outside forecourt.
// These are visual reference points, not a cadastral survey.
export const RIVER_GREEN_ENTRANCE = Object.freeze({ lat: 29.469646382007422, lng: 77.29595839977264 });
export const RIVER_GREEN_FOUNTAIN = Object.freeze({ lat: 29.470062042354932, lng: 77.29512691497803 });
// The map adapter uses this origin for numerical stability. The layout plane
// is registered to all four imagery corners; it is not shrunk to fit a box.
export const COLONY_MAP_ANCHOR = RIVER_GREEN_FOUNTAIN;
export const COLONY_MAP_HEADING = 301.71802239454354;
export const COLONY_MAP_METRES_PER_UNIT = 6.132966435829427;
// Same corner order as the original plan: rear left, rear right, front right,
// front left. These define the map-only surface registration.
export const RIVER_GREEN_SITE_BOUNDARY = Object.freeze([
  { lat: 29.469851877223654, lng: 77.29405403137207 },
  { lat: 29.47127165097487, lng: 77.29483187198639 },
  { lat: 29.47012275664509, lng: 77.29636073112488 },
  { lat: 29.46906725688461, lng: 77.29563653469086 },
].map(Object.freeze));
// The user's marked frontage is outside the inner paved perimeter. Register
// this entrance apron separately so extending it cannot stretch the plots.
// Its front line follows the two screenshot marks; corners continue the sides.
export const RIVER_GREEN_FRONTAGE = Object.freeze({
  outerLeft: Object.freeze({ lng: 77.29573872685432, lat: 29.469016583278982 }),
  outerRight: Object.freeze({ lng: 77.29641673564907, lat: 29.47008067697554 }),
  gate: Object.freeze({ lng: 77.29607936739922, lat: 29.469551200218408 }),
});
export const GOOGLE_MAPS_URL = 'https://www.google.com/maps/dir//RIVER+GREEN+SHAMLI,+VADHEH,+Shamli+Hwy,+Shamli,+Mundetkalan,+Uttar+Pradesh+247776/@29.4631631,77.5046096,3590m/data=!3m2!1e3!4b1!4m8!4m7!1m0!1m5!1m1!1s0x390c29dd81944553:0xe9591f73b3c8db2d!2m2!1d77.2956644!2d29.4697908?entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D';
export const GOOGLE_MAPS_EMBED_URL = 'https://www.google.com/maps?q=29.4697908,77.2956644&t=k&z=17&output=embed';
export const DEFAULT_COLONY_MAP_STYLE_URL = '/maps/river-green-satellite.json';

// Keep this pure module independent of three.js. This matches kit.js SCALE.
export const COLONY_PLAN_SCALE = .02; // scene units per plan unit
const EARTH_RADIUS_METRES = 6378137;
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (value) => value * 180 / Math.PI;
const normalizeHeading = (value) => ((value % 360) + 360) % 360;

function numericSetting(value, fallback, valid = () => true) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && valid(number) ? number : fallback;
}

const stringSetting = (value) => typeof value === 'string' ? value.trim() : '';

function styleSetting(value) {
  const candidate = stringSetting(value);
  try {
    const url = new URL(candidate);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol === 'https:' || (url.protocol === 'http:' && local)) && !url.username && !url.password) return candidate;
  } catch { /* Invalid/empty overrides retain the free public style. */ }
  return DEFAULT_COLONY_MAP_STYLE_URL;
}

export function getColonyMapConfig(env = {}) {
  const settings = env && typeof env === 'object' ? env : {};
  return {
    styleUrl: styleSetting(settings.VITE_COLONY_MAP_STYLE_URL),
    fitToSite: settings.VITE_COLONY_MAP_FIT_TO_SITE !== 'false',
    location: {
      lat: numericSetting(settings.VITE_COLONY_MAP_LAT, COLONY_MAP_ANCHOR.lat, value => value >= -90 && value <= 90),
      lng: numericSetting(settings.VITE_COLONY_MAP_LNG, COLONY_MAP_ANCHOR.lng, value => value >= -180 && value <= 180),
    },
    heading: normalizeHeading(numericSetting(settings.VITE_COLONY_MAP_HEADING, COLONY_MAP_HEADING)),
    metresPerUnit: numericSetting(settings.VITE_COLONY_MAP_METRES_PER_UNIT, COLONY_MAP_METRES_PER_UNIT, value => value > 0 && value <= COLONY_MAP_METRES_PER_UNIT),
    altitude: numericSetting(settings.VITE_COLONY_MAP_ALTITUDE, .35, value => value >= 0),
  };
}

function finitePoint(point, name) {
  if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)) {
    throw new TypeError(`${name} must contain two finite coordinates`);
  }
  return point;
}

const siteFits = new WeakMap();
export function getColonySiteFit(plan, config = getColonyMapConfig()) {
  let configs = siteFits.get(plan);
  if (!configs) { configs = new WeakMap(); siteFits.set(plan, configs); }
  if (!configs.has(config)) configs.set(config, createSiteFit(plan, config, RIVER_GREEN_SITE_BOUNDARY));
  return configs.get(config);
}

// Plan x points east and plan y points south. Heading rotates the colony
// clockwise from north. metresPerUnit measures the existing scene's units,
// rather than the much smaller original plan units.
export function colonyPointToLatLng(planPoint, plan, config = getColonyMapConfig()) {
  const [x, y] = finitePoint(planPoint, 'Plan point');
  const [anchorX, anchorY] = finitePoint(plan?.roundabout?.center, 'Plan roundabout');
  const { location, metresPerUnit, heading } = config;
  if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180
    || !Number.isFinite(metresPerUnit) || metresPerUnit <= 0 || !Number.isFinite(heading)) {
    throw new TypeError('Map configuration must contain valid coordinates, scale and heading');
  }
  if (config.fitToSite) return getColonySiteFit(plan, config).location(planPoint);
  const scale = COLONY_PLAN_SCALE * metresPerUnit;
  const xEast = (x - anchorX) * scale, yNorth = (anchorY - y) * scale;
  const angle = radians(normalizeHeading(heading));
  const east = xEast * Math.cos(angle) + yNorth * Math.sin(angle);
  const north = yNorth * Math.cos(angle) - xEast * Math.sin(angle);
  const distance = Math.hypot(east, north);
  if (!Number.isFinite(distance)) throw new RangeError('Plan point exceeds the supported coordinate range');
  if (distance === 0) return { ...location };

  // A spherical destination calculation remains finite near the poles and
  // wraps the date line; at colony scale its curvature is negligible.
  const bearing = Math.atan2(east, north), angularDistance = distance / EARTH_RADIUS_METRES;
  const latitude = radians(location.lat), longitude = radians(location.lng);
  const sinLatitude = Math.sin(latitude) * Math.cos(angularDistance)
    + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing);
  const targetLatitude = Math.asin(Math.max(-1, Math.min(1, sinLatitude)));
  const targetLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
  );
  return { lat: degrees(targetLatitude), lng: ((degrees(targetLongitude) + 540) % 360) - 180 };
}
