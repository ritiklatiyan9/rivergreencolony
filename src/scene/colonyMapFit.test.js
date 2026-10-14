import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyColonyMapFit, patchColonyFitShader } from './colonyMapFit.js';
import { createKit, lawnMaterial, soilMaterial } from './kit.js';
const fit={matrix:[1.1,.02,1,.03,1.25,-2,.001,.002,1]};

test('grass samples the fitted ground while other surfaces retain their original texture coordinates', () => {
 const kit = createKit({ capabilities: { getMaxAnisotropy: () => 1 } }, { width: 10, height: 10 });
 const root = new THREE.Group(), shape = kit.geometry(new THREE.PlaneGeometry(2, 2));
 const grass = new THREE.Mesh(shape, lawnMaterial(kit)), soil = new THREE.Mesh(shape, soilMaterial(kit));
 root.add(grass, soil);
 const compile = mesh => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  mesh.material.onBeforeCompile(shader, {}); return shader;
 };
 assert.ok(compile(grass).vertexShader.includes('vWorld = (modelMatrix * rgWorld).xyz;'), 'standalone grass must still render without a map fit');
 applyColonyMapFit({ root, ctx: { kit } }, fit);
 assert.ok(compile(grass).vertexShader.includes('vWorld = rgMapWorld(modelMatrix * rgWorld).xyz;'));
 assert.ok(compile(soil).vertexShader.includes('vWorld = (modelMatrix * rgWorld).xyz;'));
 assert.ok(compile(grass).fragmentShader.includes('float macro = rgFine('), 'grass noise must fade out with distance');
 kit.dispose();
});

test('fit shader preserves original material coordinates while fitting positions, normals and shadow coordinates',()=>{
 const shader={uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed,1.0)).xyz;\n#include <defaultnormal_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>\n}'};
 patchColonyFitShader(shader,'mixed',{uColonySite:{value:new THREE.Matrix3().set(...fit.matrix)}});
 assert.ok(shader.vertexShader.includes('vWorld = (modelMatrix * vec4(transformed,1.0)).xyz;'));
 assert.ok(shader.vertexShader.includes('rgMapWorld(modelMatrix * mvPosition)'));
 assert.ok(shader.vertexShader.includes('worldPosition = rgMapWorld(modelMatrix * worldPosition)'));
 assert.ok(shader.vertexShader.includes('rgMapNormal(rgOriginalNormal,rgOriginalVertex.xz)'));
 assert.ok(!shader.vertexShader.includes('#include <project_vertex>'));
});

test('instance anchors remain isolated across shared shapes and animation updates live arrays',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),root=new THREE.Group();
 const anchors=new Float32Array([1,2,3,4]);
 const a=new THREE.InstancedMesh(geometry,material,2),b=new THREE.InstancedMesh(geometry,material,2);
 a.userData.colonyMapFit={mode:'rigid',anchors};b.userData.colonyMapFit={mode:'surface'};root.add(a,b);
 const resources=new Set();applyColonyMapFit({root,ctx:{kit:{geometry:v=>{resources.add(v);return v;},track:v=>{resources.add(v);return v;}}}},fit);
 assert.notEqual(a.geometry,b.geometry);assert.equal(a.geometry.getAttribute('aColonyMapAnchor').array,anchors);
 assert.equal(b.geometry.getAttribute('aColonyMapAnchor'),undefined);assert.notEqual(a.material,b.material);
 anchors[0]=9;assert.equal(a.geometry.getAttribute('aColonyMapAnchor').getX(0),9);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader};a.material.onBeforeCompile(shader,{});
 assert.ok(shader.vertexShader.includes('return aColonyMapAnchor;'));
 resources.forEach(r=>r.dispose());geometry.dispose();material.dispose();
});

test('fountain jet and spray projection both share the complete fountain anchor',()=>{
 const shader={uniforms:{},vertexShader:'void main(){ vec4 edge = projectionMatrix * modelViewMatrix * vec4(point, 1.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * modelViewMatrix * p; }'};
 patchColonyFitShader(shader,'uniform',{uColonySite:{value:new THREE.Matrix3().set(...fit.matrix)},uColonyMapAnchor:{value:new THREE.Vector2(2,3)}});
 assert.ok(!shader.vertexShader.includes('modelViewMatrix'));
 assert.equal((shader.vertexShader.match(/rgMapWorld\(modelMatrix \*/g)||[]).length,5);
});

test('frontage inherits its own clip region and contains the gate without moving it into the inner site',()=>{
 const inner=[[0,0],[10,0],[10,10],[0,10]],apron=[[10,10],[10,14],[0,14],[0,10]];
 const localFit={matrix:[1,0,0,0,1,0,0,0,1],target:inner,
  asset:source=>({source,target:source,scale:1,angle:0})};
 const root=new THREE.Group(),annex=new THREE.Group();annex.userData.colonyMapFit={clipBoundary:apron};root.add(annex);
 const material=new THREE.MeshStandardMaterial(),resources=new Set();
 const make=()=>{
  const geometry=new THREE.BoxGeometry(1,1,.4).toNonIndexed();geometry.translate(5,.5,12);
  const count=geometry.getAttribute('position').count;
  geometry.setAttribute('aColonyMapAnchor',new THREE.BufferAttribute(new Float32Array(Array.from({length:count},()=>[5,12]).flat()),2));
  geometry.setAttribute('aColonyMapRigid',new THREE.BufferAttribute(new Float32Array(count).fill(1),1));
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.colonyMapFit={mode:'rigid'};mesh.castShadow=true;resources.add(geometry);return mesh;
 };
 const main=make(),gate=make();root.add(main);annex.add(gate);
 const paving=new THREE.Mesh(new THREE.PlaneGeometry(),material);paving.userData.colonyMapFit={mode:'surface'};resources.add(paving.geometry);annex.add(paving);
 applyColonyMapFit({root,ctx:{kit:{geometry:v=>{resources.add(v);return v;},track:v=>{resources.add(v);return v;}}}},localFit);
 assert.ok(main.geometry.getAttribute('aColonyMapOffset').getY(0)<-2);
 assert.equal(gate.geometry.getAttribute('aColonyMapOffset').getY(0),0,'the outside gate belongs to the apron');
 assert.notEqual(main.material,gate.material,'shared finishes need separate region uniforms');
 const compile=mesh=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader,{});return shader;};
 const mainShader=compile(main),gateShader=compile(gate),pavingShader=compile(paving);
 assert.notDeepEqual(gateShader.uniforms.uColonySiteEdges.value,mainShader.uniforms.uColonySiteEdges.value);
 assert.equal(gateShader.uniforms.uColonySiteEdges,pavingShader.uniforms.uColonySiteEdges,'child fit mode must preserve parent clip boundary');
 const depthShader={uniforms:{},vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader};gate.customDepthMaterial.onBeforeCompile(depthShader,{});
 assert.equal(depthShader.uniforms.uColonySiteEdges,gateShader.uniforms.uColonySiteEdges);
 resources.forEach(r=>r.dispose());material.dispose();
});

test('shop wings sharing finishes and pivots retain independent placement matrices and containment',()=>{
 const boundary=[[0,0],[10,0],[10,14],[0,14]],root=new THREE.Group();
 const identity={matrix:[1,0,0,0,1,0,0,0,1],target:boundary,asset:source=>({source,target:source,scale:1,angle:0})};
 const shifted={matrix:[1,0,0,0,1,10,0,0,1],asset:source=>({source,target:[source[0],source[1]+10],scale:1,angle:0})};
 const material=new THREE.MeshStandardMaterial(),resources=new Set(),meshes=[];
 for(const placement of [identity,shifted]){
  const wing=new THREE.Group();wing.userData.colonyMapFit={siteFit:placement,clipBoundary:boundary};root.add(wing);
  const geometry=new THREE.BoxGeometry(1,1,1).toNonIndexed();geometry.translate(5,.5,5);resources.add(geometry);
  const count=geometry.getAttribute('position').count;
  geometry.setAttribute('aColonyMapAnchor',new THREE.BufferAttribute(new Float32Array(Array.from({length:count},()=>[5,5]).flat()),2));
  geometry.setAttribute('aColonyMapRigid',new THREE.BufferAttribute(new Float32Array(count).fill(1),1));
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.colonyMapFit={mode:'rigid'};wing.add(mesh);meshes.push(mesh);
 }
 applyColonyMapFit({root,ctx:{kit:{geometry:v=>{resources.add(v);return v;},track:v=>{resources.add(v);return v;}}}},identity);
 assert.equal(meshes[0].geometry.getAttribute('aColonyMapOffset').getY(0),0);
 assert.ok(meshes[1].geometry.getAttribute('aColonyMapOffset').getY(0)<-1.5,'containment uses the shifted row frame');
 assert.notEqual(meshes[0].material,meshes[1].material);
 const shaders=meshes.map(mesh=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader,{});return shader;});
 assert.equal(shaders[0].uniforms.uColonySite.value.elements[7],0);
 assert.equal(shaders[1].uniforms.uColonySite.value.elements[7],10);
 resources.forEach(r=>r.dispose());material.dispose();
});
