import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Survival,WEAPONS,weaponSpread,spreadPixels} from './dist/simulation.mjs';
import {move} from './dist/physics.mjs';
const asset=JSON.parse(fs.readFileSync(new URL('./dist/assets/district.json',import.meta.url)));
const fresh=()=>{const g=new Survival(asset,()=>.1);g.start();g.intermission=1e6;return g;};
const shots=g=>g.events.filter(e=>e.type==='shot');
const advance=(g,seconds,input={})=>{let remaining=seconds;while(remaining>1e-9){const dt=Math.min(1/60,remaining);g.stepFrame(dt,input);remaining-=dt;}};
const equipRifle=g=>{g.inventory.rifle=g.newGun('rifle');g.weapon='rifle';};

// Drive the same public frame entry point used by the browser; only remove
// magazine limits to isolate cadence from reloading and damage to the player.
const cadence=[];
for(const fps of [15,30,60,120]){
 const g=fresh();equipRifle(g);g.gun.ammo=1000;
 for(let i=0;i<fps*10;i++)g.stepFrame(1/fps,{fireHeld:true});
 cadence.push({fps,shots:shots(g).length});
 assert.equal(shots(g).length,96,'Cadence remains on the 0.105 second schedule at '+fps+' FPS');
 assert.equal(g.gun.ammo,1000-96,'Each scheduled shot consumes one bullet');
}
let g=fresh();equipRifle(g);g.gun.ammo=1000;let remaining=10,index=0;const jitter=[1/15,1/30,1/120,.12,1/60];
while(remaining>1e-9){const dt=Math.min(remaining,jitter[index++%jitter.length]);g.stepFrame(dt,{fireHeld:true});remaining-=dt;}
assert.equal(shots(g).length,96,'Uneven frame durations preserve automatic cadence');
g=fresh();equipRifle(g);advance(g,4);g.stepFrame(.05,{fireHeld:true});assert.equal(shots(g).length,1,'Idle time never banks a burst');advance(g,.5);assert.equal(shots(g).length,1,'Releasing primary stops automatic fire');
g=fresh();equipRifle(g);g.gun.ammo=1;g.stepFrame(.15,{fireHeld:true});assert.equal(shots(g).length,1);assert.equal(g.gun.ammo,0);assert(g.reloadTimer>0,'Empty magazine reloads without extra shots');

g=fresh();g.fireTimer=.1;g.stepFrame(.01,{firePressed:true,ads:true});assert.equal(shots(g).length,0);g.stepFrame(.1,{ads:true});assert.equal(shots(g).length,1,'Brief early press is retained until ready');assert(shots(g)[0].ads);advance(g,.5,{fireHeld:true});assert.equal(shots(g).length,1,'Holding a pistol never becomes automatic');
g=fresh();g.fireTimer=.3;g.stepFrame(.01,{firePressed:true});advance(g,.4);assert.equal(shots(g).length,0,'An old press expires instead of firing much later');
g=fresh();g.requestFire();g.clearTrigger();advance(g,.2);assert.equal(shots(g).length,0,'Pause clearing cancels queued input');
g=fresh();g.inventory.rifle=g.newGun('rifle');g.requestFire();g.switchWeapon('rifle');advance(g,.3);assert.equal(shots(g).length,0,'A queued pistol press cannot fire a switched weapon');
g=fresh();g.gun.ammo=0;g.reloadTimer=.05;g.stepFrame(.01,{firePressed:true});g.stepFrame(.06);assert.equal(shots(g).length,1,'Press just before reload completion fires once when loaded');assert.equal(g.gun.ammo,11);
g=fresh();g.stepFrame(.15,{firePressed:true});advance(g,.2);assert.equal(shots(g).length,1,'One frame edge is not repeated by internal substeps');

g=fresh();g.player.x=23;g.player.z=12;g.points=10000;g.inventory.rifle={ammo:45,reserve:315,level:1};g.weapon='rifle';const protectedRifle={...g.gun};assert(g.interact('mystery'));assert.equal(g.weapon,'shotgun');assert.deepEqual(g.inventory.rifle,protectedRifle,'Box never replaces an upgraded owned gun');assert.equal(g.points,9300);
const beforeInventory=structuredClone(g.inventory),beforePoints=g.points;assert(g.interact('mystery'),'Repeat box spin stays available for relocation');assert.equal(g.points,beforePoints-700);assert.deepEqual(g.inventory,beforeInventory);
for(const roll of [0,.49,.5,.999999]){const q=new Survival(asset,()=>roll);q.start();q.player.x=23;q.player.z=12;q.points=1000;assert(q.interact('mystery'));assert(q.inventory.rifle||q.inventory.shotgun);assert.equal(q.points,300);}

g=fresh();g.player.x=-5;g.player.z=16;g.points=1000;assert(!g.interact('ammo'));assert.equal(g.points,1000,'Full general ammo station does not charge');
equipRifle(g);g.gun.level=1;g.gun.ammo=45;g.gun.reserve=314;assert(g.interact('ammo'));assert.equal(g.points,650);assert.equal(g.gun.reserve,315);assert.equal(g.gun.level,1);assert.equal(g.inventory.pistol.ammo,12);assert(!g.interact('ammo'));assert.equal(g.points,650,'Repeated full purchase is rejected');
g.player.x=30;g.player.z=30;g.gun.reserve=300;const remotePoints=g.points;assert(!g.interact('ammo'));assert.equal(g.gun.reserve,300);assert.equal(g.points,remotePoints,'Refused remote purchase leaves inventory and points alone');

const enemy=(x=3,z=12)=>({id:1,x,z,y:.2,health:100,maxHealth:100,speed:0,attack:1000,dead:false,phase:0,facing:0});
g=fresh();g.enemies=[enemy()];advance(g,1,{z:1});assert(g.player.z<=11.42001,'Player cannot walk through a standing zombie');assert(Math.hypot(g.player.x-3,g.player.z-12)>=.58-1e-6);advance(g,1.5,{x:1,z:1});assert(g.player.z>12.5,'Player can move around the body');
g=fresh();g.enemies=[enemy()];g.player.vz=6;assert(g.slide());advance(g,.5);assert(g.player.z<=11.42001,'Fast slide cannot tunnel through a body');
g=fresh();g.enemies=[enemy()];g.enemies[0].dead=true;g.enemies[0].deathTime=0;advance(g,1,{z:1});assert(g.player.z>13,'Dead bodies do not trap the player');
let p={x:3,z:11};const overlapped=enemy(3.2,11);move(p,.1,0,asset.colliders,.28,.2,[overlapped]);assert.equal(p.x,3,'Cannot move deeper into existing overlap');move(p,-1,0,asset.colliders,.28,.2,[overlapped]);assert(p.x<2.1,'Existing overlap can separate freely');
p={x:3,z:11};move(p,0,3,asset.colliders,.28,2.0,[enemy()]);assert(p.z>13.5,'Bodies on another vertical level do not create invisible walls');
g=fresh();g.enemies=[enemy()];g.enemies[0].attack=0;g.stepFrame(.016);assert.equal(g.player.health,100,'Contact starts a readable windup');advance(g,.45);assert(g.player.health<100,'Body collision preserves delayed contact attacks');advance(g,.5,{z:-1});assert(g.player.z<10,'Player can retreat from contact');

const stationary={vx:0,vz:0,onGround:true,crouched:false,slideTime:0};
const base=weaponSpread(WEAPONS.rifle,stationary),moving=weaponSpread(WEAPONS.rifle,{...stationary,vx:6}),aimed=weaponSpread(WEAPONS.rifle,stationary,true),crouched=weaponSpread(WEAPONS.rifle,{...stationary,crouched:true}),sliding=weaponSpread(WEAPONS.rifle,{...stationary,vx:6,slideTime:.5}),airborne=weaponSpread(WEAPONS.rifle,{...stationary,onGround:false});
assert(moving>base&&aimed<base&&crouched<base&&sliding>moving&&airborne>base,'Movement and stance affect actual shot spread');
assert(Math.abs(spreadPixels(base,720,74)*2-spreadPixels(base,1440,74))<1e-8,'Reticle projects consistently with screen height');assert(spreadPixels(base,720,52)>spreadPixels(base,720,74),'Projection respects ADS field of view');
g=fresh();g.stepFrame(.016,{x:1,ads:true,firePressed:true});assert.equal(shots(g)[0].spread,g.getSpread(true),'Shot event carries the same spread used for the reticle');
console.log('PASS phase 1: '+cadence.map(c=>c.fps+'fps='+c.shots).join(', ')+' in 10s; buffered single presses; pause/switch clearing; protected purchases; body collision and escape; shared shot/reticle accuracy.');
