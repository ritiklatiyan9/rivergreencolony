import { clipSitePolygon, fitAssetPoint, planWorldPoint } from '../data/colonySiteFit.js';
import { siteLayout, VILLA_SITES } from './sitePlots.js';

// Picking uses the same placed surface as the renderer. Commercial wings
// have their own uniform registration and roof height, whereas residential
// cells follow the fitted site plane. Keep original IDs as the API contract.
export function createPlotSurfaces(plan, { siteFit = null, shopRows = [], groundHeight = 0, shopHeight = groundHeight } = {}) {
  const commercial = new Map(shopRows.flatMap(row => row.plots.map(plot => [plot.number, { plot, fit: row.fit, scale: row.scale }])));
  const surfaces = plan.plots.map(original => {
    const row = commercial.get(original.number), plot = row?.plot || original;
    const fit = row?.fit || siteFit, shop = plot.number.startsWith('S');
    const polygon = plot.geometry.polygon.map(point => {
      const source = planWorldPoint(point, plan);
      return fit ? fit.point(source) : source;
    });
    // Shop rows use a similarity transform, including the complete asset's
    // vertical scale. Unfitted colony mode retains the native drawing height.
    const scale = row?.scale ?? (shop && fit ? fit.asset(planWorldPoint(plot.geometry.center, plan)).scale : 1);
    return { number: plot.number, polygon, height: shop ? shopHeight * scale : groundHeight };
  });
  const byNumber = new Map(surfaces.map(surface => [surface.number, surface]));
  VILLA_SITES.forEach((numbers, index) => {
    if (!numbers.every(number => byNumber.has(number))) return;
    const site = siteLayout(plan, numbers, index);
    const anchor = planWorldPoint(site.toPlan(0, site.villa.y0), plan), frame = siteFit?.asset(anchor);
    site.design.parts.forEach(([key, size, position, shape, rotation]) => {
      // The actual horizontal roof/terrace slabs from the existing villa
      // design make its painted plot number clickable above the ground.
      if (key !== 'trim' || shape !== 'box' || rotation || size[1] > .025 || size[0] * size[2] < .02) return;
      const [sx, sy, sz] = size, [x, y, z] = position;
      const native = [[x - sx / 2, z - sz / 2], [x + sx / 2, z - sz / 2], [x + sx / 2, z + sz / 2], [x - sx / 2, z + sz / 2]]
        .map(([across, depth]) => site.toPlan(across, site.villa.y0 - depth));
      site.plots.forEach(plot => {
        let polygon;
        try { polygon = clipSitePolygon(native, plot.geometry.polygon); }
        catch { return; } // A slab over the other half of a paired villa.
        const height = groundHeight + y + sy / 2;
        const points = polygon.map(point => {
          const [x, z] = planWorldPoint(point, plan);
          return frame ? fitAssetPoint([x, height, z], frame) : [x, height, z];
        });
        const surface = byNumber.get(plot.number);
        (surface.roofs ||= []).push({ polygon: points.map(([x, , z]) => [x, z]), height: points[0][1] });
      });
    });
  });
  return surfaces;
}

export function pointInPlot([x, z], polygon, tolerance = 1e-8) {
  let inside = false;
  for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i++) {
    const [ax, az] = polygon[previous], [bx, bz] = polygon[i];
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const cross = dx * (z - az) - dz * (x - ax);
    if (length > 0 && Math.abs(cross) <= tolerance * length
      && x >= Math.min(ax, bx) - tolerance && x <= Math.max(ax, bx) + tolerance
      && z >= Math.min(az, bz) - tolerance && z <= Math.max(az, bz) + tolerance) return true;
    if ((az > z) !== (bz > z) && x < ax + (z - az) * dx / dz) inside = !inside;
  }
  return inside;
}

// A ray against each planar plot footprint avoids per-plot meshes and GPU
// readback. Choosing the closest surface also handles pitched shop roofs.
export function pickPlotRay(origin, direction, surfaces) {
  if (!origin.every(Number.isFinite) || !direction.every(Number.isFinite) || Math.abs(direction[1]) < 1e-12) return null;
  let selected = null, nearest = Infinity;
  for (const surface of surfaces) {
    for (const part of [surface, ...(surface.roofs || [])]) {
      const distance = (part.height - origin[1]) / direction[1];
      if (distance < 0 || distance >= nearest) continue;
      const point = [origin[0] + direction[0] * distance, origin[2] + direction[2] * distance];
      if (pointInPlot(point, part.polygon)) { selected = surface.number; nearest = distance; }
    }
  }
  return selected;
}

// A drag, scroll gesture, secondary button or pinch must never open booking.
// Track total movement rather than only the final delta (a drag can return
// to its starting position). Cancellation remains latched until release.
export function createPlotClickGesture(tolerance = 5) {
  const pointers = new Map();
  let cancelled = false;
  return {
    begin: event => {
      if (!pointers.size) cancelled = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size !== 1 || (event.pointerType === 'mouse' && event.button !== 0) || event.shiftKey || event.ctrlKey || event.metaKey) cancelled = true;
    },
    move: event => {
      const start = pointers.get(event.pointerId);
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > tolerance) cancelled = true;
    },
    end: event => {
      const start = pointers.get(event.pointerId);
      const click = Boolean(start && pointers.size === 1 && !cancelled && event.type === 'pointerup'
        && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= tolerance);
      pointers.delete(event.pointerId);
      return click;
    },
    cancel: () => { cancelled = true; },
    reset: () => { pointers.clear(); cancelled = false; },
  };
}
