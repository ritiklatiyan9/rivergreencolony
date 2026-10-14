// Match the slate dome's lathe profile when finding where each drop lands.
export function fountainSurfaceHeight(radius, profile, waterY) {
  if (radius >= profile[0][0]) return waterY;
  for (let i = 1; i < profile.length; i++) {
    const [outer, low] = profile[i - 1], [inner, high] = profile[i];
    if (radius >= inner) return low + (high - low) * (outer - radius) / (outer - inner);
  }
  return profile[profile.length - 1][1];
}

export function fountainDropLanding(start, velocity, profile, waterY) {
  const point = t => [start[0] + velocity[0] * t, start[1] + velocity[1] * t - 1.5 * t * t, start[2] + velocity[2] * t];
  let low = 0, high = 2;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2, p = point(mid);
    if (p[1] > fountainSurfaceHeight(Math.hypot(p[0], p[2]), profile, waterY)) low = mid;
    else high = mid;
  }
  const landing = point(high);
  landing[1] = fountainSurfaceHeight(Math.hypot(landing[0], landing[2]), profile, waterY) + .002;
  return { duration: high, landing };
}
