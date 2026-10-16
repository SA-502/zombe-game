import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from './dist/assets/three.module.js';
import {validateRemaster,VARIANT_SCALES,samplePose,clipState} from './dist/remaster.mjs';
import {zombieLibrary,createZombieModel,animateZombieModel} from './dist/remaster-renderer.mjs';
const json=name=>JSON.parse(fs.readFileSync(new URL('./dist/assets/'+name,import.meta.url)));
const models=json('remaster/zombie-templates-v1.json'),actions=json('remaster/zombie-actions-v1.json'),fp=json('remaster/player-hands-pistol-v1.json'),palette=json('remaster-materials-v1.json');
assert(validateRemaster(models,actions,fp,palette.materials));
assert.throws(()=>validateRemaster(models,actions,fp,{}),/Missing Blender material/,'No silent white-material fallback');
for(const name of ['zombie-templates-v1.json','zombie-actions-v1.json','player-hands-pistol-v1.json'])assert(fs.readFileSync(new URL('./dist/assets/remaster/'+name,import.meta.url)).equals(fs.readFileSync(new URL('../blender-delivery/'+name,import.meta.url))),'Runtime copy is the exact Blender delivery: '+name);
const material=name=>{const s=palette.materials[name];return new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...s.color),roughness:s.roughness,metalness:s.metalness});};
const lib=zombieLibrary(models,actions,material),report=[];
for(const [index,id]of Object.keys(VARIANT_SCALES).entries()){
 const enemy={id:index+1,x:0,y:0,z:0,facing:Math.PI,action:'chase',dead:false};
 const root=createZombieModel(lib,enemy);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);
 assert.equal(root.userData.variant,id);assert(bounds.min.x>-.6&&bounds.max.x<.6,'Blender staging offset never enters the playable map');assert(bounds.max.y>1.7&&bounds.max.y<2.2&&bounds.min.y>-.02,'Character height and ground match engine meters');
 assert(root.children.length>0);let meshCount=0;root.traverse(o=>{if(o.isMesh){meshCount++;assert.equal(o.userData.enemy,enemy.id);assert.equal(o.userData.head,o.parent.name==='head');assert(o.geometry.attributes.position.count>0);}});assert(meshCount<35,'Meshes are batched by bone/material');
 animateZombieModel(root,enemy,0);enemy.x=.05;animateZombieModel(root,enemy,.05);assert.equal(root.userData.clip,id==='runner'?'zombie_run':'zombie_walk');
 enemy.action='windup';enemy.actionStartedAt=1;enemy.strikeAt=1.78;animateZombieModel(root,enemy,1);animateZombieModel(root,enemy,1.78);assert(Math.abs(root.userData.clipTime-.5)<1e-8,'Queued attacks reach the authored contact marker at strikeAt');
 enemy.action='recover';enemy.actionStartedAt=1.78;enemy.actionUntil=2.46;animateZombieModel(root,enemy,1.78);assert.equal(root.userData.clipTime,.5,'Recovery starts at the same contact frame');assert.equal(root.userData.animationKey,'attack','Recovery preserves the active attack clip');
 enemy.action='stagger';enemy.actionStartedAt=3;enemy.actionUntil=3.28;animateZombieModel(root,enemy,3.14);assert.equal(root.userData.clip,'zombie_hit_head');
 enemy.dead=true;enemy.deathTime=.5;animateZombieModel(root,enemy,4);enemy.deathTime=1.5;animateZombieModel(root,enemy,5);assert.equal(root.userData.clip,'zombie_death_forward');assert.equal(root.scale.x,1,'Death uses the authored clip instead of shrinking the body');
 report.push({variant:id,meshes:meshCount,height:Number(bounds.max.y.toFixed(3))});
}
const a=samplePose(actions.clips.zombie_attack,0,actions.rig),b=samplePose(actions.clips.zombie_attack,.0417,actions.rig),mid=samplePose(actions.clips.zombie_attack,.02085,actions.rig);assert(Math.abs(mid.arm_right.rot[0]-(a.arm_right.rot[0]+b.arm_right.rot[0])/2)<1e-8,'Keyframes interpolate between authored samples');
for(const name of Object.keys(actions.clips)){const c=actions.clips[name];for(const t of [0,.1,.5,10]){const pose=samplePose(c,t,actions.rig,VARIANT_SCALES.heavy);assert(Object.values(pose).every(p=>[...p.rot,...p.pos].every(Number.isFinite)),name+' remains finite through looping/end holds');}}
for(const [strikeAt,start]of [[.42,0],[.9,0],[2.5,2]]){const state=clipState({action:'windup',actionStartedAt:start,strikeAt},strikeAt,actions.clips);assert.equal(state.time,actions.clips.zombie_attack.hit_time,'Animation matches the existing simulation deadline');}
const attack=actions.clips.zombie_attack;assert.equal(attack.hit_frame,12);assert.equal(attack.frames.find(f=>f.is_hit_frame).time,.5);
for(const aspect of [16/9,9/16,21/9]){const camera=new THREE.PerspectiveCamera(67,aspect,.04,10);for(const name of ['iron_sight_rear','iron_sight_front']){const p=new THREE.Vector3().fromArray(fp.sockets[name]).multiplyScalar(1.35);p.y-=fp.sockets.iron_sight_rear[1]*1.35;p.z-=.43;p.project(camera);assert(Math.abs(p.x)<1e-7&&Math.abs(p.y)<1e-7,'ADS socket lies on shot axis at aspect '+aspect);}}
const code=fs.readFileSync(new URL('./dist/zombies.js',import.meta.url),'utf8');assert(!code.includes('new THREE.BoxGeometry'),'Runtime no longer creates box hands');
console.log('PASS Blender integration: '+JSON.stringify(report)+'; complete materials; exact source copies; rig/meter bounds; hit tagging; authored clip interpolation; contact at strikeAt; death without shrink; ADS alignment across aspects; no procedural box hands.');
