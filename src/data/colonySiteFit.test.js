import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getColonyMapConfig, getColonySiteFit } from './colonyLocation.js';
import { fitAssetPoint, planWorldPoint, prepareMapPlan, clipSitePolygon } from './colonySiteFit.js';
import { plazaLayout } from '../scene/plazaLayout.js';
import { pointInPolygon } from './sceneLandscape.js';
const plan = JSON.parse(readFileSync(new URL('./threePlotGeometry.json', import.meta.url)));
const fit = getColonySiteFit(plan, getColonyMapConfig());
const close = (a,b,t=1e-8) => assert.ok(Math.abs(a-b)<t, `${a} != ${b}`);

test('projective site registration keeps every road edge straight without seams', () => {
  plan.roads.forEach(road => road.polygon.forEach((p,i) => {
    const a=planWorldPoint(p,plan), b=planWorldPoint(road.polygon[(i+1)%road.polygon.length],plan), u=fit.point(a),v=fit.point(b);
    for(let k=0;k<=32;k++){
      const t=k/32,q=fit.point([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      close((q[0]-u[0])*(v[1]-u[1])-(q[1]-u[1])*(v[0]-u[0]),0,1e-7);
    }
  }));
});

test('protected 3D assemblies preserve circular radii and orthogonal XYZ proportions', () => {
  for (const anchor of [planWorldPoint(plan.roundabout.center,plan), [-10,-7], [8,8]]) {
    const frame=fit.asset(anchor), centre=fitAssetPoint([anchor[0],.2,anchor[1]],frame);
    const axes=[[1,0,0],[0,1,0],[0,0,1]].map(a=>fitAssetPoint([anchor[0]+a[0],.2+a[1],anchor[1]+a[2]],frame).map((v,i)=>v-centre[i]));
    axes.forEach(a=>close(Math.hypot(...a),frame.scale));
    close(axes[0].reduce((s,v,i)=>s+v*axes[2][i],0),0);
    for(let k=0;k<48;k++){
      const a=k/48*Math.PI*2,q=fitAssetPoint([anchor[0]+Math.cos(a),.2,anchor[1]+Math.sin(a)],frame);
      close(Math.hypot(...q.map((v,i)=>v-centre[i])),frame.scale);
    }
  }
});

test('map-only clipping retains all original plot and road IDs with positive area', () => {
  const original=JSON.stringify(plan), mapped=prepareMapPlan(plan);
  assert.deepEqual(mapped.plots.map(p=>p.number),plan.plots.map(p=>p.number));
  assert.equal(mapped.plots.length,200);assert.equal(mapped.roads.length,15);
  [...mapped.plots.map(p=>p.geometry.polygon),...mapped.roads.map(r=>r.polygon)].forEach(poly=>{
    const area=Math.abs(poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a[0]*b[1]-b[0]*a[1];},0));
    assert.ok(area>1);
  });
  assert.equal(JSON.stringify(plan),original);
  assert.deepEqual(clipSitePolygon([[-1,-1],[11,-1],[11,11],[-1,11]],[[0,0],[10,0],[10,10],[0,10]]),[[0,0],[10,0],[10,10],[0,10]]);
});

test('fitted park lawns and walks meet the protected circular roundabout', () => {
  const mapped = prepareMapPlan(plan), layout = plazaLayout(mapped, fit);
  const frame = fit.asset(planWorldPoint(plan.roundabout.center, plan)), radius = layout.ellipse.rx * .02 * frame.scale;
  const distance = point => Math.hypot(...fit.point(planWorldPoint(point, plan)).map((value, i) => value - frame.target[i]));
  assert.equal(layout.gardens.length, 4);
  for (const garden of layout.gardens) {
    const curved = garden.outline.filter(point => Math.abs(distance(point) - radius) < 1e-7);
    assert.ok(curved.length > 20, 'each garden must have a circular recess');
    garden.outline.forEach(point => assert.ok(distance(point) >= radius - 1e-7, 'raised lawn must not overlap the plaza'));
    for (const [points, grow] of [[garden.walk, 9], [garden.lamps, 3], [garden.benches, 15.5]]) {
      for (const point of points) {
        close(distance(point), radius + grow * .02 * frame.scale);
        assert.ok(pointInPolygon(point, garden.polygon), 'park furnishings and paths must remain inside the original garden');
      }
    }
    garden.polygon.filter(point => distance(point) > radius).forEach(corner => {
      assert.ok(garden.outline.some(point => Math.hypot(point[0] - corner[0], point[1] - corner[1]) < 1e-7), 'outer garden corners must retain their road alignment');
    });
    for (const angle of garden.arc) close(distance(layout.arcPoint(angle)), radius);
  }
});

test('park benches face the fountain after their complete rigid placement', () => {
  const layout = plazaLayout(prepareMapPlan(plan), fit), centre = fit.point(planWorldPoint(plan.roundabout.center, plan));
  for (const garden of layout.gardens) for (const [x, z, heading] of garden.benches) {
    const source = planWorldPoint([x, z], plan), frame = fit.asset(source), seat = fit.point(source);
    const front = fitAssetPoint([source[0] + Math.cos(heading), 0, source[1] - Math.sin(heading)], frame);
    const toward = [centre[0] - seat[0], centre[1] - seat[1]], direction = [front[0] - seat[0], front[2] - seat[1]];
    close((direction[0] * toward[0] + direction[1] * toward[1]) / Math.hypot(...direction) / Math.hypot(...toward), 1);
  }
});
