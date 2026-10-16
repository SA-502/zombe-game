import * as THREE from './assets/three.module.js';
export const weaponKey={rifle:'nimer_47',shotgun:'raad_12'};
export const bounds=row=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];row.positions.forEach((v,i)=>{const k=i%3;min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});return {min,max,center:min.map((v,i)=>(v+max[i])/2)};};
export function batchMaterials(pack){return Object.fromEntries(Object.entries(pack.materials_palette).map(([name,s])=>['v2:'+name,{color:s.base_color.slice(0,3),roughness:s.roughness,metalness:s.metallic,emission:s.emission.slice(0,3),glow:s.emission_strength}]));}
export function weaponData(pack,id,level=0){
 const base=pack.weapons[weaponKey[id]],up=pack.weapons[weaponKey[id]+'_upgraded'];if(!base)throw Error('Missing weapon '+id);
 const keep=id==='rifle'?/Sight|Trigger|Charging|GasTube|DustCover|Buttplate/:/GhostRing|FrontBead|TriggerGuard|MagTube|Grip/;
 const rows=level?[...base.mesh_components.filter(r=>keep.test(r.name)),...up.mesh_components]:base.mesh_components;
 const sockets={...base.sockets,...(level?up.sockets:{})};
 if(id==='shotgun'){sockets.iron_sight_rear=bounds(base.mesh_components.find(r=>r.name.includes('GhostRing'))).center;sockets.iron_sight_front=bounds(base.mesh_components.find(r=>r.name.includes('FrontBead'))).center;}
 return {rows,sockets};
}
export function sightAlignment(sockets,scale){const a=sockets.iron_sight_rear??sockets.iron_sights,b=sockets.iron_sight_front??a;if(!a)return {pitch:0,y:0};const dz=b[2]-a[2],pitch=Math.abs(dz)>.001?Math.atan((b[1]-a[1])/dz):0;return {pitch,y:-(a[1]*Math.cos(pitch)-a[2]*Math.sin(pitch))*scale};}
export function buildBatchWeapon(pack,id,fp,geometry,material){
 const root=new THREE.Group();root.scale.setScalar(.90);root.userData={modern:true,longGun:true,models:[],socketsByLevel:[],blenderHands:true};
 for(const level of [0,1]){const data=weaponData(pack,id,level),g=new THREE.Group();for(const row of data.rows){const m=new THREE.Mesh(geometry(row),material('v2:'+row.material));m.name=row.name;g.add(m);}root.userData.models.push(g);root.userData.socketsByLevel.push(data.sockets);root.add(g);}
 for(const side of ['r','l']){const hand=new THREE.Group(),palm=fp.mesh_components.find(r=>r.tag===side+'_palm'),anchor=bounds(palm).center,target=pack.weapons[weaponKey[id]].sockets[side==='r'?'right_hand_grip':'left_hand_grip'];for(const row of fp.mesh_components.filter(r=>r.tag?.startsWith(side+'_'))){const m=new THREE.Mesh(geometry(row),material(row.material));m.name=row.name;hand.add(m);}hand.position.fromArray(target.map((v,i)=>v-anchor[i]));root.add(hand);}
 setWeaponLevel(root,0);return root;
}
export function setWeaponLevel(root,level){const d=root.userData;if(!d.models)return;d.models.forEach((m,i)=>m.visible=i===(level?1:0));d.sockets=d.socketsByLevel[level?1:0];}
export function architectureIssues(data){
 const slabs=data.mesh_components.filter(r=>r.name==='ENV_Upper_Floor_Slab'||r.name.includes('Floor_')||r.name.includes('Landing')||r.name.includes('Deck'));
 if(!slabs.length)return ['لا توجد بلاطة طابق'];
 const conflicts=[];
 for(const step of data.mesh_components.filter(r=>r.name.startsWith('ENV_Stair_Tread_'))){
  const b=bounds(step);
  for(const slab of slabs){
   const box=bounds(slab);
   if(b.center[0]>box.min[0]&&b.center[0]<box.max[0]&&b.center[2]>box.min[2]&&b.center[2]<box.max[2]&&b.max[1]<box.min[1]&&b.max[1]+1.64>box.min[1]){
    conflicts.push(step.name);
   }
  }
 }
 return conflicts.length?['بلاطة الطابق تغطي حيز رأس اللاعب فوق الدرج: '+conflicts.join(', ')]:[];
}
