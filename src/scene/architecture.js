// Built elements: perimeter wall (open to the Chakroad on the north), entrance
// arch, shop rows (roofs carry live availability), villas with parked cars on
// the surveyed plots (sitePlots.js) and street lamps.
// The fountain, its island and the plaza lamps belong to plaza.js.
import { createBatch, createMaterials } from './architecture-common.js';
import { buildWall } from './architecture-wall.js';
import { buildShops } from './architecture-shops.js';
import { buildArch } from './architecture-arch.js';
import { buildVillas } from './architecture-villas.js';
import { buildLamps } from './architecture-lamps.js';
import { buildFrontage, buildFrontageShops } from './architecture-frontage.js';
import { buildCommercialApron } from './architecture-commercial-apron.js';
import { buildHShops } from './architecture-h-shops.js';

export default function buildArchitecture(ctx) {
  const { THREE, kit, root } = ctx;
  const mat = createMaterials(kit), batch = createBatch(THREE, kit, root);
  if (ctx.basePlan && ctx.baseSiteFit && ctx.frontage) {
    // Plot expansion changes the interior fit only. The real perimeter keeps
    // its original side lines and joins the fixed entrance extensions.
    const walls = new THREE.Group(); walls.name = 'Fixed colony perimeter';
    walls.userData.colonyMapFit = { siteFit: ctx.baseSiteFit, clipBoundary: ctx.frontage.shopBoundary || ctx.frontage.shopRows?.[0]?.clipBoundary || ctx.baseSiteFit.target };
    root.add(walls);
    const wallBatch = createBatch(THREE, kit, walls);
    buildWall({ ...ctx, plan: ctx.basePlan }, wallBatch, mat); wallBatch.build();
  } else buildWall(ctx, batch, mat);
  const paintShops = ctx.frontage?.shopRows?.length ? buildFrontageShops(ctx, mat) : buildShops(ctx, batch, mat);
  if (!ctx.frontage) buildArch(ctx, batch, mat);
  buildLamps(ctx, batch, mat);
  batch.build();
  if (ctx.frontage) buildFrontage(ctx, mat);
  if (ctx.frontage?.commercialApron) { buildCommercialApron(ctx); buildHShops(ctx, mat); }
  buildVillas(ctx, mat);

  return {
    paintPlots: (statuses) => paintShops(statuses),
  };
}
