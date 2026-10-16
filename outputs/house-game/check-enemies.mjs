import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Survival} from './dist/simulation.mjs';
import {ENEMY_ATTACK,MELEE,meleeDamage,spawnHidden} from './dist/combat-rules.mjs';
const asset=JSON.parse(fs.readFileSync(new URL('./dist/assets/district.json',import.meta.url)));
const fresh=()=>{const g=new Survival(asset,()=>.1);g.start();g.intermission=1e6;return g;};
const enemy=(id=1,x=3,z=12)=>({id,x,z,y:.2,health:500,maxHealth:500,speed:0,attack:0,action:'chase',dead:false,phase:0,facing:0});
const advance=(g,seconds,input={},fps=60)=>{let remaining=seconds;while(remaining>1e-9){const dt=Math.min(1/fps,remaining);g.stepFrame(dt,input);remaining-=dt;}};
const count=(g,type)=>g.events.filter(e=>e.type===type).length;

let g=fresh();g.enemies=[enemy()];g.stepFrame(1/60);assert.equal(g.player.health,100);assert.equal(count(g,'enemyWindup'),1);advance(g,.39);assert.equal(g.player.health,100,'No damage before windup finishes');advance(g,.04);assert(g.player.health<100);assert.equal(count(g,'enemyStrike'),1);const health=g.player.health;advance(g,.5);assert.equal(g.player.health,health,'Recovery cannot deal a second hit');assert(g.events.find(e=>e.type==='hurt').source.id===1,'Damage records the source for directional sound');
g=fresh();g.enemies=[enemy(1,3,12.35)];g.enemies[0].speed=1;advance(g,1);assert(g.player.health<100,'A chasing enemy approaches into actual reach instead of repeatedly missing just outside it');

for(const escape of ['retreat','behind','wall','height']){
 g=fresh();g.enemies=[enemy()];advance(g,.1);
 if(escape==='retreat')advance(g,.5,{z:-1});
 if(escape==='behind'){g.player.z=13;advance(g,.5);}
 if(escape==='wall'){g.colliders.push({min:[2,11.4],max:[4,11.6],height:4});advance(g,.5);}
 if(escape==='height'){g.enemies[0].y=-2;advance(g,.5);}
 assert.equal(g.player.health,100,'Committed attack misses after '+escape);assert.equal(count(g,'enemyMiss'),1);
}

g=fresh();g.enemies=[enemy()];advance(g,.1);g.damageEnemy(1,1e4);advance(g,.5);assert.equal(g.player.health,100,'Killing during windup cancels the pending strike');
g=fresh();g.enemies=[enemy()];advance(g,.1);g.damageEnemy(1,10,true);assert.equal(g.enemies[0].action,'stagger');advance(g,.35);assert.equal(g.player.health,100,'A headshot interrupts the pending attack');assert.equal(count(g,'enemyStagger'),1);g.damageEnemy(1,10,true);assert.equal(count(g,'enemyStagger'),1,'Repeated headshots cannot permanently stagger');advance(g,.8);g.damageEnemy(1,10,true);assert.equal(count(g,'enemyStagger'),2,'Stagger becomes available after its cooldown');
g=fresh();g.enemies=[enemy()];advance(g,.1);g.damageEnemy(1,10,false,{weapon:'rifle'});assert.equal(g.enemies[0].action,'windup','Ordinary body hits cannot cancel every attack');advance(g,.4);assert(g.player.health<100);
g=fresh();g.enemies=[enemy()];advance(g,.1);g.damageEnemy(1,23,false,{weapon:'shotgun'});assert.equal(g.enemies[0].action,'stagger','Close shotgun impact staggers');g.damageEnemy(1,23,false,{weapon:'shotgun'});assert.equal(count(g,'enemyStagger'),1,'Multiple pellets share one stagger cooldown');

g=fresh();g.enemies=[enemy(1,3,12),enemy(2,4,11),enemy(3,3,10),enemy(4,2,11)];g.player.health=1000;g.stepFrame(1/60);const times=g.enemies.map(e=>e.strikeAt).sort((a,b)=>a-b);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=ENEMY_ATTACK.spacing-1e-8,'Crowd impacts are separated');advance(g,.9);assert.equal(count(g,'enemyStrike'),4,'Every crowd member can still land a hit');assert(g.player.health<920,'Spacing grants no blanket damage immunity');
const firstHits=[];for(const fps of [15,30,60,120]){g=fresh();g.enemies=[enemy()];let hitTime=0;for(let i=0;i<fps*2;i++){g.stepFrame(1/fps);if(g.player.health<100){hitTime=g.time;break;}}assert(hitTime>=ENEMY_ATTACK.windup&&hitTime<ENEMY_ATTACK.windup+.11);firstHits.push({fps,time:Number(hitTime.toFixed(3))});}

g=fresh();g.enemies=[enemy(1,3,12.7),enemy(2,3,12)];assert(g.melee({x:0,z:1}));assert.equal(g.enemies[0].health,500);assert.equal(g.enemies[1].health,390,'Melee selects the nearest target, independent of array order');const after=g.enemies[1].health;assert(!g.melee({x:0,z:1}));assert.equal(g.enemies[1].health,after,'One press cannot hit again during cooldown');
for(const miss of ['range','behind','wall','height','invalidAim']){g=fresh();g.enemies=[enemy()];if(miss==='range')g.enemies[0].z=13;if(miss==='behind')g.enemies[0].z=10;if(miss==='wall')g.colliders.push({min:[2,11.4],max:[4,11.6],height:4});if(miss==='height')g.enemies[0].y=3;g.melee(miss==='invalidAim'?{x:NaN,z:1}:{x:0,z:1});assert.equal(g.enemies[0].health,500,'Melee respects '+miss);}
g=fresh();g.enemies=[enemy()];g.enemies[0].health=98;g.melee({x:0,z:1});assert.equal(g.points,600+10+MELEE.killBonus);assert.equal(g.kills,1);assert.equal(g.headshots,0);assert.equal(g.events.find(e=>e.type==='kill').source,'melee');
assert(meleeDamage(2)>meleeDamage(1)&&meleeDamage(100)===meleeDamage(9),'Melee scales modestly then caps');
g=fresh();g.round=2;g.enemies=[enemy()];g.enemies[0].health=116;g.melee({x:0,z:1});assert(g.enemies[0].dead,'Early-wave melee remains useful');
g=fresh();g.round=9;g.enemies=[enemy()];g.enemies[0].health=242;g.melee({x:0,z:1});assert(!g.enemies[0].dead,'Late-wave melee remains a risk rather than a universal one-hit kill');
g=fresh();g.enemies=[enemy()];const before=g.enemies[0].health;assert(!g.damageEnemy(1,NaN));assert(!g.damageEnemy(1,-20));assert.equal(g.enemies[0].health,before);

const p={x:0,z:0},view={x:0,z:1,fov:90};
assert(!spawnHidden(0,20,p,view,[]),'No spawn in a clear forward view');assert(spawnHidden(0,-20,p,view,[]),'An unseen location behind the player is eligible');assert(!spawnHidden(0,-10,p,view,[]),'Minimum distance also applies behind the player');assert(spawnHidden(0,20,p,view,[{min:[-3,8],max:[3,9],height:4}]),'Occluding world geometry permits a hidden spawn');assert(!spawnHidden(20,20,p,{...view,fov:140},[]),'Spawn visibility accounts for a wide horizontal field of view');
g=fresh();g.beginRound();g.nav.update(g.player.x,g.player.z);assert(g.spawnEnemy());for(const e of g.enemies)assert(spawnHidden(e.x,e.z,g.player,g.view,g.colliders));
g=fresh();g.beginRound();g.nav.update(g.player.x,g.player.z);g.nav.distance.fill(-1);const pending=g.toSpawn;assert(!g.spawnEnemy());assert.equal(g.toSpawn,pending,'A failed spawn neither consumes quota nor forces a visible fallback');
g.view={x:1,z:0,fov:175};g.reset();assert.deepEqual(g.view,{x:0,z:1,fov:100},'Restart resets the previous camera view');
for(const reason of ['speed','air','cooldown','stamina']){g=fresh();g.player.vz=6;if(reason==='speed')g.player.vz=0;if(reason==='air')g.player.onGround=false;if(reason==='cooldown')g.player.slideCooldown=1;if(reason==='stamina')g.player.stamina=10;assert(!g.slide({notify:true}));assert.equal(count(g,'notice'),1,'A failed slide explains '+reason);g.slide({notify:true});assert.equal(count(g,'notice'),1,'Repeated slide attempts do not spam notices');g.reset();g.start();g.slide({notify:true});assert.equal(count(g,'notice'),1,'Restart resets notice throttling');}
console.log('PASS enemy combat: delayed attacks '+JSON.stringify(firstHits)+'; retreat/behind/wall/height misses; kill and stagger interrupts; bounded stagger; separated crowd impacts without immunity; melee targeting/rewards/scaling; hidden connected spawns.');
