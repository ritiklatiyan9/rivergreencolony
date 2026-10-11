import { clipSitePolygon, fitSitePoint, mercatorLocation, mercatorPoint, PLAN_SCALE, planWorldPoint, siteAssetFrame, siteBoundaryEdges, solveHomography } from './colonySiteFit.js';

const add = (a, b, scale = 1) => [a[0] + b[0] * scale, a[1] + b[1] * scale];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

function convexHull(points) {
  const sorted = points.map(point => [...point]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (a, b, p) => cross(subtract(b, a), subtract(p, b));
  const half = list => {
    const result = [];
    list.forEach(point => { while (result.length > 1 && turn(result.at(-2), result.at(-1), point) <= 1e-10) result.pop(); result.push(point); });
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function intersectLines(a, b, c, d) {
  const ab = subtract(b, a), cd = subtract(d, c), denominator = cross(ab, cd);
  if (Math.abs(denominator) < 1e-10) throw new Error('The marked frontage must meet both colony side boundaries.');
  return add(a, ab, cross(subtract(c, a), cd) / denominator);
}

// Add the marked entrance strip without recalibrating any interior geometry.
// The outer corners are intersections with the continued original side lines,
// so the extension cannot introduce a kink at either existing front corner.
export function createColonyFrontage(plan, fit, locations) {
  const toTarget = location => fit.worldFromMercator(mercatorPoint(location));
  const toPlan = point => {
    const [x, z] = fit.unpoint(point);
    return [x / PLAN_SCALE + plan.width / 2, z / PLAN_SCALE + plan.height / 2];
  };
  const markedLeft = toTarget(locations.outerLeft), markedRight = toTarget(locations.outerRight);
  const gateTarget = toTarget(locations.gate), direction = subtract(markedRight, markedLeft);
  const length = Math.hypot(...direction);
  if (length < 1e-8) throw new Error('The frontage marks must define a front edge.');
  const tangent = direction.map(value => value / length);
  const frontLineEnd = add(gateTarget, tangent);
  const [rearLeft, rearRight, innerRight, innerLeft] = fit.target;
  const outerRightTarget = intersectLines(rearRight, innerRight, gateTarget, frontLineEnd);
  const outerLeftTarget = intersectLines(rearLeft, innerLeft, gateTarget, frontLineEnd);
  const outerRight = toPlan(outerRightTarget), outerLeft = toPlan(outerLeftTarget), gate = toPlan(gateTarget);
  const targetBoundary = [innerRight, outerRightTarget, outerLeftTarget, innerLeft].map(point => [...point]);
  const boundary = targetBoundary.map(toPlan);

  const boulevard = plan.roads.find(road => road.kind === 'boulevard');
  const left = Math.min(...boulevard.polygon.map(point => point[0])), right = Math.max(...boulevard.polygon.map(point => point[0]));
  const centreX = (left + right) / 2;
  const innerFront = [plan.boundary[3], plan.boundary[2]];
  const pointOnInnerFront = x => {
    const t = (x - innerFront[0][0]) / (innerFront[1][0] - innerFront[0][0]);
    return [x, innerFront[0][1] + t * (innerFront[1][1] - innerFront[0][1])];
  };
  const entry = pointOnInnerFront(centreX), roadWidth = right - left;
  const gateScale = fit.asset(planWorldPoint(gate, plan)).scale;
  // The portal is a protected rigid assembly. Its road opening and wall gap
  // must use that same physical scale rather than the surface homography's
  // separate local axes. Its complete supports fit in the 70-unit wall gap.
  const gateRoadHalfWidth = roadWidth * PLAN_SCALE * gateScale / 2;
  const gateOpeningWidth = Math.max(70, roadWidth + 30);
  const gateGapHalfWidth = gateOpeningWidth * PLAN_SCALE * gateScale / 2;
  const gateLeft = toPlan(add(gateTarget, tangent, -gateRoadHalfWidth));
  const gateRight = toPlan(add(gateTarget, tangent, gateRoadHalfWidth));
  const gapLeft = toPlan(add(gateTarget, tangent, -gateGapHalfWidth));
  const gapRight = toPlan(add(gateTarget, tangent, gateGapHalfWidth));

  return {
    boundary, targetBoundary, gate, gateTarget, entry,
    approach: [pointOnInnerFront(left), pointOnInnerFront(right), gateRight, gateLeft],
    outerFront: [outerLeft, outerRight],
    // Each segment follows the annex winding, including the two front runs.
    wallSegments: [[boundary[0], outerRight], [outerRight, gapRight], [gapLeft, outerLeft], [outerLeft, boundary[3]]],
    gateGap: [gapLeft, gapRight], gateOpeningWidth, gateScale,
    gateHeading: Math.atan2(tangent[1], tangent[0]),
    cameraBoundary: [[...plan.boundary[0]], [...plan.boundary[1]], outerRight, outerLeft],
  };
}

// Move each commercial row as one proportional assembly. A separate similarity
// fit joins the row to the marked gate without stretching individual units or
// changing the original registration of the residential plots and fountain.
export function createFrontageShopPlacement(plan, siteFit, frontage) {
  const shops = plan.plots.filter(plot => plot.number.startsWith('S'));
  const boulevard = plan.roads.find(road => road.kind === 'boulevard').polygon;
  const left = Math.min(...boulevard.map(point => point[0])), right = Math.max(...boulevard.map(point => point[0]));
  const targetBoundary = [[...siteFit.target[0]], [...siteFit.target[1]], [...frontage.targetBoundary[1]], [...frontage.targetBoundary[2]]];
  const edges = siteBoundaryEdges(targetBoundary);
  const angle = frontage.gateHeading, c = Math.cos(angle), s = Math.sin(angle), tangent = [c, s], inward = [s, -c];
  const portalInset = .135 * frontage.gateScale + .002;
  const gateFront = add(frontage.gateTarget, inward, portalInset);
  const toPlan = target => {
    const [x, z] = siteFit.unpoint(target);
    return [x / PLAN_SCALE + plan.width / 2, z / PLAN_SCALE + plan.height / 2];
  };
  const rows = ['west', 'east'].map(side => {
    const plots = shops.filter(plot => side === 'west'
      ? Math.max(...plot.geometry.polygon.map(([x]) => x)) <= left + 1e-7
      : Math.min(...plot.geometry.polygon.map(([x]) => x)) >= right - 1e-7);
    const points = plots.flatMap(plot => plot.geometry.polygon), xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), back = Math.min(...ys), front = Math.max(...ys);
    const sourceFront = planWorldPoint([side === 'west' ? maxX : minX, front], plan);
    const targetFront = add(gateFront, tangent, (side === 'west' ? -1 : 1) * (right - left) * PLAN_SCALE * frontage.gateScale / 2);
    const nativeScales = plots.map(plot => {
      const px = plot.geometry.polygon.map(([x]) => x), py = plot.geometry.polygon.map(([, y]) => y);
      return siteFit.asset(planWorldPoint([(Math.min(...px) + Math.max(...px)) / 2, (Math.min(...py) + Math.max(...py)) / 2], plan)).scale;
    });
    let scale = Math.min(...nativeScales);
    const [x0, z0] = planWorldPoint([minX, back], plan), [x1, z1] = planWorldPoint([maxX, front], plan);
    // Include the complete parapet, shop step and projecting canopy in the
    // footprint. Cap one shared row scale against all outer-site half planes.
    const sourceRectangle = [[x0 - .025, z0 - .02], [x1 + .025, z0 - .02], [x1 + .025, z1 + .095], [x0 - .025, z1 + .095]];
    for (const point of sourceRectangle) {
      const dx = point[0] - sourceFront[0], dz = point[1] - sourceFront[1], delta = [c * dx - s * dz, s * dx + c * dz];
      for (const [nx, nz, offset] of edges) {
        const derivative = nx * delta[0] + nz * delta[1];
        if (derivative < -1e-10) scale = Math.min(scale, (nx * targetFront[0] + nz * targetFront[1] + offset - .002) / -derivative);
      }
    }
    if (!(scale > 0)) throw new Error('The marked frontage cannot contain the commercial rows.');
    const point = ([x, z]) => {
      const dx = x - sourceFront[0], dz = z - sourceFront[1];
      return [targetFront[0] + scale * (c * dx - s * dz), targetFront[1] + scale * (s * dx + c * dz)];
    };
    const matrix = [scale * c, -scale * s, targetFront[0] - scale * (c * sourceFront[0] - s * sourceFront[1]),
      scale * s, scale * c, targetFront[1] - scale * (s * sourceFront[0] + c * sourceFront[1]), 0, 0, 1];
    const fit = { matrix, target: targetBoundary, point,
      asset: source => ({ source, target: point(source), scale, angle }),
      unpoint: ([x, z]) => { const dx = (x - targetFront[0]) / scale, dz = (z - targetFront[1]) / scale; return [sourceFront[0] + c * dx + s * dz, sourceFront[1] - s * dx + c * dz]; },
      worldToMercator: siteFit.worldToMercator, worldFromMercator: siteFit.worldFromMercator,
      location: source => mercatorLocation(siteFit.worldToMercator(point(planWorldPoint(source, plan)))) };
    const targetPolygons = plots.map(plot => plot.geometry.polygon.map(source => point(planWorldPoint(source, plan))));
    const planPolygons = targetPolygons.map(polygon => polygon.map(toPlan));
    return { side, plots, fit, scale, sourceFront, targetFront, clipBoundary: targetBoundary,
      targetRectangle: sourceRectangle.map(point), targetPolygons, planPolygons };
  });
  // The printed S1 is a larger tapered corner shop. Continue that unit to the
  // actual eastern wall instead of ending the commercial row with an empty
  // wedge. All other units, the row frame and its gate connection stay fixed.
  const east = rows.find(row => row.side === 'east'), cornerIndex = east?.plots.findIndex(plot => plot.number === 'S1');
  if (cornerIndex >= 0) {
    const original = east.plots[cornerIndex], xs = original.geometry.polygon.map(([x]) => x), ys = original.geometry.polygon.map(([, y]) => y);
    const x0 = Math.min(...xs), back = Math.min(...ys), front = Math.max(...ys), [nx, nz, offset] = edges[1];
    const edgeX = y => {
      const a = east.fit.point(planWorldPoint([0, y], plan)), b = east.fit.point(planWorldPoint([1, y], plan));
      const slope = nx * (b[0] - a[0]) + nz * (b[1] - a[1]);
      // Clear the compound wall, roof coping and projecting front canopy.
      return (.065 - nx * a[0] - nz * a[1] - offset) / slope;
    };
    const polygon = [[x0, back], [edgeX(back), back], [edgeX(front), front], [x0, front]];
    const maxX = Math.max(...polygon.map(([x]) => x));
    const signedArea = polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + cross(a, b); }, 0);
    const center = [0, 1].map(axis => polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + (a[axis] + b[axis]) * cross(a, b); }, 0) / (3 * signedArea));
    const corner = { ...original, cornerShop: true, geometry: { ...original.geometry, polygon, center, x: x0, y: back, width: maxX - x0, height: front - back } };
    east.plots[cornerIndex] = corner;
    east.targetPolygons[cornerIndex] = polygon.map(source => east.fit.point(planWorldPoint(source, plan)));
    east.planPolygons[cornerIndex] = east.targetPolygons[cornerIndex].map(toPlan);
    const buffered = polygon.flatMap(source => {
      const [x, z] = planWorldPoint(source, plan);
      return [[x - .025, z - .02], [x + .025, z - .02], [x + .025, z + .095], [x - .025, z + .095]].map(east.fit.point);
    });
    east.targetRectangle = convexHull([...east.targetRectangle, ...buffered]);
  }
  const placements = new Map(rows.flatMap(row => row.plots.map((plot, i) => {
    const polygon = row.planPolygons[i], xs = polygon.map(([x]) => x), ys = polygon.map(([, y]) => y);
    const center = toPlan(row.fit.point(planWorldPoint(plot.geometry.center, plan)));
    return [plot.number, { ...plot, geometry: { ...plot.geometry, x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), center, polygon } }];
  })));
  return { rows, targetBoundary, gateFront, portalInset, plots: plan.plots.map(plot => placements.get(plot.number) || plot) };
}

// Fit the printed residential grid to the clear line behind the moved shops.
// Both front controls share one source and target line, preventing the outer
// plot banks from crossing the commercial row when extending the site plane.
export function createExpandedInteriorFit(plan, baseFit, frontage, placement) {
  const residential = plan.plots.filter(plot => !plot.number.startsWith('S'));
  const originalFrontY = Math.max(...residential.flatMap(plot => plot.geometry.polygon.map(([, y]) => y)));
  // Share the available physical span through one fit of the complete printed
  // grid. No individual row receives a separate depth multiplier.
  const frontY = originalFrontY;
  const boulevard = plan.roads.find(road => road.kind === 'boulevard');
  const left = Math.min(...boulevard.polygon.map(([x]) => x)), right = Math.max(...boulevard.polygon.map(([x]) => x));
  const c = Math.cos(frontage.gateHeading), s = Math.sin(frontage.gateHeading), tangent = [c, s], outward = [-s, c];
  const local = point => {
    const [x, z] = subtract(point, placement.gateFront);
    return [x * tangent[0] + z * tangent[1], x * outward[0] + z * outward[1]];
  };
  const fromLocal = (x, z) => add(add(placement.gateFront, tangent, x), outward, z);
  const rearLine = Math.min(...placement.rows.flatMap(row => row.targetRectangle.map(point => local(point)[1]))) - .06;
  const halfWidth = .34 * frontage.gateScale;
  const sourceControl = [[...plan.boundary[0]], [...plan.boundary[1]], [right, frontY], [left, frontY]];
  const targetControl = [[...baseFit.target[0]], [...baseFit.target[1]], fromLocal(halfWidth, rearLine), fromLocal(-halfWidth, rearLine)];
  const matrix = solveHomography(sourceControl.map(point => planWorldPoint(point, plan)), targetControl);
  let sourceBoundary = [[...plan.boundary[0]], [...plan.boundary[1]],
    intersectLines(plan.boundary[1], plan.boundary[2], [0, originalFrontY], [1, originalFrontY]),
    intersectLines(plan.boundary[0], plan.boundary[3], [0, originalFrontY], [1, originalFrontY])];
  const point = source => fitSitePoint(source, matrix);
  const rawTarget = sourceBoundary.map(source => point(planWorldPoint(source, plan)));
  const inverse = solveHomography(rawTarget, sourceBoundary.map(source => planWorldPoint(source, plan)));
  // The entrance controls align the avenue with the fixed gate, but do not
  // constrain the outer sides. Register the ground to the actual side walls
  // as well; otherwise the eastern bank ends short of its compound wall.
  const frontLine = [fromLocal(0, rearLine), fromLocal(1, rearLine)];
  const target = [[...baseFit.target[0]], [...baseFit.target[1]],
    intersectLines(placement.targetBoundary[1], placement.targetBoundary[2], ...frontLine),
    intersectLines(placement.targetBoundary[0], placement.targetBoundary[3], ...frontLine)];
  sourceBoundary = target.map(target => {
    const [x, z] = fitSitePoint(target, inverse);
    return [x / PLAN_SCALE + plan.width / 2, z / PLAN_SCALE + plan.height / 2];
  });
  const sideX = (a, b, y) => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
  // Distribute the extra width over each complete eastern row. The avenue,
  // all row depths and the western bank stay fixed. Matching shared vertices
  // keeps adjoining plots, gardens and road ends connected without stretching
  // just the outermost plot or changing protected building/fountain frames.
  const widenEast = ([x, y]) => {
    if (x <= right + 1e-8) return [x, y];
    const oldEdge = sideX(plan.boundary[1], plan.boundary[2], y);
    const newEdge = sideX(sourceBoundary[1], sourceBoundary[2], y);
    return [right + (x - right) * (newEdge - right) / (oldEdge - right), y];
  };
  const plots = plan.plots.map(plot => {
    if (plot.number.startsWith('S') || plot.geometry.polygon.every(([x]) => x <= right + 1e-8)) return plot;
    const polygon = plot.geometry.polygon.map(widenEast), xs = polygon.map(([x]) => x), ys = polygon.map(([, y]) => y);
    return { ...plot, geometry: { ...plot.geometry, polygon, center: widenEast(plot.geometry.center),
      x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
  });
  const fit = { matrix, target, point, unpoint: target => fitSitePoint(target, inverse),
    asset: source => siteAssetFrame(source, matrix),
    worldToMercator: baseFit.worldToMercator, worldFromMercator: baseFit.worldFromMercator,
    location: source => mercatorLocation(baseFit.worldToMercator(point(planWorldPoint(source, plan)))) };
  const roads = plan.roads.filter(road => road.kind === 'boulevard' || road.polygon.some(([, y]) => y < originalFrontY - 1e-8))
    .map(road => ({ ...road, polygon: clipSitePolygon(road.polygon.map(widenEast), sourceBoundary) }));
  const frontageGardens = [], landscaping = [];
  for (const garden of plan.landscaping) {
    if (garden.polygon.every(([, y]) => y > originalFrontY)) {
      const centreX = garden.polygon.reduce((sum, [x]) => sum + x, 0) / garden.polygon.length;
      const row = placement.rows.find(row => row.side === (centreX < (left + right) / 2 ? 'west' : 'east'));
      const targetPolygon = clipSitePolygon(garden.polygon.map(source => row.fit.point(planWorldPoint(source, plan))), placement.targetBoundary);
      const polygon = targetPolygon.map(target => {
        const [x, z] = row.fit.unpoint(target);
        return [x / PLAN_SCALE + plan.width / 2, z / PLAN_SCALE + plan.height / 2];
      });
      frontageGardens.push({ garden: { ...garden, polygon }, fit: row.fit, clipBoundary: placement.targetBoundary, targetPolygon });
    } else landscaping.push(garden.polygon.some(([x]) => x > right + 1e-8)
      ? { ...garden, polygon: garden.polygon.map(widenEast) } : garden);
  }
  const modelPlan = { ...plan, boundary: sourceBoundary, roads, plots, landscaping };
  const targetApproach = [targetControl[3], targetControl[2],
    add(frontage.gateTarget, tangent, halfWidth), add(frontage.gateTarget, tangent, -halfWidth)];
  const toBasePlan = target => {
    const [x, z] = baseFit.unpoint(target);
    return [x / PLAN_SCALE + plan.width / 2, z / PLAN_SCALE + plan.height / 2];
  };
  // Cover the whole strip between the residential front and the marked outer
  // edge, including the side corners beyond the ends of the fixed shop rows.
  const forecourtTargetBoundary = [target[2], placement.targetBoundary[2], placement.targetBoundary[3], target[3]].map(point => [...point]);
  return { fit, plan: modelPlan, frontY, originalFrontY, rearLine, halfWidth, sourceControl, targetControl, targetApproach, frontageGardens,
    forecourtTargetBoundary, forecourtBoundary: forecourtTargetBoundary.map(toBasePlan),
    approach: targetApproach.map(toBasePlan), entry: toBasePlan(fromLocal(0, rearLine)), clipBoundary: placement.targetBoundary };
}
