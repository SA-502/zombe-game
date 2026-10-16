import * as THREE from './assets/three.module.js';
import {VARIANT_SCALES,variantFor,samplePose,blendPose,clipState} from './remaster.mjs';

export function zombieLibrary(models,actions,material){
 const library={rig:actions.rig,clips:actions.clips,variants:{}};
 for(const id of Object.keys(VARIANT_SCALES)){
  const batches=new Map(),scale=VARIANT_SCALES[id];
  for(const row of models.templates[id]){
   const key=row.bone+'|'+row.material,pivot=actions.rig.find(b=>b.id===row.bone).pivot.map((v,i)=>v*scale[i]);
   if(!batches.has(key))batches.set(key,{bone:row.bone,material:row.material,positions:[],normals:[]});
   const b=batches.get(key);
   // Vertices are already in character space. origin is the Blender staging offset.
   for(let i=0;i<row.positions.length;i++)b.positions.push(row.positions[i]-pivot[i%3]);
   b.normals.push(...row.normals);
  }
  library.variants[id]=[...batches.values()].map(b=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));geometry.computeBoundingSphere();return {bone:b.bone,geometry,material:material(b.material)};});
 }
 return library;
}

export function createZombieModel(library,enemy){
 const root=new THREE.Group(),bones={},id=variantFor(enemy.id),scale=VARIANT_SCALES[id];
 for(const j of library.rig){const b=new THREE.Group(),parent=library.rig.find(p=>p.id===j.parent);b.name=j.id;b.position.fromArray(j.pivot.map((v,i)=>(v-(parent?.pivot[i]??0))*scale[i]));bones[j.id]=b;(j.parent?bones[j.parent]:root).add(b);}
 for(const row of library.variants[id]){const m=new THREE.Mesh(row.geometry,row.material);m.name='Blender '+id+' '+row.bone;m.userData={enemy:enemy.id,head:row.bone==='head'};m.castShadow=row.bone==='torso'||row.bone==='head';bones[row.bone].add(m);}
 root.userData={bones,variant:id,scale,library,travel:0,lastX:enemy.x,lastZ:enemy.z};return root;
}

export function animateZombieModel(root,enemy,time){
 const d=root.userData,delta=Math.hypot(enemy.x-d.lastX,enemy.z-d.lastZ);d.lastX=enemy.x;d.lastZ=enemy.z;
 if(!enemy.dead&&enemy.action==='chase')d.travel+=delta;
 const state=clipState(enemy,time,d.library.clips,delta>1e-5?d.travel:0),key=enemy.action==='recover'?'attack':enemy.action==='windup'?'attack':state.name;
 let pose=samplePose(d.library.clips[state.name],state.time,d.library.rig,d.scale);
 if(d.animationKey!==key){d.blendFrom=d.pose;d.blendAt=time;d.animationKey=key;}
 if(d.blendFrom&&time-d.blendAt<.10)pose=blendPose(d.blendFrom,pose,Math.max(0,(time-d.blendAt)/.1));
 d.pose=pose;d.clip=state.name;d.clipTime=state.time;
 for(const [id,b]of Object.entries(d.bones)){b.rotation.set(...pose[id].rot,'XYZ');b.position.fromArray(pose[id].pos);}
 root.position.set(enemy.x,enemy.y,enemy.z);root.rotation.set(0,enemy.facing+Math.PI,0);root.scale.setScalar(1);
}
