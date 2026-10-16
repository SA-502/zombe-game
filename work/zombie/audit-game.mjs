import fs from 'node:fs';
import {Survival,WEAPONS} from '../../outputs/house-game/dist/simulation.mjs';
import {CombatInput} from '../../outputs/house-game/dist/input.mjs';
const asset=JSON.parse(fs.readFileSync(new URL('../../outputs/house-game/dist/assets/district.json',import.meta.url)));
function fresh(){const g=new Survival(asset,()=>.1);g.start();g.intermission=1e6;return g;}
const results={};
let g=fresh();g.player.x=23;g.player.z=12;g.points=10000;g.inventory.rifle={ammo:45,reserve:315,level:1};g.weapon='rifle';const before={...g.gun};g.interact('mystery');results.mysteryDuplicate={before,after:{...g.gun},cost:10000-g.points};
g=fresh();g.player.x=-5;g.player.z=16;g.points=1000;const ammoBefore={...g.gun};const purchased=g.interact('ammo');results.fullAmmoCharge={purchased,before:ammoBefore,after:{...g.gun},charged:1000-g.points};
g=fresh();g.inventory.rifle=g.newGun('rifle');g.weapon='rifle';g.gun.ammo=1000;g.gun.reserve=1000;
results.automaticFire=[];
for(const fps of [15,30,60,120]){const q=fresh();q.inventory.rifle=q.newGun('rifle');q.weapon='rifle';q.gun.ammo=1000;const dt=1/fps;let shots=0;for(let i=0;i<fps*10;i++){const n=Math.ceil(dt/.05);for(let k=0;k<n;k++)q.update(dt/n);if(q.fire())shots++;}results.automaticFire.push({fps,shotsIn10Seconds:shots});}
g=fresh();g.fireTimer=.1;const input=new CombatInput();input.setButtons(1);const request=input.consumeShot();const shot=request?g.fire():null;g.update(.06);g.update(.06);results.earlySemiAutoClick={request,shot:!!shot,requestAfterCooldown:input.consumeShot(),ammo:g.gun.ammo};
g=fresh();g.enemies=[{id:1,x:3,z:12,y:.2,health:100,maxHealth:100,speed:0,attack:1000,dead:false,phase:0,facing:0}];let min=Infinity;for(let i=0;i<60;i++){g.update(1/60,{z:1});min=Math.min(min,Math.hypot(g.player.x-g.enemies[0].x,g.player.z-g.enemies[0].z));}results.playerBodyPass={enemyZ:12,playerEndZ:g.player.z,minimumDistance:min};
results.balance={playerWalk:3.6,playerSprint:6,maximumEnemySpeed:2.75*1.12,round1EnemyHealth:98,round30EnemyHealth:620,round100EnemyHealth:1880,round1AttacksToKillPlayer:Math.ceil(100/22.5),activeEnemyCap:22,roundEnemyCap:48,ammoStationAllWeaponsPrice:350,rifleWallRefill:450,shotgunWallRefill:700,firstPistolBodyShots:Math.ceil(98/34),firstRifleBodyShots:Math.ceil(98/30)};
results.weaponDamage=Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,{body:w.damage,head:w.damage*2.2,upgradedBody:w.damage*2.1,upgradedHead:w.damage*2.1*2.2}]));
fs.writeFileSync(new URL('./audit-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
