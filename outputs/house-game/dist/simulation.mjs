import {SPAWN,clamp,move,blocked,floorAt,supportAt,clearLine,FlowField} from './physics.mjs';
import {ENEMY_ATTACK,MELEE,meleeDamage,meleeTarget,canEnemyHit,attackSlot,spawnHidden} from './combat-rules.mjs';
export const WEAPONS={
 pistol:{name:'صقر 9',short:'FALCON 9',damage:34,clip:12,reserve:84,rate:.24,reload:1.35,pellets:1,spread:.012,range:58,recoil:.025,auto:false},
 rifle:{name:'نمر 47',short:'NIMR 47',damage:30,clip:30,reserve:210,rate:.105,reload:1.8,pellets:1,spread:.025,range:72,recoil:.016,auto:true},
 shotgun:{name:'رعد 12',short:'RAAD 12',damage:23,clip:6,reserve:48,rate:.78,reload:2.15,pellets:8,spread:.075,range:27,recoil:.075,auto:false}
};
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
 reset(){this.slideNoticeAt=-Infinity;this.view={x:0,z:1,fov:100};this.time=0;this.state='ready';this.player={...SPAWN,y:.2,vx:0,vz:0,vy:0,health:100,armor:0,stamina:100,onGround:true,crouched:false,lastHit:-99,slideTime:0,slideCooldown:0,slideX:0,slideZ:0};this.slideHeld=false;this.points=600;this.kills=0;this.headshots=0;this.round=0;this.totalSpawn=0;this.toSpawn=0;this.spawnTimer=0;this.intermission=7;this.enemies=[];this.enemySerial=0;this.inventory={pistol:this.newGun('pistol')};this.weapon='pistol';this.fireTimer=0;this.clearTrigger();this.reloadTimer=0;this.meleeTimer=0;this.power=false;this.gateOpen=false;this.navTimer=0;this.events=[];for(const c of this.colliders)c.disabled=false;this.nav.rebuild();this.event('reset');}
 newGun(id){const w=WEAPONS[id];return {ammo:w.clip,reserve:w.reserve,level:0};}
 start(){if(this.state==='ready'){this.state='playing';this.event('start');}}
 get gun(){return this.inventory[this.weapon];}
 get spec(){const w=WEAPONS[this.weapon];return {...w,damage:w.damage*(this.gun.level?2.1:1),clip:Math.round(w.clip*(this.gun.level?1.5:1)),reserve:Math.round(w.reserve*(this.gun.level?1.5:1))};}
 switchWeapon(id){if(!this.inventory[id]||id===this.weapon)return false;this.weapon=id;this.reloadTimer=0;this.fireTimer=.18;this.clearTrigger();this.event('switch');return true;}
 cycle(){const ids=Object.keys(this.inventory);this.switchWeapon(ids[(ids.indexOf(this.weapon)+1)%ids.length]);}
 reload(){if(this.reloadTimer>0||this.gun.ammo>=this.spec.clip||this.gun.reserve<=0||this.state!=='playing')return false;this.reloadTimer=this.spec.reload;this.event('reload');return true;}
 clearTrigger(){this.fireBufferedUntil=-Infinity;}
 requestFire(){if(this.state==='playing')this.fireBufferedUntil=this.time+.12;}
 getSpread(ads=false){return weaponSpread(this.spec,this.player,ads);}
 fire({carry=false,ads=false}={}){if(this.state!=='playing'||this.reloadTimer>0||this.fireTimer>1e-8)return null;if(this.gun.ammo<=0){this.reload();return null;}const spec=this.spec;this.gun.ammo--;this.fireTimer=(carry?this.fireTimer:0)+spec.rate;this.clearTrigger();this.event('shot',{weapon:this.weapon,spec,ads,spread:this.getSpread(ads)});return spec;}
 melee(aim=this.view??{x:0,z:1}){if(this.meleeTimer>0||this.state!=='playing')return false;this.meleeTimer=MELEE.cooldown;this.event('melee');const target=meleeTarget(this.player,this.enemies,aim,this.colliders);if(target)this.damageEnemy(target.id,meleeDamage(this.round),false,{source:'melee'});return true;}
 jump(){const p=this.player;if(this.state==='playing'&&p.onGround&&(!p.crouched||p.slideTime>0)&&p.stamina>10){p.slideTime=0;p.crouched=false;p.vy=6.2;p.onGround=false;p.stamina-=9;return true;}return false;}
 slide({notify=false}={}){const p=this.player,speed=Math.hypot(p.vx,p.vz);if(this.state!=='playing'||p.slideTime>0)return false;const reason=!p.onGround?'لا يمكن الانزلاق في الهواء':p.slideCooldown>0?'انتظر قليلًا قبل الانزلاق مجددًا':speed<4.2?'اركض أولًا ثم اضغط زر الانزلاق':p.stamina<18?'التحمل لا يكفي للانزلاق':null;if(reason){if(notify&&this.time>=(this.slideNoticeAt??-Infinity)){this.event('notice',{text:reason});this.slideNoticeAt=this.time+1.5;}return false;}p.slideTime=.78;p.slideCooldown=1.35;p.slideX=p.vx/speed;p.slideZ=p.vz/speed;p.stamina-=18;p.crouched=true;this.event('slide');return true;}
 damageEnemy(id,damage,head=false,{source='bullet',weapon=this.weapon}={}){const e=this.enemies.find(e=>e.id===id&&!e.dead);if(!e||!Number.isFinite(damage)||damage<=0)return false;e.health-=damage*(head?2.2:1);this.points+=10;this.event('hit',{id,head,source});if(e.health<=0){e.dead=true;e.deathTime=0;e.action='dead';this.kills++;if(head)this.headshots++;this.points+=source==='melee'?MELEE.killBonus:head?120:80;this.event('kill',{id,head,source});}
  else if((source==='melee'||head||weapon==='shotgun'&&damage>=18)&&this.time>=(e.staggerReadyAt??0)){e.action='stagger';e.actionStartedAt=this.time;e.actionUntil=this.time+(source==='melee'?.38:head?.28:.18);e.staggerReadyAt=this.time+1.1;e.strikeAt=undefined;e.attack=Math.max(e.attack??0,.2);this.event('enemyStagger',{id,head,source});}return true;}
 damagePlayer(damage,source=null){if(this.state!=='playing')return;const p=this.player;const absorbed=Math.min(p.armor,damage*.7);p.armor-=absorbed;p.health=Math.max(0,p.health-damage+absorbed);p.lastHit=this.time;this.event('hurt',{source:source?{id:source.id,x:source.x,y:source.y+1.25,z:source.z}:null});if(p.health<=0){this.state='dead';this.event('dead',{round:this.round,kills:this.kills});}}
 stationReachable(s){if(!s||Math.hypot(s.x-this.player.x,s.z-this.player.z)>2.7)return false;return !s.wall||(this.player.x-s.wall.x)*s.wall.normal[0]+(this.player.z-s.wall.z)*s.wall.normal[1]>.12;}
 offer(s){const owned=(s.id==='pistol'||s.id==='rifle'||s.id==='shotgun')&&this.inventory[s.id];return {cost:owned?Math.round(s.cost*.5):s.cost,label:owned?'ذخيرة '+WEAPONS[s.id].name:s.label,refill:!!owned};}
 interact(id){if(this.state!=='playing')return false;const s=this.asset.stations.find(s=>s.id===id);if(!this.stationReachable(s))return false;const offer=this.offer(s);
  if(id==='power'){if(this.power){this.event('notice',{text:'الكهرباء تعمل بالفعل'});return false;}this.power=true;this.event('power');return true;}
  if(id==='upgrade'&&!this.power){this.event('notice',{text:'شغّل الكهرباء في المحطة أولًا'});return false;}
  if(id==='gate'&&this.gateOpen){this.event('notice',{text:'البوابة مفتوحة'});return false;}
  if(id==='upgrade'&&this.gun.level){this.event('notice',{text:'هذا السلاح مطوّر بالكامل'});return false;}
  if(id==='armor'&&this.player.armor>=99){this.event('notice',{text:'الدرع ممتلئ'});return false;}
  const refillIds=id==='ammo'?Object.keys(this.inventory):offer.refill?[id]:[];
  if(refillIds.length&&!refillIds.some(weapon=>{const gun=this.inventory[weapon],factor=gun.level?1.5:1;return gun.ammo<Math.round(WEAPONS[weapon].clip*factor)||gun.reserve<Math.round(WEAPONS[weapon].reserve*factor);})){this.event('notice',{text:'الذخيرة ممتلئة · لم تُخصم نقاط'});return false;}
  let mysteryWeapon;if(id==='mystery'){const candidates=['rifle','shotgun'].filter(weapon=>!this.inventory[weapon]);if(!candidates.length){this.event('notice',{text:'تملك سلاحي الصندوق · استخدم محطة الذخيرة للتعبئة'});return false;}mysteryWeapon=candidates[Math.min(candidates.length-1,Math.floor(this.random()*candidates.length))];}
  if(this.points<offer.cost){this.event('notice',{text:'تحتاج '+offer.cost+' نقطة'});return false;}
  this.points-=offer.cost;
  if(id==='gate'){this.gateOpen=true;for(const c of this.colliders)if(c.gate)c.disabled=true;this.nav.rebuild();this.navTimer=0;this.event('gate');}
  else if(refillIds.length){for(const weapon of refillIds){const gun=this.inventory[weapon],factor=gun.level?1.5:1;gun.reserve=Math.round(WEAPONS[weapon].reserve*factor);gun.ammo=Math.round(WEAPONS[weapon].clip*factor);}if(refillIds.includes(this.weapon))this.reloadTimer=0;if(offer.refill)this.event('notice',{text:'تمت تعبئة الذخيرة مع الاحتفاظ بتطوير السلاح'});}
  else if(id==='armor')this.player.armor=100;
  else if(id==='upgrade'){this.gun.level=1;this.gun.ammo=this.spec.clip;this.gun.reserve=this.spec.reserve;this.event('upgrade');}
  else{const weapon=id==='mystery'?mysteryWeapon:id;if(!WEAPONS[weapon])return false;this.inventory[weapon]=this.newGun(weapon);this.weapon=weapon;this.reloadTimer=0;this.fireTimer=.18;this.clearTrigger();this.event('weapon',{weapon});}
  this.event('purchase',{id});return true;
 }
 nearestStation(){let chosen=null,dist=2.7;for(const s of this.asset.stations){if(s.id==='gate'&&this.gateOpen||!this.stationReachable(s))continue;const d=Math.hypot(s.x-this.player.x,s.z-this.player.z);if(d<dist){dist=d;chosen=s;}}return chosen;}
 beginRound(){this.round++;this.totalSpawn=Math.min(8+this.round*3,48);this.toSpawn=this.totalSpawn;this.spawnTimer=1.3;this.event('round',{round:this.round});}
 spawnEnemy(){const start=Math.floor(this.random()*SPAWNS.length);for(let n=0;n<SPAWNS.length;n++){const [sx,sz]=SPAWNS[(n+start)%SPAWNS.length];for(let attempt=0;attempt<12;attempt++){const x=sx+(this.random()-.5)*5,z=sz+(this.random()-.5)*5;if(!spawnHidden(x,z,this.player,this.view??{x:0,z:1,fov:100},this.colliders)||blocked(x,z,this.colliders,.34))continue;const i=this.nav.index(x,z);if(i<0||this.nav.distance[i]<0)continue;const hp=80+this.round*18;this.enemies.push({id:++this.enemySerial,x,z,y:floorAt(x,z),health:hp,maxHealth:hp,speed:Math.min(.9+this.round*.115,2.75)*(this.random()*.24+.88),attack:0,action:'chase',staggerReadyAt:0,dead:false,phase:this.random()*6,facing:0});this.toSpawn--;return true;}}return false;}
 stepFrame(elapsed,input={}){elapsed=clamp(elapsed,0,.15);const steps=Math.max(1,Math.ceil(elapsed/.05));for(let i=0;i<steps;i++)this.update(elapsed/steps,{...input,firePressed:i===0&&!!input.firePressed});}
 update(dt,input={}){if(this.state!=='playing')return;dt=clamp(dt,0,.06);this.time+=dt;if(Number.isFinite(input.viewX)&&Number.isFinite(input.viewZ)&&Math.hypot(input.viewX,input.viewZ)>.001)this.view={x:input.viewX,z:input.viewZ,fov:clamp(input.viewFov??100,30,175)};const automatic=!!input.fireHeld&&this.spec.auto;this.fireTimer=automatic?this.fireTimer-dt:Math.max(0,this.fireTimer-dt);this.meleeTimer=Math.max(0,this.meleeTimer-dt);if(input.firePressed)this.requestFire();
  if(this.reloadTimer>0){this.reloadTimer=Math.max(0,this.reloadTimer-dt);if(this.reloadTimer===0){const amount=Math.min(this.spec.clip-this.gun.ammo,this.gun.reserve);this.gun.ammo+=amount;this.gun.reserve-=amount;this.event('loaded');}}
  const p=this.player;let ix=input.x||0,iz=input.z||0;const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}p.slideCooldown=Math.max(0,p.slideCooldown-dt);
  const slidePressed=!!input.crouch||!!input.slide;if(slidePressed&&!this.slideHeld&&input.sprint)this.slide({notify:true});this.slideHeld=slidePressed;
  const sliding=p.slideTime>0;p.crouched=sliding||!!input.crouch;const sprint=!!input.sprint&&p.stamina>1&&len>.1&&!p.crouched&&!input.ads;
  if(sliding){p.slideTime=Math.max(0,p.slideTime-dt);const speed=3.1+5.3*p.slideTime/.78;p.vx=p.slideX*speed;p.vz=p.slideZ*speed;}
  else{const speed=p.crouched?1.65:input.ads?2.2:sprint?6:3.6;const smoothing=1-Math.exp(-dt*(p.onGround?14:5));p.vx+=(ix*speed-p.vx)*smoothing;p.vz+=(iz*speed-p.vz)*smoothing;}
  if(sprint)p.stamina=Math.max(0,p.stamina-dt*23);else if(!sliding)p.stamina=Math.min(100,p.stamina+dt*16);
  move(p,p.vx*dt,p.vz*dt,this.colliders,.28,p.y,this.enemies);
  const previousY=p.y;p.vy-=18*dt;p.y+=p.vy*dt;const floor=supportAt(p.x,p.z,this.colliders,previousY);if(p.y<=floor&&p.vy<=0){p.y=floor;p.vy=0;p.onGround=true;}else p.onGround=false;
  if(this.time-p.lastHit>6)p.health=Math.min(100,p.health+dt*9);
  if(automatic){if(this.reloadTimer>0)this.fireTimer=Math.max(0,this.fireTimer);else while(this.fireTimer<=1e-8){if(!this.fire({carry:true,ads:!!input.ads})){this.fireTimer=Math.max(0,this.fireTimer);break;}}}
  else if(this.fireBufferedUntil>=this.time)this.fire({ads:!!input.ads});
  this.navTimer-=dt;if(this.navTimer<=0){this.nav.update(p.x,p.z);this.navTimer=.45;}
  const alive=this.enemies.filter(e=>!e.dead);
  if(this.intermission>0){this.intermission-=dt;if(this.intermission<=0)this.beginRound();}
  else if(this.toSpawn>0){this.spawnTimer-=dt;if(this.spawnTimer<=0&&alive.length<22){this.spawnEnemy();this.spawnTimer=Math.max(.45,1.3-this.round*.05);}}
  else if(alive.length===0){this.intermission=7;this.points+=150+this.round*25;this.event('roundClear',{round:this.round});}
  for(const e of this.enemies){if(e.dead){e.deathTime+=dt;continue;}e.attack=Math.max(0,(e.attack??0)-dt);e.phase+=dt*e.speed*3.8;
    if(e.action==='stagger'){if(this.time<e.actionUntil)continue;e.action='chase';}
    if(e.action==='windup'){if(this.time+1e-8<e.strikeAt)continue;const hit=canEnemyHit(e,p,this.colliders);if(hit)this.damagePlayer(22+Math.min(this.round,15)*.5,e);this.event(hit?'enemyStrike':'enemyMiss',{id:e.id,x:e.x,y:e.y+1.25,z:e.z});e.action='recover';e.actionStartedAt=this.time;e.actionUntil=this.time+ENEMY_ATTACK.recovery;e.strikeAt=undefined;if(this.state!=='playing')break;continue;}
    if(e.action==='recover'){if(this.time<e.actionUntil)continue;e.action='chase';}
    const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz);if(dist<ENEMY_ATTACK.startRange&&Math.abs(p.y-e.y)<ENEMY_ATTACK.vertical&&clearLine(e.x,e.z,p.x,p.z,this.colliders,.05)){e.facing=Math.atan2(dx,dz);if(e.attack===0){e.action='windup';e.actionStartedAt=this.time;e.strikeAt=attackSlot(this.time,this.enemies);this.event('enemyWindup',{id:e.id,x:e.x,y:e.y+1.25,z:e.z,strikeAt:e.strikeAt});}continue;}
    let dir;if(dist<14&&clearLine(e.x,e.z,p.x,p.z,this.colliders,.3)){dir={x:dx/dist,z:dz/dist};}else dir=this.nav.direction(e.x,e.z,p.x,p.z);
    let sx=0,sz=0;for(const other of alive){if(other===e)continue;const ox=e.x-other.x,oz=e.z-other.z,d=Math.hypot(ox,oz);if(d<.78&&d>.001){sx+=ox/d*(.78-d)*1.3;sz+=oz/d*(.78-d)*1.3;}}
    const vx=dir.x+sx,vz=dir.z+sz,n=Math.max(1,Math.hypot(vx,vz));move(e,vx/n*e.speed*dt,vz/n*e.speed*dt,this.colliders,.30,.2,[{...p,radius:.28}]);e.y=floorAt(e.x,e.z);if(Math.abs(vx)+Math.abs(vz)>.01)e.facing=Math.atan2(vx,vz);
  }
  this.enemies=this.enemies.filter(e=>!e.dead||e.deathTime<1.8);
 }
}
