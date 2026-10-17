import * as THREE from './assets/three.module.js';
import {Survival,WEAPONS,PERKS,POWERUP_TYPES,spreadPixels} from './simulation.mjs';
import {clamp,roomAt} from './physics.mjs';
import {detailMaterial,projectedUV,Atmosphere} from './environment.js';
import {CombatInput} from './input.mjs';
import {validateRemaster} from './remaster.mjs';
import {deliveryPath,watchDelivery,prepareDeliveryGame} from './delivery-preview.mjs';
import {bounds,batchMaterials,buildBatchWeapon,setWeaponLevel,sightAlignment} from './batch-two.mjs';
import {zombieLibrary,createZombieModel,animateZombieModel} from './remaster-renderer.mjs';

const $=id=>document.getElementById(id);
const canvas=$('world');
const mobile=()=>matchMedia('(pointer:coarse)').matches||innerWidth<761;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('error').hidden=false;$('error').textContent='الرسوم ثلاثية الأبعاد تحتاج متصفحًا يدعم WebGL. جرّب Chrome أو Edge.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.autoClear=false;
const scene=new THREE.Scene();scene.background=new THREE.Color('#344653');scene.fog=new THREE.FogExp2('#344653',.0105);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.075,180);camera.rotation.order='YXZ';
scene.add(new THREE.HemisphereLight(0xa8bfd7,0x4b3b29,1.15));
const sun=new THREE.DirectionalLight(0xbccde0,1.65);sun.position.set(-35,38,-30);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;Object.assign(sun.shadow.camera,{left:-52,right:52,top:58,bottom:-58,near:1,far:160});sun.shadow.normalBias=.045;scene.add(sun);scene.add(sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x333b2b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.7;ground.receiveShadow=true;scene.add(ground);
const viewScene=new THREE.Scene();const viewCamera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.04,10);
viewScene.add(new THREE.HemisphereLight(0xd5e0d4,0x524731,2.6));const gunLight=new THREE.DirectionalLight(0xffd69a,2.4);gunLight.position.set(-2,3,1);viewScene.add(gunLight);
const weaponRig=new THREE.Group();viewScene.add(weaponRig);
const world=new THREE.Group();scene.add(world);
let atmosphere,asset,remaster,game,ready=false,started=false,paused=false,muted=false,sensitivity=.0025,yaw=Math.PI,pitch=0,ads=false,adsBlend=0,gunKick=0,meleeAnim=0,flashTime=0,hitTime=0,hurtTime=0,bannerTimer=0,noticeTimer=0,scoreTimer=0,stepTimer=0,gruntTimer=3,lastPoints=600,bob=0,hudTimer=0,lastPerksKey='';
const keys=new Set(),combatInput=new CombatInput();let fireHeld=false,drag=null,joy={x:0,z:0},joyPointer=null,helpResume=false,eyeHeight=1.64;
const clock=new THREE.Clock(),ray=new THREE.Raycaster(),enemyRoots=new Map(),powerupRoots=new Map(),grenadeRoots=new Map(),monkeyRoots=new Map(),barricadeGroups=[],machineRefs={},casingTemplates={},powerupTemplates={},tacticalTemplates={},weapons={},solids=[],roofs=[],gates=[],stationSprites=[],sparks=[];
const direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3();
let best=0;try{best=Number(localStorage.getItem('ashfall-best')||0);}catch{}$('best').textContent=best||'—';

// Sounds are generated locally. No downloaded audio or account services are used.
let audio,master;
function initAudio(){if(audio){audio.resume().catch(()=>{});return;}try{audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=muted?0:.42;master.connect(audio.destination);}catch{}}
function tone(freq,duration,volume=.12,type='sine',end=40,destination=master,delay=0){if(!audio||muted)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(destination);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
function noise(duration,volume,cutoff=1500,destination=master){if(!audio||muted)return;const b=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),v=b.getChannelData(0);for(let i=0;i<v.length;i++)v[i]=(Math.random()*2-1)*(1-i/v.length);const s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=cutoff;g.gain.value=volume;s.connect(f).connect(g).connect(destination);s.start();s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
function spatialSound(name,position){if(!audio||muted||!position)return;const p=audio.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1.8;p.maxDistance=35;p.rolloffFactor=1.25;p.setPosition(position.x,position.y??1.4,position.z);p.connect(master);if(name==='windup'){noise(.19,.18,700,p);tone(105,.27,.13,'sawtooth',48,p);}else if(name==='grunt')tone(65,.45,.10,'sawtooth',37,p);else if(name==='hurt'){noise(.17,.19,450,p);tone(100,.16,.22,'sine',40,p);}setTimeout(()=>p.disconnect(),800);}
function updateListener(){if(!audio)return;camera.getWorldDirection(direction);audio.listener.setPosition(camera.position.x,camera.position.y,camera.position.z);audio.listener.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
function announcePowerup(kind){
 if(muted)return;
 tone(72,.65,.22,'sawtooth',38);tone(108,.65,.15,'triangle',52,master,.06);
 try{if('speechSynthesis' in window){window.speechSynthesis.cancel();const names={max_ammo:'Max Ammo',double_points:'Double Points',insta_kill:'Insta Kill',carpenter:'Carpenter',nuke:'Kaboom'};const u=new SpeechSynthesisUtterance(names[kind]||kind);u.lang='en-US';u.pitch=.25;u.rate=.78;u.volume=.75;window.speechSynthesis.speak(u);}}catch{}
}
function sound(name,weapon){if(name==='shot'){noise(weapon==='shotgun'?.24:.13,weapon==='shotgun'?.65:.35,weapon==='rifle'?2300:3400);tone(weapon==='shotgun'?95:170,.13,.30,'triangle',35);}else if(name==='step')noise(.07,.06,350);else if(name==='reload'){tone(500,.06,.07,'square',300);noise(.11,.09,2400);}else if(name==='loaded')tone(800,.05,.09,'square',500);else if(name==='hit')tone(570,.04,.06,'triangle',250);else if(name==='kill')tone(170,.13,.10,'triangle',80);else if(name==='hurt'){noise(.17,.15,450);tone(100,.16,.2,'sine',40);}else if(name==='round'){tone(140,.8,.18,'sawtooth',55);noise(.5,.08,500);}else if(name==='specialRound'){tone(65,1.3,.25,'sawtooth',28);tone(195,.9,.16,'sawtooth',62,master,.18);noise(.8,.16,650);}else if(name==='purchase'||name==='power'||name==='upgrade'){tone(420,.18,.15,'sine',900);}else if(name==='perk'){[330,415,494,659].forEach((f,i)=>tone(f,.16,.13,'triangle',f*1.04,master,i*.09));}else if(name==='teddy'){[260,220,185,150,115].forEach((f,i)=>tone(f,.14,.16,'sawtooth',f*.75,master,i*.11));}else if(name==='explosion'){noise(.48,.52,420);tone(82,.42,.32,'sawtooth',24);}else if(name==='monkey'){[523,659,784,659,587,784].forEach((f,i)=>tone(f,.12,.11,'square',f,master,i*.13));}else if(name==='repair'){noise(.08,.15,1200);tone(620,.06,.12,'triangle',180);}else if(name==='trap'){tone(120,.32,.18,'sawtooth',88);noise(.22,.14,1800);}else if(name==='downed'){tone(95,.6,.24,'sawtooth',32);tone(70,.8,.22,'sine',28,master,.2);}else if(name==='revived'){[262,330,392,523].forEach((f,i)=>tone(f,.2,.15,'triangle',f*1.1,master,i*.08));}else if(name==='grunt')tone(65,.45,.06,'sawtooth',37);else if(name==='melee')noise(.1,.14,600);}

function material(name){const s=asset.materials[name];if(!s)throw Error('Missing material '+name);const fromBlender=(name.startsWith('Ashfall |')||name.startsWith('v2:Ashfall |'));const m=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...s.color),roughness:fromBlender?s.roughness:Math.max(.5,s.roughness),metalness:fromBlender?s.metalness:Math.min(.5,s.metalness),side:THREE.DoubleSide});if(s.glow>0){m.emissive.setRGB(...(s.emission||s.color));m.emissiveIntensity=s.glow*(fromBlender?1:.5);}return fromBlender||name.startsWith('Combat |')?m:detailMaterial(m,name);}
function geometry(row){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(row.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(row.normals,3));if(row.colors?.length)g.setAttribute('color',new THREE.Float32BufferAttribute(row.colors,3));g.setAttribute('uv',new THREE.BufferAttribute(projectedUV(row),2));g.computeBoundingSphere();return g;}
function addStatic(){const batches=new Map();for(const row of asset.objects){if(row.name.startsWith('COMBAT | Wall'))continue;if(row.roof||row.gate){const o=new THREE.Mesh(geometry(row),material(row.material));o.name=row.name;o.castShadow=true;o.receiveShadow=true;world.add(o);solids.push(o);if(row.roof)roofs.push({mesh:o,zone:row.roofZone});if(row.gate)gates.push(o);continue;}if(!batches.has(row.material))batches.set(row.material,{positions:[],normals:[]});const b=batches.get(row.material);for(const n of row.positions)b.positions.push(n);for(const n of row.normals)b.normals.push(n);}
 for(const [name,row] of batches){const o=new THREE.Mesh(geometry(row),material(name));o.name=name;o.castShadow=true;o.receiveShadow=true;world.add(o);solids.push(o);}
}
const templateCache={};
function template(id){if(!templateCache[id])templateCache[id]=asset.templates[id].map(row=>({row,geometry:geometry(row),material:material(row.material)}));return templateCache[id];}
let zombieBatches;
function createZombie(enemy){const root=createZombieModel(zombieBatches,enemy);scene.add(root);enemyRoots.set(enemy.id,root);return root;}
function buildWeapons(){
 const firstPerson=remaster.fp.mesh_components.map(row=>({row,geometry:geometry(row),material:material(row.material)}));
 for(const id of Object.keys(WEAPONS)){
  if(id!=='pistol'){const g=buildBatchWeapon(remaster.pack,id,remaster.fp,geometry,material);g.visible=false;weaponRig.add(g);weapons[id]=g;continue;}
  const g=new THREE.Group(),modern=id==='pistol';
  const rows=modern?firstPerson:template(id);
  for(const s of rows){const m=new THREE.Mesh(s.geometry,s.material);m.name=s.row.name;if(!modern)m.position.fromArray(s.row.origin);g.add(m);}
  if(!modern){const hands=new THREE.Group();for(const s of firstPerson.filter(s=>/^[rl]_/.test(s.row.tag))){const m=new THREE.Mesh(s.geometry,s.material);m.name=s.row.name;hands.add(m);}hands.scale.setScalar(1.6);hands.position.y=-.02;g.add(hands);}
  g.visible=false;g.scale.setScalar(modern?1.35:.72);g.userData={modern,sockets:modern?remaster.fp.sockets:null,blenderHands:true};weaponRig.add(g);weapons[id]=g;
 }
}
const flashGeo=new THREE.BufferGeometry();const flashVerts=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6,r=i%2?.08:.17,r2=(i+1)%2?.08:.17;flashVerts.push(0,0,0,Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(b)*r2,Math.sin(b)*r2,0);}flashGeo.setAttribute('position',new THREE.Float32BufferAttribute(flashVerts,3));const flash=new THREE.Mesh(flashGeo,new THREE.MeshBasicMaterial({color:0xffce76,transparent:true,opacity:.9,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthTest:false}));flash.visible=false;weaponRig.add(flash);
function label(text,cost,id){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#121d19de';ctx.fillRect(0,0,512,128);ctx.fillStyle=id==='power'||id==='upgrade'?'#62c5b0':id.startsWith('perk_')?'#f46d52':'#e7a85c';ctx.fillRect(0,124,512,4);ctx.fillStyle='#fff2ce';ctx.font='bold 30px Tahoma';ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(text,256,53);ctx.fillStyle='#b9c8aa';ctx.font='22px Tahoma';ctx.fillText(cost?cost+' نقطة':'تشغيل',256,94);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sprite.scale.set(3.5,.875,1);return sprite;}
function addStations(){for(const s of asset.stations){if(s.wall)continue;const sprite=label(s.label,s.cost,s.id);sprite.position.set(s.x,s.id==='gate'?3.5:2.7,s.z);scene.add(sprite);stationSprites.push({sprite,station:s});}}
const wallPrices=[];
function addWallBuys(){for(const board of remaster.wall.wallbuys){const id=board.weapon_key==='nimer_47'?'rifle':board.weapon_key==='raad_12'?'shotgun':'pistol',station=asset.stations.find(s=>s.id===id);const group=new THREE.Group();group.position.set(station.wall.x,1.65,station.wall.z);group.rotation.y=Math.atan2(...station.wall.normal);for(const row of board.mesh_components){const mesh=new THREE.Mesh(geometry(row),material('v2:'+row.material));mesh.name=row.name;group.add(mesh);solids.push(mesh);}const plate=bounds(board.mesh_components.find(r=>r.name.includes('PricePlate'))),c=document.createElement('canvas');c.width=512;c.height=128;const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const text=new THREE.Mesh(new THREE.PlaneGeometry(.72,.14),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));text.position.set(plate.center[0],plate.center[1],plate.max[2]+.002);group.add(text);scene.add(group);wallPrices.push({station,canvas:c,texture:tex,value:null});}}
function addArchitecture(){if(!remaster?.architecture)return;for(const row of remaster.architecture.mesh_components){const mesh=new THREE.Mesh(geometry(row),material('v2:'+row.material));mesh.name=row.name;mesh.castShadow=true;mesh.receiveShadow=true;world.add(mesh);solids.push(mesh);}if(remaster.architecture.collision_boxes){for(const b of remaster.architecture.collision_boxes)asset.colliders.push({name:b.id,min:[b.min[0],b.min[2]],max:[b.max[0],b.max[2]],height:b.max[1],gate:false});}for(const step of remaster.architecture.mesh_components.filter(r=>r.name.startsWith('ENV_Stair_Tread_'))){const b=bounds(step);asset.colliders.push({name:step.name,min:[b.min[0],b.min[2]],max:[b.max[0],b.max[2]],height:b.max[1],gate:false});}if(remaster.architecture.walkable_surfaces){for(const s of remaster.architecture.walkable_surfaces){if(s.min&&s.max)asset.colliders.push({name:s.id,min:[s.min[0],s.min[2]],max:[s.max[0],s.max[2]],height:s.min[1],gate:false});}}}
function buildMeshGroup(rows){const g=new THREE.Group();for(const r of rows){const m=new THREE.Mesh(geometry(r),material('v2:'+r.material));m.name=r.name;m.castShadow=true;m.receiveShadow=true;g.add(m);}return g;}
function addMachines(){
 if(!remaster?.machines)return;
 const mData=remaster.machines;
 for(const pm of mData.perk_machines){
  const spec=PERKS[pm.id];if(!spec)continue;
  const g=buildMeshGroup(pm.mesh_components);
  g.position.set(spec.x,0,spec.z);
  scene.add(g);machineRefs[pm.id]=g;
 }
 if(mData.mystery_box){
  const g=buildMeshGroup(mData.mystery_box.mesh_components);
  const st=asset.stations.find(s=>s.id==='mystery');
  if(st)g.position.set(st.x,0,st.z);
  scene.add(g);machineRefs.box=g;
 }
 if(mData.pack_a_punch){
  const g=buildMeshGroup(mData.pack_a_punch.mesh_components);
  const st=asset.stations.find(s=>s.id==='upgrade');
  if(st)g.position.set(st.x,0,st.z);
  scene.add(g);machineRefs.upgrade=g;
 }
 if(mData.district_power_switch){
  const g=buildMeshGroup(mData.district_power_switch.mesh_components);
  const st=asset.stations.find(s=>s.id==='power');
  if(st)g.position.set(st.x,0,st.z);
  scene.add(g);machineRefs.power=g;
 }
 if(mData.electric_gate_trap){
  const g=buildMeshGroup(mData.electric_gate_trap.mesh_components);
  g.position.set(0,0,22);
  scene.add(g);machineRefs.trap=g;
 }
 if(remaster?.powerupsData){
  for(const p of remaster.powerupsData.powerups)powerupTemplates[p.id]=p.mesh_components;
  for(const [k,v] of Object.entries(remaster.powerupsData.tactical_weapons))tacticalTemplates[k]=v.mesh_components;
  for(const [k,v] of Object.entries(remaster.powerupsData.shell_casings))casingTemplates[k]=v.mesh_components;
 }
}
function addBarricades(){
 if(!remaster?.wall?.wallbuys?.length)return;
 const plankRow=remaster.wall.wallbuys[0].mesh_components[0];
 const plankGeo=geometry(plankRow),plankMat=material('v2:'+plankRow.material);
 const specs=[
  {id:'window_west',x:-5.6,z:2.5,rotY:Math.PI/2},
  {id:'window_east',x:5.6,z:2.5,rotY:Math.PI/2},
  {id:'window_north',x:0,z:7.4,rotY:0}
 ];
 for(const s of specs){
  const group=new THREE.Group();group.position.set(s.x,1.05,s.z);group.rotation.y=s.rotY;
  const planks=[];
  for(let i=0;i<5;i++){
   const m=new THREE.Mesh(plankGeo,plankMat);
   m.scale.set(1.55,.32,1.2);
   m.position.set(0,(i-2)*.22,0);
   m.rotation.z=(i%2===0?1:-1)*.06;
   group.add(m);planks.push(m);
  }
  scene.add(group);barricadeGroups.push({id:s.id,group,planks});
 }
}
function updateWallPrices(){for(const p of wallPrices){const offer=game.offer(p.station),value=(offer.refill?'ذخيرة ':'شراء ')+offer.cost;if(p.value===value)continue;p.value=value;const ctx=p.canvas.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle='#fff2ce';ctx.font='bold 60px Tahoma';ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(value,256,88);p.texture.needsUpdate=true;}}
const ashPositions=new Float32Array(500*3);for(let i=0;i<500;i++){ashPositions[i*3]=(Math.random()-.5)*100;ashPositions[i*3+1]=Math.random()*17;ashPositions[i*3+2]=Math.random()*100-26;}const ashGeometry=new THREE.BufferGeometry();ashGeometry.setAttribute('position',new THREE.BufferAttribute(ashPositions,3));const ash=new THREE.Points(ashGeometry,new THREE.PointsMaterial({size:.065,color:0xbec1aa,transparent:true,opacity:.35,depthWrite:false}));scene.add(ash);
function spark(point,hit=true,blood=false,headshot=false){
 const count=headshot?7:blood?3:1;
 for(let i=0;i<count;i++){
  const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(.04,.05,0)]);
  const color=blood?(headshot&&i%2===0?0xd82218:0x8e1109):(hit?0xe2b56e:0x849180);
  const line=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:1}));
  line.position.copy(point);scene.add(line);
  sparks.push({mesh:line,time:blood?.34:.22,velocity:new THREE.Vector3((Math.random()-.5)*(headshot?4.2:2.2),Math.random()*(headshot?3.4:2),(Math.random()-.5)*(headshot?4.2:2.2))});
 }
}
function spawnCasing(weapon){
 const key=weapon==='shotgun'?'shotgun_12ga':weapon==='rifle'?'rifle_762':'pistol_9mm';
 const rows=casingTemplates[key];if(!rows?.length)return;
 const m=new THREE.Mesh(geometry(rows[0]),material('v2:'+rows[0].material));
 m.scale.setScalar(1.8);
 camera.getWorldDirection(direction);right.crossVectors(direction,up).normalize();
 m.position.copy(camera.position).addScaledVector(direction,.35).addScaledVector(right,.18).addScaledVector(up,-.12);
 scene.add(m);
 sparks.push({mesh:m,time:.75,spin:new THREE.Vector3(12,18,9),velocity:right.clone().multiplyScalar(1.6+Math.random()*.8).addScaledVector(up,1.2+Math.random()*.6)});
}
function tracer(to){const from=camera.position.clone().add(new THREE.Vector3(.1,-.09,-.3).applyQuaternion(camera.quaternion));const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xe1b473,transparent:true,opacity:.35}));scene.add(line);sparks.push({mesh:line,time:.045});}

function toast(text){$('notice').textContent=text;$('notice').classList.add('show');noticeTimer=2.8;}
function banner(title,sub){$('waveTitle').textContent=title;$('waveSubtitle').textContent=sub;$('waveBanner').classList.add('show');bannerTimer=3.5;}
function requestMouse(){if(mobile())return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>toast('اسحب الماوس للنظر إذا لم يُلتقط المؤشر'));}catch{}}
function releaseMouse(){if(document.pointerLockElement===canvas)document.exitPointerLock?.();}
function clearInput(){keys.clear();combatInput.reset();game?.clearTrigger();fireHeld=false;ads=false;drag=null;joy={x:0,z:0};joyPointer=null;$('stick').style.transform='';$('touchAim').style.borderColor='';}
function setPaused(value,request=false){if(!started||game?.state==='dead')return;paused=value;clearInput();$('pause').hidden=!value;if(value)releaseMouse();else if(request)requestMouse();clock.getDelta();}
function startGame(){initAudio();for(const r of enemyRoots.values())scene.remove(r);enemyRoots.clear();for(const r of powerupRoots.values())scene.remove(r);powerupRoots.clear();for(const r of grenadeRoots.values())scene.remove(r);grenadeRoots.clear();for(const r of monkeyRoots.values())scene.remove(r);monkeyRoots.clear();for(const p of sparks){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}sparks.length=0;game.reset();game.start();prepareDeliveryGame(game);started=true;paused=false;yaw=Math.PI;pitch=0;adsBlend=0;eyeHeight=1.64;gunKick=0;lastPoints=600;hurtTime=0;lastPerksKey='';$('perkTray').innerHTML='';$('powerupTray').innerHTML='';clearInput();$('menu').hidden=true;$('hud').hidden=false;$('pause').hidden=true;$('gameover').hidden=true;requestMouse();banner('ابقَ على قيد الحياة','اجمع النقاط · اشرب البيركات · شغّل الكهرباء · طوّر سلاحك');canvas.focus();clock.getDelta();}
function finishGame(){updateHUD();paused=true;clearInput();releaseMouse();$('pause').hidden=true;$('gameover').hidden=false;$('finalRound').textContent=game.round;$('finalKills').textContent=game.kills;$('finalHeads').textContent=game.headshots;best=Math.max(best,game.round);try{localStorage.setItem('ashfall-best',best);}catch{}}
function openHelp(){helpResume=started&&!paused;setPaused(true);$('help').showModal();}
$('start').onclick=()=>ready&&startGame();$('restart').onclick=startGame;$('restartPause').onclick=startGame;$('pauseBtn').onclick=()=>setPaused(true);$('resume').onclick=()=>setPaused(false,true);$('menuHelp').onclick=openHelp;$('helpPause').onclick=openHelp;
$('closeHelp').onclick=$('closeHelp2').onclick=()=>$('help').close();$('help').addEventListener('close',()=>{if(helpResume)setPaused(false,true);});
$('mute').onclick=()=>{muted=!muted;if(master)master.gain.value=muted?0:.42;$('mute').textContent='الصوت: '+(muted?'مكتوم':'يعمل');};$('sensitivity').oninput=e=>{sensitivity=Number(e.target.value)*.0008;};
function interact(){const s=game?.nearestStation();if(s)game.interact(s.id);else game?.repairBarricade();}
function melee(){camera.getWorldDirection(direction);if(game.melee({x:direction.x,z:direction.z}))meleeAnim=.35;}
function throwFrag(){camera.getWorldDirection(direction);if(game?.throwGrenade({x:direction.x,y:direction.y,z:direction.z}))toast('قنبلة يدوية أُلقيت!');else toast('لا توجد قنابل متبقية');}
function throwMonkeyBomb(){camera.getWorldDirection(direction);if(game?.throwMonkey({x:direction.x,y:direction.y,z:direction.z}))toast('القرد الموسيقي يجذب الزومبي!');else toast('لا يوجد قرد موسيقي متبقٍّ');}
const handled=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyC','ControlLeft','ControlRight','KeyV','KeyR','KeyE','KeyF','KeyQ','KeyG','KeyT','KeyB','Digit1','Digit2','Digit3','KeyP','Escape','KeyH']);
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(!handled.has(e.code))return;e.preventDefault();if(e.code==='KeyH'&&!e.repeat){openHelp();return;}if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){if(!$('help').open)setPaused(!paused,!paused);return;}if(!started||paused||game.state!=='playing')return;keys.add(e.code);if(e.repeat)return;if(e.code==='Space')game.jump();if(e.code==='KeyV')combatInput.toggleAim();if(e.code==='KeyR')game.reload();if(e.code==='KeyE')interact();if(e.code==='KeyB'){if(!game.repairBarricade())toast('اقترب من نافذة محطمة لإصلاح ألواحها');}if(e.code==='KeyG')throwFrag();if(e.code==='KeyT')throwMonkeyBomb();if(e.code==='KeyF')melee();if(e.code==='KeyQ')game.cycle();if(e.code.startsWith('Digit')){const id=['pistol','rifle','shotgun'][Number(e.code.at(-1))-1];if(!game.inventory[id])toast('اشترِ هذا السلاح من محطته أولًا');else game.switchWeapon(id);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{if(started&&!paused)setPaused(true);clearInput();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)setPaused(true);});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&started&&!paused&&game.state==='playing')setPaused(true);});
function look(dx,dy){yaw-=dx*sensitivity;pitch=clamp(pitch-dy*sensitivity,-1.34,1.34);}
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&started&&!paused)look(e.movementX,e.movementY);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(!started||paused)return;e.preventDefault();combatInput.setButtons(e.buttons);});
addEventListener('mouseup',e=>combatInput.setButtons(e.buttons));
canvas.addEventListener('pointerdown',e=>{if(!started||paused)return;if(document.pointerLockElement!==canvas){drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId||paused)return;look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=null;});canvas.addEventListener('pointercancel',()=>{combatInput.reset();drag=null;});
canvas.addEventListener('wheel',e=>{if(started&&!paused){e.preventDefault();game.cycle();}},{passive:false});
const joystick=$('joystick');joystick.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoy(e);});function updateJoy(e){const r=joystick.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width*.36),z=(e.clientY-r.top-r.height/2)/(r.height*.36);const n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;joy={x,z};$('stick').style.transform='translate('+x*31+'px,'+z*31+'px)';}joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,()=>{joyPointer=null;joy={x:0,z:0};$('stick').style.transform='';});
$('touchFire').addEventListener('pointerdown',e=>{e.preventDefault();combatInput.setTouchFire(true);$('touchFire').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('touchFire').addEventListener(event,()=>combatInput.setTouchFire(false));
$('touchReload').onclick=()=>game?.reload();$('touchAim').onclick=()=>{combatInput.toggleAim();$('touchAim').style.borderColor=combatInput.aiming?'#e7a85c':'';};$('touchJump').onclick=()=>game?.jump();$('touchSlide').onclick=()=>game?.slide({notify:true});$('touchSwitch').onclick=()=>game?.cycle();$('interactTouch').onclick=interact;
if($('touchGrenade'))$('touchGrenade').onclick=throwFrag;
if($('touchMonkey'))$('touchMonkey').onclick=throwMonkeyBomb;

function shoot(shot){const {spec,weapon,spread}=shot;camera.getWorldDirection(direction);right.crossVectors(direction,up).normalize();const hitables=[];for(const e of game.enemies){const root=enemyRoots.get(e.id);if(!e.dead&&root)root.traverse(o=>{if(o.isMesh)hitables.push(o);});}const walls=solids.filter(o=>o.visible);scene.updateMatrixWorld(true);let firstHit=null;for(let i=0;i<spec.pellets;i++){const dir=direction.clone().addScaledVector(right,(Math.random()-.5)*spread).addScaledVector(up,(Math.random()-.5)*spread).normalize();ray.set(camera.position,dir);ray.far=spec.range;const intersections=ray.intersectObjects([...walls,...hitables],false);const hit=intersections[0];if(hit){if(hit.object.userData.enemy){const attenuation=weapon==='shotgun'?Math.max(.32,1-hit.distance/36):1;const isHead=Boolean(hit.object.userData.head);game.damageEnemy(hit.object.userData.enemy,spec.damage*attenuation,isHead,{source:'bullet',weapon,limb:hit.object.userData.limb});spark(hit.point,true,true,isHead);}else spark(hit.point,false);if(!firstHit)firstHit=hit.point;}else if(!firstHit)firstHit=camera.position.clone().addScaledVector(dir,spec.range);}
 if(firstHit)tracer(firstHit);spawnCasing(weapon);gunKick=Math.min(.20,gunKick+(weapon==='shotgun'?.16:.07));pitch=clamp(pitch+spec.recoil*(shot.ads?.7:1),-1.34,1.34);yaw+=(Math.random()-.5)*spec.recoil*.22;flashTime=.055;
}
function processEvents(){const powerupLabels={max_ammo:'ذخيرة قصوى!',double_points:'نقاط مضاعفة 2X!',insta_kill:'قتل فوري ☠!',carpenter:'مطرقة النجار!',nuke:'قنبلة نووية!'};for(const e of game.events.splice(0)){if(e.type==='hurt'&&e.source)spatialSound('hurt',e.source);else if(['shot','reload','loaded','hit','kill','hurt','round','specialRound','purchase','power','upgrade','melee','perk','teddy','explosion','monkey','repair','trap','downed','revived'].includes(e.type))sound(e.type,e.weapon);if(e.type==='powerup'){const kind=e.kind||e.powerup;announcePowerup(kind);if(powerupLabels[kind])banner(powerupLabels[kind],'غنيمة زومبي كلاسيكية');}if(e.type==='enemyWindup')spatialSound('windup',e);if(e.type==='slide')noise(.45,.12,800);if(e.type==='round')banner('الموجة '+e.round,'الأعداء يقتربون');if(e.type==='specialRound')banner('موجة الصيادين '+e.round,'احذر الكلاب والعدائين — ذخيرة قصوى عند النجاة!');if(e.type==='roundClear')banner('نجوت من الموجة','7 ثوانٍ لإعادة التسلّح');if(e.type==='hit'){hitTime=.14;$('hitmark').style.color=e.head?'#e81b23':'#eee9d0';}if(e.type==='hurt')hurtTime=.65;if(e.type==='notice')toast(e.text);if(e.type==='power'){toast('عادت الكهرباء · البيركات وآلة التطوير والفخاخ متاحة');banner('عادت الإشارة','اشرب البيركات وطوّر سلاحك وفخّخ البوابة');}if(e.type==='gate')toast('البوابة مفتوحة · توجه إلى مفتاح الكهرباء');if(e.type==='weapon')toast('حصلت على '+WEAPONS[e.weapon].name);if(e.type==='upgrade')toast('السلاح مطوّر · ضرر وذخيرة أعلى');if(e.type==='explosion')spark(new THREE.Vector3(e.x,1,e.z),true,true,true);if(e.type==='dead')finishGame();}}
const map=$('radar').getContext('2d');
function updateRadar(){const p=game.player,s=2.55,tx=x=>100+(x-p.x)*s,tz=z=>100+(z-p.z)*s;map.clearRect(0,0,200,200);map.save();map.beginPath();map.rect(0,0,200,200);map.clip();map.strokeStyle='#65746335';map.lineWidth=1;for(let i=0;i<200;i+=25){map.beginPath();map.moveTo(i,0);map.lineTo(i,200);map.moveTo(0,i);map.lineTo(200,i);map.stroke();}map.fillStyle='#7b88765c';for(const c of game.colliders){if(c.disabled)continue;map.fillRect(tx(c.min[0]),tz(c.min[1]),Math.max(1,(c.max[0]-c.min[0])*s),Math.max(1,(c.max[1]-c.min[1])*s));}for(const st of asset.stations){map.fillStyle=st.id==='power'?'#70c8b1':st.id.startsWith('perk_')?'#f46d52':'#e7a85c';map.fillRect(tx(st.x)-2,tz(st.z)-2,4,4);}for(const pu of game.powerups){map.fillStyle='#62f582';map.beginPath();map.arc(tx(pu.x),tz(pu.z),3.2,0,Math.PI*2);map.fill();}map.fillStyle='#d66348';for(const e of game.enemies){if(e.dead)continue;map.fillStyle=e.crawler?'#e8a838':'#d66348';map.beginPath();map.arc(tx(e.x),tz(e.z),2.8,0,Math.PI*2);map.fill();}map.translate(100,100);map.rotate(-yaw);map.fillStyle='#e3e3bd';map.beginPath();map.moveTo(0,-7);map.lineTo(-4,5);map.lineTo(0,3);map.lineTo(4,5);map.closePath();map.fill();map.restore();map.strokeStyle='#b3b69b55';map.strokeRect(0,0,200,200);}
function updateHUD(){updateWallPrices();const p=game.player;$('round').textContent=game.round?String(game.round).padStart(2,'0'):'—';const remaining=game.enemies.filter(e=>!e.dead).length+game.toSpawn;$('remaining').textContent=game.intermission>0?'تبدأ الموجة خلال '+Math.ceil(game.intermission):remaining+' متبقٍّ';$('points').textContent=game.points;$('health').textContent=Math.ceil(p.health);const hpPct=Math.min(100,(p.health/(p.maxHealth||100))*100);$('healthBar').style.width=hpPct+'%';$('healthBar').style.background=p.health<35?'#d6654c':game.perks?.vitality?'#68e390':'#dfddbd';$('armor').textContent=Math.ceil(p.armor);$('armorBar').style.width=p.armor+'%';$('staminaBar').style.width=p.stamina+'%';$('weaponName').textContent=game.spec.name+(game.gun.level?' ✦':'');$('weaponType').textContent=game.spec.short+(game.gun.level?' / MK II':'');$('ammo').textContent=String(game.gun.ammo).padStart(2,'0');$('ammo').style.color=game.gun.ammo<4?'#e88a62':'';$('reserve').textContent=game.gun.reserve;if($('fragCount'))$('fragCount').textContent=game.grenades??0;if($('monkeyCount'))$('monkeyCount').textContent=game.monkeys??0;
 if($('downBanner')){$('downBanner').hidden=!game.downed;if(game.downed&&$('downTimer'))$('downTimer').textContent=Math.max(0,game.downTimer).toFixed(1);}
 const perksKey=Object.keys(game.perks||{}).filter(k=>game.perks[k]).join(',');
 if(perksKey!==lastPerksKey&&$('perkTray')){
  lastPerksKey=perksKey;
  const svgs=remaster?.hudData?.perk_icons_svg||{};
  $('perkTray').innerHTML=Object.keys(game.perks||{}).filter(k=>game.perks[k]).map(k=>`<div class="perk-badge" title="${k}">${svgs[k]||''}</div>`).join('');
 }
 if($('powerupTray')){
  const pills=[];
  if(game.doublePointsTimer>0)pills.push(`<div class="powerup-pill${game.doublePointsTimer<5?' blink':''}"><span>نقاط مضاعفة 2X</span><b>${Math.ceil(game.doublePointsTimer)}s</b></div>`);
  if(game.instaKillTimer>0)pills.push(`<div class="powerup-pill${game.instaKillTimer<5?' blink':''}"><span>قتل فوري ☠</span><b>${Math.ceil(game.instaKillTimer)}s</b></div>`);
  if(game.trapTimer>0)pills.push(`<div class="powerup-pill"><span>الفخ الكهربائي ⚡</span><b>${Math.ceil(game.trapTimer)}s</b></div>`);
  $('powerupTray').innerHTML=pills.join('');
 }
 $('location').textContent=roomAt(p.x,p.z);$('location').dataset.x=p.x.toFixed(2);$('location').dataset.z=p.z.toFixed(2);$('location').dataset.enemies=game.enemies.filter(e=>!e.dead).length;$('location').dataset.variants=[...new Set([...enemyRoots.values()].map(r=>r.userData.variant))].join(',');$('location').dataset.clips=[...new Set([...enemyRoots.values()].map(r=>r.userData.clip))].join(',');$('location').dataset.pistol='blender-v1';$('location').dataset.windups=game.enemies.filter(e=>!e.dead&&e.action==='windup').length;$('location').dataset.strikes=game.enemies.filter(e=>!e.dead&&e.action==='recover').length;$('location').dataset.state=game.state;$('location').dataset.weapon=game.weapon;
 const deg=Math.round(((-yaw*180/Math.PI)%360+360)%360),letter=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];$('compass').textContent=letter+' · '+String(deg).padStart(3,'0');$('powerIcon').classList.toggle('on',game.power);$('powerText').textContent=game.power?'الكهرباء تعمل':'الكهرباء مقطوعة';$('objective').textContent=!game.gateOpen?'اجمع 750 نقطة وافتح بوابة محطة الكهرباء':!game.power?'شغّل الكهرباء داخل المحطة شرق الساحة':!game.gun.level?'طوّر سلاحك في مستودع القطارات · 2200 نقطة':'سلاحك مطوّر · اصمد لأكبر عدد من الموجات';
 const station=game.nearestStation();$('interact').hidden=!station||paused;if(station){const offer=game.offer(station);$('stationName').textContent=offer.label;$('stationCost').textContent=offer.cost?offer.cost+' نقطة':'اضغط للتشغيل';}$('reloadStatus').hidden=game.reloadTimer<=0;const totalReload=game.spec.reload*(game.perks?.haste?.5:1);$('reloadBar').style.width=(1-game.reloadTimer/totalReload)*100+'%';if(game.points>lastPoints){$('scorePop').textContent='+'+(game.points-lastPoints);scoreTimer=1;}lastPoints=game.points;$('movementState').textContent=game.downed?'نزيف':p.slideTime>0?'انزلاق':p.crouched?'انحناء':Math.hypot(p.vx,p.vz)>4?'ركض':'التحمل';$('location').dataset.sliding=String(p.slideTime>0);$('location').dataset.aiming=String(ads);updateRadar();
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=viewCamera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewCamera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function updateWorldDynamics(dt){
 const t=game.time;
 if(machineRefs.box){
  const st=asset.stations.find(s=>s.id==='mystery');
  if(st)machineRefs.box.position.set(st.x,0,st.z);
 }
 if(machineRefs.upgrade){
  machineRefs.upgrade.traverse(o=>{
   if(o.name.includes('TeslaCoil'))o.rotation.y+=dt*(game.power?3.5:.4);
   if(o.name.includes('EnergyArc'))o.visible=Boolean(game.power&&Math.sin(t*22)>-.2);
  });
 }
 if(machineRefs.power){
  machineRefs.power.traverse(o=>{if(o.name==='PWR_ThrowLever')o.rotation.x=game.power?-.65:.45;});
 }
 if(machineRefs.trap){
  const active=game.trapTimer>0;
  machineRefs.trap.traverse(o=>{if(o.name.startsWith('TRAP_Arc_'))o.visible=active&&Math.sin(t*38+o.name.length)>-.3;});
 }
 for(const b of barricadeGroups){
  const state=game.barricades?.find(x=>x.id===b.id);
  if(state)b.planks.forEach((m,idx)=>{m.visible=idx<state.planks;});
 }
 for(const p of game.powerups||[]){
  let root=powerupRoots.get(p.id);
  if(!root){
   const kind=p.type||p.kind||'max_ammo';
   const rows=powerupTemplates[kind]||powerupTemplates.max_ammo||[];
   root=buildMeshGroup(rows);root.scale.setScalar(1.35);
   scene.add(root);powerupRoots.set(p.id,root);
  }
  root.position.set(p.x,.88+Math.sin(t*3.6+p.id)*.14,p.z);
  root.rotation.y=t*2.4+p.id;
  root.visible=(p.life??p.timer??10)>4||Math.sin(t*18)>0;
 }
 for(const [id,r] of powerupRoots)if(!game.powerups?.some(p=>p.id===id)){scene.remove(r);powerupRoots.delete(id);}
 for(const g of game.projectiles||[]){
  let root=grenadeRoots.get(g.id);
  if(!root){
   root=buildMeshGroup(tacticalTemplates.frag_grenade||[]);root.scale.setScalar(1.8);
   scene.add(root);grenadeRoots.set(g.id,root);
  }
  root.position.set(g.x,g.y,g.z);root.rotation.x+=dt*9;root.rotation.z+=dt*7;
 }
 for(const [id,r] of grenadeRoots)if(!game.projectiles?.some(g=>g.id===id)){scene.remove(r);grenadeRoots.delete(id);}
 const activeMonkeys=game.decoy?[{id:'decoy',...game.decoy}]:[];
 for(const m of activeMonkeys){
  let root=monkeyRoots.get(m.id);
  if(!root){
   root=buildMeshGroup(tacticalTemplates.decoy_monkey||[]);root.scale.setScalar(1.65);
   scene.add(root);monkeyRoots.set(m.id,root);
  }
  root.position.set(m.x,m.y,m.z);
  const clap=Math.sin(t*24)*.06;
  root.traverse(o=>{
   if(o.name==='TAC_Decoy_Cymbal_L')o.position.x=-clap;
   if(o.name==='TAC_Decoy_Cymbal_R')o.position.x=clap;
  });
 }
 for(const [id,r] of monkeyRoots)if(!activeMonkeys.some(m=>m.id===id)){scene.remove(r);monkeyRoots.delete(id);}
}
function tick(){requestAnimationFrame(tick);const elapsed=Math.min(clock.getDelta(),.15);const dt=Math.min(elapsed,.05);if(!ready){camera.position.set(-20,14,39);camera.lookAt(1,1,20);renderer.clear();renderer.render(scene,camera);return;}
 if(started&&!paused&&game.state==='playing'){
  fireHeld=combatInput.firing;ads=combatInput.aiming;
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joy.z;
  const side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joy.x;
  const input={viewX:-Math.sin(yaw),viewZ:-Math.cos(yaw),viewFov:2*Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)*180/Math.PI,x:-Math.sin(yaw)*forward+Math.cos(yaw)*side,z:-Math.cos(yaw)*forward-Math.sin(yaw)*side,sprint:(keys.has('ShiftLeft')||keys.has('ShiftRight')||Math.hypot(joy.x,joy.z)>.92)&&!fireHeld,crouch:keys.has('KeyC')||keys.has('ControlLeft')||keys.has('ControlRight'),ads,fireHeld,firePressed:combatInput.consumeShot()};game.stepFrame(elapsed,input);
  const p=game.player,speed=Math.hypot(p.vx,p.vz);bob+=dt*speed*2.6;adsBlend+=(Number(ads)-adsBlend)*(1-Math.exp(-dt*13));const eye=game.downed?.52:p.slideTime>0?.77:p.crouched?1.06:1.64;eyeHeight+=(eye-eyeHeight)*(1-Math.exp(-dt*15));camera.position.set(p.x,p.y+eyeHeight+(p.onGround&&!p.slideTime?Math.sin(bob*2)*Math.min(.035,speed*.009):0),p.z);camera.rotation.set(pitch,yaw,game.downed?-.08:p.slideTime>0?-.035:0,'YXZ');const fov=74-adsBlend*22;if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}
  updateListener();
  for(const r of roofs)r.mesh.visible=true;
  for(const g of gates)g.visible=!game.gateOpen;
  for(const e of game.enemies){const root=enemyRoots.get(e.id)||createZombie(e);animateZombieModel(root,e,game.time);}
  for(const [id,r] of enemyRoots)if(!game.enemies.some(e=>e.id===id)){scene.remove(r);enemyRoots.delete(id);}
  updateWorldDynamics(dt);
  for(const shot of game.events.filter(e=>e.type==='shot'))shoot(shot);
  if(speed>1&&p.onGround&&!p.slideTime){stepTimer-=dt;if(stepTimer<=0){sound('step');stepTimer=speed>4?.28:.42;}}else stepTimer=0;
  gruntTimer-=dt;if(gruntTimer<=0){const nearby=game.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<14);if(nearby.length)spatialSound('grunt',nearby[Math.floor(Math.random()*nearby.length)]);gruntTimer=2+Math.random()*3;}
  for(const {sprite,station} of stationSprites){const d=Math.hypot(station.x-p.x,station.z-p.z);sprite.position.set(station.x,station.id==='gate'?3.5:2.7,station.z);sprite.visible=d>5&&d<22&&!(station.id==='gate'&&game.gateOpen);}
  processEvents();hudTimer-=dt;if(hudTimer<=0){updateHUD();hudTimer=.08;}
 }else if(!started){const t=performance.now()*.000017;camera.position.set(13+Math.sin(t)*3,5.8,14+Math.cos(t)*3);camera.lookAt(-3,4.8,37);for(const {sprite} of stationSprites)sprite.visible=false;}
 gunKick=Math.max(0,gunKick-dt*.7);meleeAnim=Math.max(0,meleeAnim-dt);flashTime=Math.max(0,flashTime-dt);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);bannerTimer=Math.max(0,bannerTimer-dt);noticeTimer=Math.max(0,noticeTimer-dt);scoreTimer=Math.max(0,scoreTimer-dt);
 if(bannerTimer===0)$('waveBanner').classList.remove('show');if(noticeTimer===0)$('notice').classList.remove('show');if(scoreTimer===0)$('scorePop').textContent='';$('hitmark').style.opacity=hitTime>0?1:0;$('damage').style.opacity=started?Math.min(.85,hurtTime*.9+(game.downed?.45:game.player.health<35?.12:0)):0;
 for(const [id,g]of Object.entries(weapons))setWeaponLevel(g,game.inventory[id]?.level??0);
 const totalReload=game?game.spec.reload*(game.perks?.haste?.5:1):1;
 const reload=game?.reloadTimer>0?Math.sin((1-game.reloadTimer/totalReload)*Math.PI):0,slide=game?.player.slideTime>0,current=weapons[game?.weapon||'pistol'],modern=current?.userData.modern;
 if(current){
  const align=sightAlignment(current.userData.sockets,current.scale.x);
  const hipX=modern?(mobile()?.11:.20):(mobile()?.14:.27),hipY=modern?-.22:-.29;
  weaponRig.position.set(hipX*(1-adsBlend),hipY*(1-adsBlend)+align.y*adsBlend-reload*.25+Math.sin(bob*2)*.008*(1-adsBlend),(current.userData.longGun?-.68:-.43)+gunKick);
  weaponRig.rotation.set(align.pitch*adsBlend+gunKick*.8+Math.sin(meleeAnim/.35*Math.PI)*.8,reload*.25,reload*-.55+(slide?.12:Math.sin(bob)*.012*(1-adsBlend)));
  for(const [id,g] of Object.entries(weapons))g.visible=id===game.weapon;
  flash.visible=flashTime>0;if(modern)flash.position.fromArray(current.userData.sockets.muzzle_point).multiplyScalar(current.scale.x);else flash.position.set(0,.17*.72,(game.weapon==='rifle'?-1.20:-1.27)*.72);flash.rotation.z=Math.random()*Math.PI;
 }
 const accuracy=game.getSpread(ads);$('crosshair').style.setProperty('--spread',Math.max(1,spreadPixels(accuracy,innerHeight,camera.fov))+'px');$('location').dataset.spread=accuracy.toFixed(5);
 for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.time-=dt;if(p.velocity){p.velocity.y-=dt*5;p.mesh.position.addScaledVector(p.velocity,dt);}if(p.spin){p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.rotation.z+=p.spin.z*dt;}if(p.time<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();if(!p.spin)p.mesh.material.dispose();sparks.splice(i,1);}}
 const a=ashGeometry.attributes.position;for(let i=0;i<a.count;i++){a.array[i*3+1]-=dt*.32;a.array[i*3]+=dt*.09;if(a.array[i*3+1]<.2)a.array[i*3+1]=17;}a.needsUpdate=true;
 atmosphere?.update(dt,camera,game.power);renderer.clear();renderer.render(scene,camera);if(started&&game.state!=='dead'){renderer.clearDepth();renderer.render(viewScene,viewCamera);}
}
async function load(){try{
 const json=async path=>{const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw Error(path+' HTTP '+res.status);return res.json();};
 const dataPath=name=>deliveryPath(name,'./assets/remaster/'+name);
 const [worldData,models,actions,fp,palette,pack,wall,architecture,machines,powerupsData,hudData]=await Promise.all([json('./assets/district.json'),json(dataPath('zombie-templates-v1.json')),json(dataPath('zombie-actions-v1.json')),json(dataPath('player-hands-pistol-v1.json')),json('./assets/remaster-materials-v1.json'),json(dataPath('weapons-pack-v2.json')),json(dataPath('wallbuys-and-props-v2.json')),json(dataPath('upper-floor-architecture-v2.json')),json('./assets/remaster/gameplay-machines-v3.json'),json('./assets/remaster/powerups-and-tacticals-v3.json'),json('./assets/remaster/ui-icons-and-hud-v3.json')]);
 validateRemaster(models,actions,fp,palette.materials);asset=worldData;Object.assign(asset.materials,palette.materials,batchMaterials(pack),batchMaterials(architecture),batchMaterials(machines),batchMaterials(powerupsData));
 asset.stations.push({id:'pistol',label:'ذخيرة صقر 9',cost:500,x:-4.8,z:8.3,wall:{x:-4.8,z:7.85,normal:[0,1]}});
 for(const p of Object.values(PERKS))asset.stations.push({id:p.id,label:p.label,cost:p.cost,x:p.x,z:p.z});
 asset.stations.push({id:'trap',label:'الفخ الكهربائي للبوابة',cost:1000,x:0,z:22});
 remaster={models,actions,fp,pack,wall,architecture,machines,powerupsData,hudData};zombieBatches=zombieLibrary(models,actions,material);
 addStatic();buildWeapons();addStations();addWallBuys();addArchitecture();addMachines();addBarricades();atmosphere=new Atmosphere(scene,asset);sun.shadow.needsUpdate=true;game=new Survival(asset);ready=true;$('start').disabled=false;$('start').innerHTML='ابدأ البقاء <span>↗</span>';$('loadStatus').textContent='تم تجهيز البيركات الـ4 • الغنائم الكلاسيكية • القرد الموسيقي • الفخ الكهربائي • الطابق العلوي';$('location').dataset.art='blender-remaster-v3-cod-zombies';updateHUD();await watchDelivery(game);
 }catch(error){console.error(error);$('loadStatus').textContent='تعذّر تحميل المنطقة. أعد تحميل الصفحة.';$('error').hidden=false;$('error').textContent='تعذّر تجهيز العالم. تأكد من الاتصال، ثم أعد تحميل الصفحة.';if(new URLSearchParams(location.search).has('delivery'))await watchDelivery();}}

load();tick();
