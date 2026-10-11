import * as THREE from 'three';
import { fitAssetPoint, siteBoundaryEdges, siteContainmentOffset } from '../data/colonySiteFit.js';

// Project only the site plane. An asset's complete assembly instead uses one
// rotation and uniform scale about its original anchor. All material texture
// coordinates remain in the original drawing, before this final placement.
function fitShader(mode) {
  const declarations = mode === 'mixed' ? 'attribute vec2 aColonyMapAnchor; attribute float aColonyMapRigid; attribute vec2 aColonyMapOffset;'
    : mode === 'attribute' ? 'attribute vec2 aColonyMapAnchor;' : mode === 'uniform' ? 'uniform vec2 uColonyMapAnchor;' : '';
  const anchor = mode === 'mixed' || mode === 'attribute' ? 'return aColonyMapAnchor;'
    : mode === 'uniform' ? 'return uColonyMapAnchor;'
      : mode === 'instance' ? '#ifdef USE_INSTANCING\nreturn (modelMatrix * instanceMatrix[3]).xz;\n#else\nreturn (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xz;\n#endif' : 'return vec2(0.0);';
  const rigid = mode === 'mixed' ? 'aColonyMapRigid' : mode === 'surface' ? '0.0' : '1.0';
  const offset = mode === 'mixed' ? 'aColonyMapOffset' : 'vec2(0.0)';
  return `${declarations}
varying vec2 vColonyMapXZ; varying float vColonyMapSurface;
uniform mat3 uColonySite;
vec2 rgMapAnchor(){
${anchor}
}
vec2 rgMapPoint(vec2 p){ vec3 q = uColonySite * vec3(p, 1.0); return q.xy / q.z; }
// J is returned in row order: xx,xz,zx,zz.
vec4 rgMapJacobian(vec2 p){
  vec3 q = uColonySite * vec3(p,1.0); vec2 uv = q.xy / q.z;
  return vec4(uColonySite[0].x-uv.x*uColonySite[0].z,
    uColonySite[1].x-uv.x*uColonySite[1].z,
    uColonySite[0].y-uv.y*uColonySite[0].z,
    uColonySite[1].y-uv.y*uColonySite[1].z) / q.z;
}
vec3 rgMapFrame(vec2 a){
  vec4 j=rgMapJacobian(a); float det=j.x*j.w-j.y*j.z, t=dot(j,j);
  float s=sqrt(max(0.0,(t-sqrt(max(0.0,t*t-4.0*det*det)))*0.5));
  vec2 r=normalize(vec2(j.x+j.w,j.z-j.y)); return vec3(r,s);
}
vec4 rgMapWorld(vec4 p){
  if (${rigid} < 0.5) { vec2 q=rgMapPoint(p.xz); return vec4(q.x,p.y,q.y,p.w); }
  vec2 a=rgMapAnchor(); vec3 f=rgMapFrame(a); vec2 d=(p.xz-a)*f.z;
  vec2 q=rgMapPoint(a)+vec2(f.x*d.x-f.y*d.y,f.y*d.x+f.x*d.y)+${offset};
  return vec4(q.x,p.y*f.z,q.y,p.w);
}
float rgMapIsSurface(){ return ${rigid} < 0.5 ? 1.0 : 0.0; }
vec3 rgMapNormal(vec3 n, vec2 p){
  if (${rigid} < 0.5){ vec4 j=rgMapJacobian(p); float det=j.x*j.w-j.y*j.z;
    return normalize(vec3((j.w*n.x-j.z*n.z)/det,n.y,(-j.y*n.x+j.x*n.z)/det)); }
  vec3 f=rgMapFrame(rgMapAnchor()); return vec3(f.x*n.x-f.y*n.z,n.y,f.y*n.x+f.x*n.z);
}
`;
}

export function patchColonyFitShader(shader, mode, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = fitShader(mode) + shader.vertexShader;
  const project = THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
    'vec4 rgPlacedVertex=rgMapWorld(modelMatrix * mvPosition); vColonyMapXZ=rgPlacedVertex.xz; vColonyMapSurface=rgMapIsSurface(); mvPosition=viewMatrix * rgPlacedVertex;');
  const worldPosition = THREE.ShaderChunk.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;',
    'worldPosition = rgMapWorld(modelMatrix * worldPosition);');
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', project)
    .replace('#include <worldpos_vertex>', worldPosition);
  // Correct the fitted surface normals and the rigid assets' yaw. Imported
  // map camera is a similarity frame, so inverseTransformDirection recovers
  // the original world normal without depending on its position or scale.
  shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `${THREE.ShaderChunk.defaultnormal_vertex}
    vec4 rgOriginalVertex=vec4(position,1.0);
    #ifdef USE_INSTANCING
    rgOriginalVertex=instanceMatrix*rgOriginalVertex;
    #endif
    rgOriginalVertex=modelMatrix*rgOriginalVertex;
    vec3 rgOriginalNormal=inverseTransformDirection(transformedNormal,viewMatrix);
    transformedNormal=mat3(viewMatrix)*rgMapNormal(rgOriginalNormal,rgOriginalVertex.xz);`);
  // Fountain jets/spray use ShaderMaterial rather than Three's chunks.
  if (!shader.vertexShader.includes(project)) {
    shader.vertexShader = shader.vertexShader
      .replaceAll('projectionMatrix * modelViewMatrix * p', 'projectionMatrix * viewMatrix * rgMapWorld(modelMatrix * p)')
      .replaceAll('projectionMatrix * modelViewMatrix * vec4(point, 1.0)', 'projectionMatrix * viewMatrix * rgMapWorld(modelMatrix * vec4(point, 1.0))')
      .replaceAll('modelViewMatrix * vec4(p, 1.0)', 'viewMatrix * rgMapWorld(modelMatrix * vec4(p, 1.0))')
      .replace('gl_Position = projectionMatrix * viewMatrix * rgMapWorld(modelMatrix * p);', 'vColonyMapXZ=rgMapWorld(modelMatrix * p).xz; vColonyMapSurface=rgMapIsSurface(); gl_Position = projectionMatrix * viewMatrix * rgMapWorld(modelMatrix * p);')
      .replace('vec4 mv = viewMatrix * rgMapWorld(modelMatrix * vec4(p, 1.0));', 'vColonyMapXZ=rgMapWorld(modelMatrix * vec4(p, 1.0)).xz; vColonyMapSurface=rgMapIsSurface(); vec4 mv = viewMatrix * rgMapWorld(modelMatrix * vec4(p, 1.0));');
  }
  if (uniforms.uColonySiteEdges) {
    shader.fragmentShader = 'varying vec2 vColonyMapXZ; varying float vColonyMapSurface; uniform vec3 uColonySiteEdges[4];\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, `void main(){
      if(vColonyMapSurface>0.5){ for(int i=0;i<4;i++){ if(dot(uColonySiteEdges[i],vec3(vColonyMapXZ,1.0)) < -0.00001) discard; } }`);
  }
}

export function applyColonyMapFit(model, fit) {
  const placements = new WeakMap();
  let placementIndex = 0;
  const placementFor = value => {
    if (!placements.has(value)) placements.set(value, { id: placementIndex++, fit: value,
      uniform: { value: new THREE.Matrix3().set(...value.matrix) } });
    return placements.get(value);
  };
  const defaultPlacement = placementFor(fit);
  // The entrance apron has its own four-edge clipping region. Reusing the
  // inner perimeter would clip it away and pull its gate back into the colony.
  const regions = new WeakMap();
  let regionIndex = 0;
  const regionFor = boundary => {
    if (!boundary) return null;
    if (!regions.has(boundary)) {
      const edges = siteBoundaryEdges(boundary);
      regions.set(boundary, { id: regionIndex++, edges,
        uniform: { value: edges.map(edge => new THREE.Vector3(...edge)) } });
    }
    return regions.get(boundary);
  };
  const defaultRegion = regionFor(fit.target);
  const mergeMetadata = (inherited, own) => own ? { ...inherited, ...own } : inherited;
  const variants = new Map();
  if (defaultRegion) containMergedAssets(model, defaultPlacement, defaultRegion, regionFor, placementFor, mergeMetadata);
  const resolveMode = (mesh, inherited) => {
    const meta = inherited;
    if (meta?.anchor) return { mode: 'uniform', anchor: meta.anchor };
    if (mesh.geometry.getAttribute('aColonyMapRigid')) {
      if (!mesh.geometry.getAttribute('aColonyMapOffset')) mesh.geometry.setAttribute('aColonyMapOffset',
        new THREE.BufferAttribute(new Float32Array(mesh.geometry.getAttribute('position').count * 2), 2));
      return { mode: 'mixed' };
    }
    if (meta?.mode === 'surface') return { mode: 'surface' };
    if (meta?.anchors) {
      // Instance shapes are shared across bins; anchors belong to each mesh.
      // Keep the original live array so animated rig commits update the GPU.
      const geometry = model.ctx.kit.geometry(mesh.geometry.clone());
      geometry.setAttribute('aColonyMapAnchor', new THREE.InstancedBufferAttribute(meta.anchors, 2));
      mesh.geometry = geometry;
      return { mode: 'attribute' };
    }
    if (mesh.geometry.getAttribute('aColonyMapAnchor')) return { mode: 'attribute' };
    return { mode: mesh.isInstancedMesh ? 'instance' : 'surface' };
  };
  const materialFor = (original, descriptor) => {
    const key = `${original.uuid}|${descriptor.mode}|${descriptor.anchor?.join(',') || ''}|${descriptor.region?.id ?? 'none'}|${descriptor.placement.id}`;
    if (variants.has(key)) return variants.get(key);
    const value = model.ctx.kit.track(original.clone()), hook = original.onBeforeCompile, cacheKey = original.customProgramCacheKey();
    const uniforms = { uColonySite: descriptor.placement.uniform };
    if (descriptor.region) uniforms.uColonySiteEdges = descriptor.region.uniform;
    if (descriptor.anchor) uniforms.uColonyMapAnchor = { value: new THREE.Vector2(...descriptor.anchor) };
    // ShaderMaterial uniforms are owned by the model's animation clocks.
    if (value.isShaderMaterial) value.uniforms = original.uniforms;
    value.onBeforeCompile = function(shader, renderer) { hook.call(original, shader, renderer); patchColonyFitShader(shader, descriptor.mode, uniforms); };
    value.customProgramCacheKey = () => `${cacheKey}|site-fit-v1|${descriptor.mode}`;
    variants.set(key, value); return value;
  };
  const visit = (object, inherited) => {
    const metadata = mergeMetadata(inherited, object.userData.colonyMapFit);
    if (object.geometry && object.material) {
      const descriptor = { ...resolveMode(object, metadata), region: regionFor(metadata?.clipBoundary) || defaultRegion,
        placement: metadata?.siteFit ? placementFor(metadata.siteFit) : defaultPlacement };
      object.material = Array.isArray(object.material) ? object.material.map(value => materialFor(value, descriptor)) : materialFor(object.material, descriptor);
      // Fit happens after original-coordinate culling; do not cull against the
      // source bounds. Custom depth uses the same positions and alpha cutout.
      object.frustumCulled = false;
      if (object.castShadow) {
        const finish = Array.isArray(object.material) ? object.material[0] : object.material;
        const depth = object.customDepthMaterial || model.ctx.kit.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking,
          map: finish.map, alphaMap: finish.alphaMap, alphaTest: finish.alphaTest, side: finish.side }));
        object.customDepthMaterial = materialFor(depth, descriptor);
      }
    }
    object.children.forEach(child => visit(child, metadata));
  };
  visit(model.root, null);
}

function containMergedAssets(model, defaultPlacement, defaultRegion, regionFor, placementFor, mergeMetadata) {
  model.root.updateMatrixWorld(true);
  const groups = new Map(), meshes = [], vertex = new THREE.Vector3();
  const keyFor = (region, placement, attribute, i) => `${region.id}|${placement.id}|${attribute.getX(i)},${attribute.getY(i)}`;
  const visit = (mesh, inherited) => {
    const metadata = mergeMetadata(inherited, mesh.userData.colonyMapFit);
    const region = regionFor(metadata?.clipBoundary) || defaultRegion;
    const placement = metadata?.siteFit ? placementFor(metadata.siteFit) : defaultPlacement;
    const anchors = mesh.geometry?.getAttribute('aColonyMapAnchor'), rigid = mesh.geometry?.getAttribute('aColonyMapRigid');
    if (anchors && rigid) {
      meshes.push({ mesh, anchors, rigid, region, placement });
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        if (rigid.getX(i) < .5) continue;
        const key = keyFor(region, placement, anchors, i);
        if (!groups.has(key)) groups.set(key, { frame: placement.fit.asset([anchors.getX(i), anchors.getY(i)]),
          edges: region.edges, clearances: region.edges.map(() => Infinity) });
        const group = groups.get(key);
        vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const [x, , z] = fitAssetPoint(vertex.toArray(), group.frame);
        group.edges.forEach(([nx, nz, d], e) => { group.clearances[e] = Math.min(group.clearances[e], nx * x + nz * z + d); });
      }
    }
    mesh.children.forEach(child => visit(child, metadata));
  };
  visit(model.root, null);
  groups.forEach(group => { group.offset = siteContainmentOffset(group.clearances, group.edges); });
  meshes.forEach(({ mesh, anchors, rigid, region, placement }) => {
    const offsets = new Float32Array(anchors.count * 2);
    for (let i = 0; i < anchors.count; i++) {
      if (rigid.getX(i) > .5) offsets.set(groups.get(keyFor(region, placement, anchors, i)).offset, i * 2);
    }
    mesh.geometry.setAttribute('aColonyMapOffset', new THREE.BufferAttribute(offsets, 2));
  });
}
