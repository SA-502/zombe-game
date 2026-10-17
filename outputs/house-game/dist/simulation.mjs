import {SPAWN,clamp,move,blocked,floorAt,supportAt,clearLine,FlowField} from './physics.mjs';
import {stairTarget} from './architecture.mjs';
import {ENEMY_ATTACK,MELEE,meleeDamage,meleeTarget,canEnemyHit,attackSlot,spawnHidden} from './combat-rules.mjs';
export const WEAPONS={
 pistol:{name:'صقر 9',short:'FALCON 9',damage:34,clip:12,reserve:84,rate:.24,reload:1.35,pellets:1,spread:.012,range:58,recoil:.025,auto:false},
 rifle:{name:'نمر 47',short:'NIMR 47',damage:30,clip:30,reserve:210,rate:.105,reload:1.8,pellets:1,spread:.025,range:72,recoil:.016,auto:true},
 shotgun:{name:'رعد 12',short:'RAAD 12',damage:23,clip:6,reserve:48,rate:.78,reload:2.15,pellets:8,spread:.075,range:27,recoil:.075,auto:false}
};
export const PERKS={
 perk_vitality:{id:'perk_vitality',key:'vitality',name:'مشروب الحيوية (Juggernog)',label:'مشروب الحيوية (Juggernog)',cost:2500,x:-21,z:26,requiresPower:true},
 perk_haste:{id:'perk_haste',key:'haste',name:'مشروب السرعة (Speed Cola)',label:'مشروب السرعة (Speed Cola)',cost:3000,x:20,z:16,requiresPower:true},
 perk_stamina:{id:'perk_stamina',key:'stamina',name:'مشروب التحمل (Stamin-Up)',label:'مشروب التحمل (Stamin-Up)',cost:2000,x:-8,z:36,requiresPower:true},
 perk_revive:{id:'perk_revive',key:'revive',name:'مشروب الإنعاش السريع',label:'مشروب الإنعاش السريع',cost:1500,x:-2.2,z:2.2,requiresPower:false}
};
export const POWERUP_TYPES=['max_ammo','double_points','insta_kill','carpenter','nuke'];
export const BOX_LOCATIONS=[[23,12],[-20,35],[-18,48]];
export const DEFAULT_BARRICADES=[
 {id:'window_west',x:-5.6,z:2.5,planks:5,maxPlanks:5},
 {id:'window_east',x:5.6,z:2.5,planks:5,maxPlanks:5},
 {id:'window_north',x:0,z:7.4,planks:5,maxPlanks:5}
];
export const SPAWNS=[[-40,22],[-15,63],[41,28],[8,66],[-15,17],[16,34],[35,65],[-30,41]];
export function weaponSpread(spec,player,ads=false){
 const motion=Math.min(1,Math.hypot(player.vx,player.vz)/6);
 const stance=player.slideTime>0?1.7:player.crouched?.78:1;
 return spec.spread*(ads?.26:1)*(1+motion*.9)*stance*(player.onGround?1:1.65);
}
export function spreadPixels(spread,height,fov){return spread*height/(4*Math.tan(fov*Math.PI/360));}
export class Survival{
 constructor(asset,random=Math.random){this.asset=asset;this.random=random;this.colliders=asset.colliders.map(c=>({...c}));this.nav=new FlowField(this.colliders);this.events=[];this.reset();}
 event(type,data={}){this.events.push({type,...data});}
 get allStations(){
  const base=this.asset.stations||[];
  const extra=[
   ...Object.values(PERKS).map(p=>({id:p.id,label:p.name,cost:p.cost,x:p.x,z:p.z,perk:p.key,requiresPower:p.requiresPower})),
   {id:'trap',label:'مصيدة الصعق الكهربائي',cost:1000,x:0,z:22}
  ].filter(e=>!base.some(s=>s.id===e.id));
  return [...base,...extra];
 }
 reset(){this.slideNoticeAt=-Infinity;this.view={x:0,z:1,fov:100};this.time=0;this.state='ready';this.player={...SPAWN,y:.2,vx:0,vz:0,vy:0,health:100,maxHealth:100,armor:0,stamina:100,onGround:true,crouched:false,lastHit:-99,slideTime:0,slideCooldown:0,slideX:0,slideZ:0};this.slideHeld=false;this.points=600;this.kills=0;this.headshots=0;this.round=0;this.totalSpawn=0;this.toSpawn=0;this.spawnTimer=0;this.intermission=7;this.enemies=[];this.enemySerial=0;this.inventory={pistol:this.newGun('pistol')};this.weapon='pistol';this.fireTimer=0;this.clearTrigger();this.reloadTimer=0;this.meleeTimer=0;this.power=false;this.gateOpen=false;this.navTimer=0;this.perks={vitality:false,haste:false,stamina:false,revive:false};this.downed=false;this.downTimer=0;this.instaKillTimer=0;this.doublePointsTimer=0;this.powerups=[];this.powerupSerial=0;this.dropsThisRound=0;this.grenades=2;this.monkeys=1;this.projectiles=[];this.decoy=null;this.barricades=DEFAULT_BARRICADES.map(b=>({...b}));this.repairPointsRound=0;this.repairCooldown=0;this.trapTimer=0;this.boxSpins=0;this.boxLocationIndex=0;this.specialRound=false;this.events=[];for(const c of this.colliders)c.disabled=false;this.nav.rebuild();this.event('reset');}
 newGun(id){const w=WEAPONS[id];return {ammo:w.clip,reserve:w.reserve,level:0};}
 start(){if(this.state==='ready'){this.state='playing';this.event('start');}}
 get gun(){return this.inventory[this.weapon];}
 get spec(){const w=WEAPONS[this.weapon];return {...w,damage:w.damage*(this.gun.level?2.1:1),clip:Math.round(w.clip*(this.gun.level?1.5:1)),reserve:Math.round(w.reserve*(this.gun.level?1.5:1))};}
 addPoints(amount){const mult=this.doublePointsTimer>0?2:1;this.points+=amount*mult;return amount*mult;}
 switchWeapon(id){if(!this.inventory[id]||id===this.weapon)return false;this.weapon=id;this.reloadTimer=0;this.fireTimer=.18;this.clearTrigger();this.event('switch');return true;}
 cycle(){const ids=Object.keys(this.inventory);this.switchWeapon(ids[(ids.indexOf(this.weapon)+1)%ids.length]);}
 reload(){if(this.reloadTimer>0||this.gun.ammo>=this.spec.clip||this.gun.reserve<=0||this.state!=='playing')return false;this.reloadTimer=this.spec.reload*(this.perks?.haste?.5:1);this.event('reload');return true;}
 clearTrigger(){this.fireBufferedUntil=-Infinity;}
 requestFire(){if(this.state==='playing')this.fireBufferedUntil=this.time+.12;}
 getSpread(ads=false){return weaponSpread(this.spec,this.player,ads);}
 fire({carry=false,ads=false}={}){if(this.state!=='playing'||this.reloadTimer>0||this.fireTimer>1e-8)return null;if(this.gun.ammo<=0){this.reload();return null;}const spec=this.spec;this.gun.ammo--;this.fireTimer=(carry?this.fireTimer:0)+spec.rate;this.clearTrigger();this.event('shot',{weapon:this.weapon,spec,ads,spread:this.getSpread(ads)});return spec;}
 melee(aim=this.view??{x:0,z:1}){if(this.meleeTimer>0||this.state!=='playing'||this.downed)return false;this.meleeTimer=MELEE.cooldown;this.event('melee');const target=meleeTarget(this.player,this.enemies,aim,this.colliders);if(target)this.damageEnemy(target.id,meleeDamage(this.round),false,{source:'melee'});return true;}
 jump(){const p=this.player;if(this.state==='playing'&&!this.downed&&p.onGround&&(!p.crouched||p.slideTime>0)&&p.stamina>10){p.slideTime=0;p.crouched=false;p.vy=6.2;p.onGround=false;p.stamina-=9;return true;}return false;}
 slide({notify=false}={}){const p=this.player,speed=Math.hypot(p.vx,p.vz);if(this.state!=='playing'||this.downed||p.slideTime>0)return false;const reason=!p.onGround?'لا يمكن الانزلاق في الهواء':p.slideCooldown>0?'انتظر قليلًا قبل الانزلاق مجددًا':speed<4.2?'اركض أولًا ثم اضغط زر الانزلاق':p.stamina<18?'التحمل لا يكفي للانزلاق':null;if(reason){if(notify&&this.time>=(this.slideNoticeAt??-Infinity)){this.event('notice',{text:reason});this.slideNoticeAt=this.time+1.5;}return false;}p.slideTime=.78;p.slideCooldown=1.35;p.slideX=p.vx/speed;p.slideZ=p.vz/speed;p.stamina-=this.perks?.stamina?9:18;p.crouched=true;this.event('slide');return true;}
 makeCrawler(id){const e=this.enemies.find(e=>e.id===id&&!e.dead);if(!e||e.crawler)return false;e.crawler=true;e.speed=Math.min(e.speed,.48);this.event('crawler',{id:e.id,x:e.x,z:e.z});return true;}
 spawnPowerup(x,z,forcedType=null,feet=floorAt(x,z)){const type=forcedType||POWERUP_TYPES[(this.powerupSerial)%POWERUP_TYPES.length];const p={id:++this.powerupSerial,type,x,z,y:supportAt(x,z,this.colliders,feet)+.65,life:25,maxLife:25};this.powerups.push(p);this.dropsThisRound++;this.event('powerupSpawn',{id:p.id,type,x,z});return p;}
 applyPowerup(type){
  if(type==='max_ammo'){for(const [id,gun]of Object.entries(this.inventory)){const f=gun.level?1.5:1;gun.ammo=Math.round(WEAPONS[id].clip*f);gun.reserve=Math.round(WEAPONS[id].reserve*f);}this.grenades=4;this.reloadTimer=0;this.event('notice',{text:'الذخيرة القصوى! تم ملء جميع الأسلحة والقنابل'});}
  else if(type==='insta_kill'){this.instaKillTimer=25;this.event('notice',{text:'القتل الفوري مفعّل لمدة 25 ثانية!'});}
  else if(type==='double_points'){this.doublePointsTimer=25;this.event('notice',{text:'مضاعفة النقاط (2X) مفعّلة لمدة 25 ثانية!'});}
  else if(type==='nuke'){for(const e of this.enemies){if(!e.dead){e.dead=true;e.deathTime=0;e.action='dead';this.kills++;}}this.addPoints(400);this.event('notice',{text:'القنبلة الشاملة! تم تطهير المنطقة (+400)'});}
  else if(type==='carpenter'){for(const b of this.barricades)b.planks=b.maxPlanks;this.addPoints(200);this.event('notice',{text:'النجار! تم ترميم جميع حواجز النوافذ (+200)'});}
  this.event('powerup',{powerup:type,kind:type});return true;
 }
 throwGrenade(aim=this.view??{x:0,z:1}){if(this.state!=='playing'||this.downed||this.grenades<=0)return false;this.grenades--;const len=Math.max(.001,Math.hypot(aim.x,aim.z)),dx=aim.x/len,dz=aim.z/len;this.projectiles.push({id:++this.powerupSerial,type:'frag',x:this.player.x+dx*.4,y:this.player.y+1.3,z:this.player.z+dz*.4,vx:dx*10.5,vy:4.2,vz:dz*10.5,timer:1.6});this.event('grenadeThrow',{type:'frag'});return true;}
 throwMonkey(aim=this.view??{x:0,z:1}){if(this.state!=='playing'||this.downed||this.monkeys<=0||this.decoy)return false;this.monkeys--;const len=Math.max(.001,Math.hypot(aim.x,aim.z)),dx=aim.x/len,dz=aim.z/len;const tx=clamp(this.player.x+dx*3.2,-44,44),tz=clamp(this.player.z+dz*3.2,-22,70);this.decoy={x:tx,y:floorAt(tx,tz),z:tz,timer:6.0};this.event('monkeyStart',{x:tx,y:this.decoy.y,z:tz});this.event('monkey',{x:tx,y:this.decoy.y,z:tz});this.event('notice',{text:'القرد الموسيقي يجذب الزومبي!'});return true;}
 nearestBarricade(){for(const b of this.barricades){if(b.planks<b.maxPlanks&&Math.hypot(b.x-this.player.x,b.z-this.player.z)<2.5)return b;}return null;}
 repairBarricade(){if(this.state!=='playing'||this.downed||this.repairCooldown>0)return false;const b=this.nearestBarricade();if(!b)return false;b.planks++;this.repairCooldown=this.perks?.haste?.32:.65;if(this.repairPointsRound<90){const pts=this.addPoints(10);this.repairPointsRound+=pts;}this.event('repair',{id:b.id,planks:b.planks});return true;}
 damageEnemy(id,damage,head=false,{source='bullet',weapon=this.weapon,limb=false}={}){const e=this.enemies.find(e=>e.id===id&&!e.dead);if(!e||!Number.isFinite(damage)||damage<=0)return false;const actual=this.instaKillTimer>0?e.health+10:damage*(head?2.2:limb?.68:1);e.health-=actual;this.addPoints(10);this.event('hit',{id,head,limb,source});if(e.health>0&&(source==='explosive'||(limb&&e.health<e.maxHealth*.65))&&!e.crawler)this.makeCrawler(e.id);if(e.health<=0){e.dead=true;e.deathTime=0;e.action='dead';if(head)e.decapitated=true;this.kills++;if(head)this.headshots++;this.addPoints(source==='melee'?MELEE.killBonus:head?120:80);this.event('kill',{id,head,decapitated:!!e.decapitated,source,x:e.x,y:e.y,z:e.z});if(this.round>=1&&this.dropsThisRound<4&&this.kills>0&&this.kills%6===0)this.spawnPowerup(e.x,e.z,null,e.y);}
  else if((source==='melee'||head||weapon==='shotgun'&&damage>=18)&&this.time>=(e.staggerReadyAt??0)){e.action='stagger';e.actionStartedAt=this.time;e.actionUntil=this.time+(source==='melee'?.38:head?.28:.18);e.staggerReadyAt=this.time+1.1;e.strikeAt=undefined;e.attack=Math.max(e.attack??0,.2);this.event('enemyStagger',{id,head,source});}return true;}
 damagePlayer(damage,source=null){if(this.state!=='playing'||this.downed)return;const p=this.player;const absorbed=Math.min(p.armor,damage*.7);p.armor-=absorbed;p.health=Math.max(0,p.health-damage+absorbed);p.lastHit=this.time;this.event('hurt',{source:source?{id:source.id,x:source.x,y:source.y+1.25,z:source.z}:null});if(p.health<=0){if(this.perks?.revive){this.downed=true;this.downTimer=3.5;p.health=1;p.vx=0;p.vz=0;this.weapon='pistol';this.inventory.pistol.ammo=WEAPONS.pistol.clip;for(const e of this.enemies){if(!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<2.6){const dx=e.x-p.x,dz=e.z-p.z,d=Math.max(.01,Math.hypot(dx,dz));move(e,dx/d*1.8,dz/d*1.8,this.colliders,.3,.2);}}this.event('downed');this.event('notice',{text:'سقطت أرضًا! جاري الإنعاش الذاتي السريع…'});}else{this.state='dead';this.event('dead',{round:this.round,kills:this.kills});}}}
 stationReachable(s){if(!s||Math.hypot(s.x-this.player.x,s.z-this.player.z)>2.7)return false;return !s.wall||(this.player.x-s.wall.x)*s.wall.normal[0]+(this.player.z-s.wall.z)*s.wall.normal[1]>.12;}
 offer(s){const owned=(s.id==='pistol'||s.id==='rifle'||s.id==='shotgun')&&this.inventory[s.id];return {cost:owned?Math.round(s.cost*.5):s.cost,label:owned?'ذخيرة '+WEAPONS[s.id].name:s.label,refill:!!owned};}
 interact(id){if(this.state!=='playing'||this.downed)return false;const s=this.allStations.find(s=>s.id===id);if(!this.stationReachable(s))return false;const offer=this.offer(s),perkSpec=PERKS[id];
  if(id==='power'){if(this.power){this.event('notice',{text:'الكهرباء تعمل بالفعل'});return false;}this.power=true;this.event('power');return true;}
  if(perkSpec){if(perkSpec.requiresPower&&!this.power){this.event('notice',{text:'شغّل الكهرباء في المحطة أولًا لتفعيل آلة المشروب'});return false;}if(this.perks[perkSpec.key]){this.event('notice',{text:'تملك هذا المشروب بالفعل'});return false;}if(this.points<offer.cost){this.event('notice',{text:'تحتاج '+offer.cost+' نقطة'});return false;}this.points-=offer.cost;this.perks[perkSpec.key]=true;if(perkSpec.key==='vitality'){this.player.maxHealth=250;this.player.health=250;}this.event('perk',{perk:perkSpec.key,id});this.event('purchase',{id});this.event('notice',{text:'شربت '+perkSpec.name+'!'});return true;}
  if(id==='trap'){if(!this.power){this.event('notice',{text:'شغّل الكهرباء أولًا لتشغيل المصيدة'});return false;}if(this.trapTimer>0){this.event('notice',{text:'المصيدة الكهربائية تعمل حاليًا'});return false;}if(this.points<offer.cost){this.event('notice',{text:'تحتاج '+offer.cost+' نقطة'});return false;}this.points-=offer.cost;this.trapTimer=25;this.event('trap',{duration:25});this.event('purchase',{id});this.event('notice',{text:'تم تشغيل مصيدة الصعق الكهربائي لمدة 25 ثانية!'});return true;}
  if(id==='upgrade'&&!this.power){this.event('notice',{text:'شغّل الكهرباء في المحطة أولًا'});return false;}
  if(id==='gate'&&this.gateOpen){this.event('notice',{text:'البوابة مفتوحة'});return false;}
  if(id==='upgrade'&&this.gun.level){this.event('notice',{text:'هذا السلاح مطوّر بالكامل'});return false;}
  if(id==='armor'&&this.player.armor>=99){this.event('notice',{text:'الدرع ممتلئ'});return false;}
  const refillIds=id==='ammo'?Object.keys(this.inventory):offer.refill?[id]:[];
  if(refillIds.length&&!refillIds.some(weapon=>{const gun=this.inventory[weapon],factor=gun.level?1.5:1;return gun.ammo<Math.round(WEAPONS[weapon].clip*factor)||gun.reserve<Math.round(WEAPONS[weapon].reserve*factor);})){this.event('notice',{text:'الذخيرة ممتلئة · لم تُخصم نقاط'});return false;}
  let mysteryWeapon;if(id==='mystery'){const missing=['rifle','shotgun'].filter(weapon=>!this.inventory[weapon]),candidates=missing.length?missing:['rifle','shotgun'];mysteryWeapon=candidates[Math.min(candidates.length-1,Math.floor(this.random()*candidates.length))];}
  if(this.points<offer.cost){this.event('notice',{text:'تحتاج '+offer.cost+' نقطة'});return false;}
  this.points-=offer.cost;
  if(id==='gate'){this.gateOpen=true;for(const c of this.colliders)if(c.gate)c.disabled=true;this.nav.rebuild();this.navTimer=0;this.event('gate');}
  else if(refillIds.length){for(const weapon of refillIds){const gun=this.inventory[weapon],factor=gun.level?1.5:1;gun.reserve=Math.round(WEAPONS[weapon].reserve*factor);gun.ammo=Math.round(WEAPONS[weapon].clip*factor);}if(refillIds.includes(this.weapon))this.reloadTimer=0;if(offer.refill)this.event('notice',{text:'تمت تعبئة الذخيرة مع الاحتفاظ بتطوير السلاح'});}
  else if(id==='armor')this.player.armor=100;
  else if(id==='upgrade'){this.gun.level=1;this.gun.ammo=this.spec.clip;this.gun.reserve=this.spec.reserve;this.event('upgrade');}
  else{const weapon=id==='mystery'?mysteryWeapon:id;if(!WEAPONS[weapon])return false;if(!this.inventory[weapon])this.inventory[weapon]=this.newGun(weapon);else{const gun=this.inventory[weapon],factor=gun.level?1.5:1;gun.ammo=Math.round(WEAPONS[weapon].clip*factor);gun.reserve=Math.round(WEAPONS[weapon].reserve*factor);}this.weapon=weapon;this.reloadTimer=0;this.fireTimer=.18;this.clearTrigger();if(id==='mystery'){this.boxSpins++;this.monkeys=Math.min(2,this.monkeys+1);if(this.boxSpins>=4){this.boxLocationIndex=(this.boxLocationIndex+1)%BOX_LOCATIONS.length;const [bx,bz]=BOX_LOCATIONS[this.boxLocationIndex],ms=this.asset.stations.find(st=>st.id==='mystery');if(ms){ms.x=bx;ms.z=bz;}this.boxSpins=0;this.points+=offer.cost;this.event('teddy',{x:bx,z:bz});this.event('notice',{text:'ظهر الدب الغامض! انتقل الصندوق العشوائي إلى موقع جديد'});}}this.event('weapon',{weapon});}
  this.event('purchase',{id});return true;
 }
 nearestStation(){let chosen=null,dist=2.7;for(const s of this.allStations){if(s.id==='gate'&&this.gateOpen||!this.stationReachable(s))continue;const d=Math.hypot(s.x-this.player.x,s.z-this.player.z);if(d<dist){dist=d;chosen=s;}}return chosen;}
 beginRound(){this.round++;this.dropsThisRound=0;this.repairPointsRound=0;this.grenades=Math.min(4,(this.grenades??2)+1);this.specialRound=this.round>0&&this.round%5===0;this.totalSpawn=this.specialRound?Math.min(6+this.round*2,24):Math.min(8+this.round*3,48);this.toSpawn=this.totalSpawn;this.spawnTimer=1.3;this.event('round',{round:this.round,special:this.specialRound});if(this.specialRound)this.event('specialRound',{round:this.round});}
 spawnEnemy(){const start=Math.floor(this.random()*SPAWNS.length);for(let n=0;n<SPAWNS.length;n++){const [sx,sz]=SPAWNS[(n+start)%SPAWNS.length];for(let attempt=0;attempt<12;attempt++){const x=sx+(this.random()-.5)*5,z=sz+(this.random()-.5)*5;if(!spawnHidden(x,z,this.player,this.view??{x:0,z:1,fov:100},this.colliders)||blocked(x,z,this.colliders,.34))continue;const i=this.nav.index(x,z);if(i<0||this.nav.distance[i]<0)continue;const hp=this.specialRound?60+this.round*12:80+this.round*18;const baseSpeed=Math.min(.9+this.round*.115,2.75)*(this.random()*.24+.88);this.enemies.push({id:++this.enemySerial,x,z,y:floorAt(x,z),health:hp,maxHealth:hp,speed:this.specialRound?Math.max(2.3,baseSpeed*1.3):baseSpeed,attack:0,action:'chase',staggerReadyAt:0,dead:false,crawler:false,decapitated:false,variant:this.specialRound?'runner':undefined,phase:this.random()*6,facing:0});this.toSpawn--;return true;}}return false;}
 step(input={}){this.update(1/60,input);}
 stepFrame(elapsed,input={}){elapsed=clamp(elapsed,0,.15);const steps=Math.max(1,Math.ceil(elapsed/.05));for(let i=0;i<steps;i++)this.update(elapsed/steps,{...input,firePressed:i===0&&!!input.firePressed});}
 update(dt,input={}){if(this.state!=='playing')return;dt=clamp(dt,0,.06);this.time+=dt;this.instaKillTimer=Math.max(0,this.instaKillTimer-dt);this.doublePointsTimer=Math.max(0,this.doublePointsTimer-dt);this.repairCooldown=Math.max(0,this.repairCooldown-dt);this.trapTimer=Math.max(0,this.trapTimer-dt);
  if(this.downed){this.downTimer-=dt;if(this.downTimer<=0){this.downed=false;this.perks.revive=false;this.player.health=this.perks.vitality?250:100;this.player.lastHit=this.time;this.event('revived');this.event('notice',{text:'نهضت من جديد! استعد المعركة'});}}
  if(Number.isFinite(input.viewX)&&Number.isFinite(input.viewZ)&&Math.hypot(input.viewX,input.viewZ)>.001)this.view={x:input.viewX,z:input.viewZ,fov:clamp(input.viewFov??100,30,175)};const automatic=!!input.fireHeld&&this.spec.auto;this.fireTimer=automatic?this.fireTimer-dt:Math.max(0,this.fireTimer-dt);this.meleeTimer=Math.max(0,this.meleeTimer-dt);if(input.firePressed)this.requestFire();
  if(this.reloadTimer>0){this.reloadTimer=Math.max(0,this.reloadTimer-dt);if(this.reloadTimer===0){const amount=Math.min(this.spec.clip-this.gun.ammo,this.gun.reserve);this.gun.ammo+=amount;this.gun.reserve-=amount;this.event('loaded');}}
  const p=this.player;let ix=this.downed?0:input.x||0,iz=this.downed?0:input.z||0;const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}p.slideCooldown=Math.max(0,p.slideCooldown-dt);
  const slidePressed=!!input.crouch||!!input.slide;if(slidePressed&&!this.slideHeld&&input.sprint)this.slide({notify:true});this.slideHeld=slidePressed;
  const sliding=p.slideTime>0;p.crouched=this.downed||sliding||!!input.crouch;const sprint=!this.downed&&!!input.sprint&&p.stamina>1&&len>.1&&!p.crouched&&!input.ads;
  const topSprint=this.perks?.stamina?7.0:6,topWalk=this.perks?.stamina?4.05:3.6;
  if(sliding){p.slideTime=Math.max(0,p.slideTime-dt);const speed=3.1+5.3*p.slideTime/.78;p.vx=p.slideX*speed;p.vz=p.slideZ*speed;}
  else{const speed=this.downed?.4:p.crouched?1.65:input.ads?2.2:sprint?topSprint:topWalk;const smoothing=1-Math.exp(-dt*(p.onGround?14:5));p.vx+=(ix*speed-p.vx)*smoothing;p.vz+=(iz*speed-p.vz)*smoothing;}
  if(sprint)p.stamina=Math.max(0,p.stamina-dt*(this.perks?.stamina?11:23));else if(!sliding)p.stamina=Math.min(100,p.stamina+dt*(this.perks?.stamina?30:16));
  move(p,p.vx*dt,p.vz*dt,this.colliders,.28,p.y,this.enemies);
  const previousY=p.y;p.vy-=18*dt;p.y+=p.vy*dt;const floor=supportAt(p.x,p.z,this.colliders,previousY);if(p.y<=floor&&p.vy<=0){p.y=floor;p.vy=0;p.onGround=true;}else p.onGround=false;
  const maxHp=this.perks?.vitality?250:100;p.maxHealth=maxHp;
  if(!this.downed&&this.time-p.lastHit>6)p.health=Math.min(maxHp,p.health+dt*(this.perks?.vitality?18:9));
  for(let i=this.powerups.length-1;i>=0;i--){const pu=this.powerups[i];pu.life-=dt;if(Math.hypot(pu.x-p.x,pu.z-p.z)<1.45&&Math.abs(pu.y-.65-p.y)<1.4){this.applyPowerup(pu.type);this.powerups.splice(i,1);}else if(pu.life<=0)this.powerups.splice(i,1);}
  for(let i=this.projectiles.length-1;i>=0;i--){const pr=this.projectiles[i];pr.timer-=dt;pr.vy-=16*dt;pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;pr.z+=pr.vz*dt;const gFloor=floorAt(pr.x,pr.z)+.12;if(pr.y<gFloor){pr.y=gFloor;pr.vy=Math.abs(pr.vy)*.35;pr.vx*=.6;pr.vz*=.6;}if(pr.timer<=0){for(const e of this.enemies){if(e.dead)continue;const d=Math.hypot(e.x-pr.x,e.z-pr.z);if(d<5.5){const dmg=Math.round(240*(1-d/6));this.damageEnemy(e.id,dmg,false,{source:'explosive'});if(!e.dead&&d>1.8)this.makeCrawler(e.id);}}this.event('explosion',{x:pr.x,y:pr.y,z:pr.z,type:pr.type});this.projectiles.splice(i,1);}}
  if(this.decoy){this.decoy.timer-=dt;if(this.decoy.timer<=0){for(const e of this.enemies){if(!e.dead&&Math.hypot(e.x-this.decoy.x,e.z-this.decoy.z)<7.5)this.damageEnemy(e.id,700,false,{source:'explosive'});}this.event('explosion',{x:this.decoy.x,y:this.decoy.y,z:this.decoy.z,type:'monkey'});this.decoy=null;}}
  if(automatic){if(this.reloadTimer>0)this.fireTimer=Math.max(0,this.fireTimer);else while(this.fireTimer<=1e-8){if(!this.fire({carry:true,ads:!!input.ads})){this.fireTimer=Math.max(0,this.fireTimer);break;}}}
  else if(this.fireBufferedUntil>=this.time)this.fire({ads:!!input.ads});
  const navTarget=this.decoy??p;
  this.navTimer-=dt;if(this.navTimer<=0){const groundTarget=this.asset.stairRoute&&navTarget.y>1?this.asset.stairRoute.base:navTarget;this.nav.update(groundTarget.x,groundTarget.z);this.navTimer=.45;}
  const alive=this.enemies.filter(e=>!e.dead);
  if(this.intermission>0){this.intermission-=dt;if(this.intermission<=0)this.beginRound();}
  else if(this.toSpawn>0){this.spawnTimer-=dt;if(this.spawnTimer<=0&&alive.length<22){this.spawnEnemy();this.spawnTimer=Math.max(.45,1.3-this.round*.05);}}
  else if(alive.length===0){if(this.specialRound)this.spawnPowerup(p.x,p.z+1.8,'max_ammo',p.y);this.intermission=7;this.addPoints(150+this.round*25);this.event('roundClear',{round:this.round,special:this.specialRound});}
  for(const e of this.enemies){if(e.dead){e.deathTime+=dt;continue;}e.attack=Math.max(0,(e.attack??0)-dt);e.phase+=dt*e.speed*3.8;
    if(this.trapTimer>0&&Math.abs(e.x)<2.2&&Math.abs(e.z-22)<1.3){this.damageEnemy(e.id,9999,false,{source:'trap'});this.event('trapZap',{id:e.id,x:e.x,z:e.z});continue;}
    for(const b of this.barricades){if(b.planks>0&&Math.hypot(e.x-b.x,e.z-b.z)<1.2&&this.time>=(b.nextTearAt??0)){b.planks--;b.nextTearAt=this.time+1.8;this.event('barricadeTear',{id:b.id,planks:b.planks});}}
    if(e.action==='stagger'){if(this.time<e.actionUntil)continue;e.action='chase';}
    if(e.action==='windup'){if(this.time+1e-8<e.strikeAt)continue;const hit=!this.decoy&&canEnemyHit(e,p,this.colliders);if(hit)this.damagePlayer(22+Math.min(this.round,15)*.5,e);this.event(hit?'enemyStrike':'enemyMiss',{id:e.id,x:e.x,y:e.y+1.25,z:e.z});e.action='recover';e.actionStartedAt=this.time;e.actionUntil=this.time+ENEMY_ATTACK.recovery;e.strikeAt=undefined;if(this.state!=='playing')break;continue;}
    if(e.action==='recover'){if(this.time<e.actionUntil)continue;e.action='chase';}
    const routeTarget=stairTarget(this.asset.stairRoute,e,navTarget),tx=(routeTarget??navTarget).x,tz=(routeTarget??navTarget).z,dx=tx-e.x,dz=tz-e.z,dist=Math.hypot(dx,dz);
    if(!routeTarget&&!this.decoy&&dist<ENEMY_ATTACK.startRange&&Math.abs(p.y-e.y)<ENEMY_ATTACK.vertical&&clearLine(e.x,e.z,p.x,p.z,this.colliders,.05,e.y+1.1)){e.facing=Math.atan2(dx,dz);if(e.attack===0){e.action='windup';e.actionStartedAt=this.time;e.strikeAt=attackSlot(this.time,this.enemies);this.event('enemyWindup',{id:e.id,x:e.x,y:e.y+1.25,z:e.z,strikeAt:e.strikeAt});}continue;}
    let dir;if((routeTarget&&routeTarget!==this.asset.stairRoute?.base)||dist<14&&clearLine(e.x,e.z,tx,tz,this.colliders,.3,e.y+.05)){dir={x:dx/Math.max(.001,dist),z:dz/Math.max(.001,dist)};if(alive.length>=3&&dist>2.2&&dist<8.5){const flank=(e.id%2?1:-1)*.26;dir={x:dir.x-dir.z*flank,z:dir.z+dir.x*flank};}}else dir=this.nav.direction(e.x,e.z,tx,tz);
    let sx=0,sz=0;for(const other of alive){if(other===e)continue;const ox=e.x-other.x,oz=e.z-other.z,d=Math.hypot(ox,oz);if(d<.78&&d>.001){sx+=ox/d*(.78-d)*1.3;sz+=oz/d*(.78-d)*1.3;}}
    const vx=dir.x+sx,vz=dir.z+sz,n=Math.max(1,Math.hypot(vx,vz));move(e,vx/n*e.speed*dt,vz/n*e.speed*dt,this.colliders,.30,e.y,[{...p,radius:.28}]);const enemyFloor=supportAt(e.x,e.z,this.colliders,e.y);e.vy=(e.vy??0)-18*dt;e.y=Math.max(enemyFloor,e.y+e.vy*dt);if(e.y===enemyFloor)e.vy=0;if(Math.abs(vx)+Math.abs(vz)>.01)e.facing=Math.atan2(vx,vz);
  }
  this.enemies=this.enemies.filter(e=>!e.dead||e.deathTime<1.8);
 }
}
