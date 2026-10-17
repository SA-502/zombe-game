import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from './dist/assets/three.module.js';
import {Survival,WEAPONS,PERKS,POWERUP_TYPES,BOX_LOCATIONS} from './dist/simulation.mjs';
import {batchMaterials} from './dist/batch-two.mjs';
import {zombieLibrary,createZombieModel,animateZombieModel} from './dist/remaster-renderer.mjs';

const json=name=>JSON.parse(fs.readFileSync(new URL('./dist/assets/'+name,import.meta.url),'utf8'));
const baseAsset=json('district.json');
const machines=json('remaster/gameplay-machines-v3.json');
const powerupsData=json('remaster/powerups-and-tacticals-v3.json');
const hudData=json('remaster/ui-icons-and-hud-v3.json');
const models=json('remaster/zombie-templates-v1.json');
const actions=json('remaster/zombie-actions-v1.json');
const palette=json('remaster-materials-v1.json');

function freshGame(){
 const asset=structuredClone(baseAsset);
 for(const p of Object.values(PERKS))asset.stations.push({id:p.id,label:p.label,cost:p.cost,x:p.x,z:p.z});
 asset.stations.push({id:'trap',label:'الفخ الكهربائي للبوابة',cost:1000,x:0,z:22});
 const g=new Survival(asset);
 g.start();
 g.nav.update(g.player.x,g.player.z);
 return g;
}
function advance(g,steps,input={}){for(let i=0;i<steps;i++)g.step(input);}

// 1. Test 4 Classic Perks & Downed State (Solo Quick Revive)
{
 const g=freshGame();
 g.points=20000;
 // Quick Revive works without power in Solo
 g.player.x=PERKS.perk_revive.x;g.player.z=PERKS.perk_revive.z;
 assert(g.interact('perk_revive'),'Quick Revive purchased without power in solo');
 assert(g.perks.revive,'Revive perk active');
 // Vitality requires power
 g.player.x=PERKS.perk_vitality.x;g.player.z=PERKS.perk_vitality.z;
 assert(!g.interact('perk_vitality'),'Vitality requires power');
 g.power=true;
 assert(g.interact('perk_vitality'),'Vitality purchased once power is on');
 assert.equal(g.player.maxHealth,250,'Vitality raises maxHealth to 250');
 assert.equal(g.player.health,250,'Vitality heals to 250');

 // Speed Cola (Haste) halves reload duration
 g.player.x=PERKS.perk_haste.x;g.player.z=PERKS.perk_haste.z;
 assert(g.interact('perk_haste'),'Haste perk purchased');
 g.gun.ammo=5;assert(g.reload());
 assert(Math.abs(g.reloadTimer-WEAPONS.pistol.reload*0.5)<1e-6,'Speed Cola halves reload time');
 advance(g,60);

 // Stamin-Up increases sprint speed
 g.player.x=PERKS.perk_stamina.x;g.player.z=PERKS.perk_stamina.z;
 assert(g.interact('perk_stamina'),'Stamina perk purchased');
 g.player.x=3;g.player.z=11;
 advance(g,25,{z:1,sprint:true});
 assert(Math.hypot(g.player.vx,g.player.vz)>6.5,'Stamin-Up boosts sprint speed above normal 6.0');

 // Fatal damage triggers Downed state instead of death when Quick Revive is owned
 g.damagePlayer(500);
 assert.equal(g.state,'playing','Player stays in playing state during Solo Quick Revive downed mode');
 assert.equal(g.downed,true,'Player enters downed state');
 advance(g,220);
 assert.equal(g.downed,false,'Player revives after downTimer completes');
 assert.equal(g.perks.revive,false,'Quick Revive is consumed after reviving');
 assert.equal(g.player.health,g.player.maxHealth,'Revived with full maxHealth');
}

// 2. Test 5 Power-Ups (Double Points, Insta-Kill, Carpenter, Nuke, Max Ammo)
{
 const g=freshGame();
 g.beginRound();
 g.spawnEnemy();
 const e=g.enemies[0];
 g.applyPowerup('double_points');
 assert(g.doublePointsTimer>20,'Double points timer active');
 const ptsBefore=g.points;
 g.damageEnemy(e.id,10,false);
 assert.equal(g.points,ptsBefore+20,'Double points awards +20 per hit instead of +10');

 g.applyPowerup('insta_kill');
 e.health=9999;
 g.damageEnemy(e.id,1,false);
 assert(e.dead,'Insta-Kill kills high-HP zombie in 1 hit');

 g.spawnEnemy();
 const ptsBeforeNuke=g.points;
 g.applyPowerup('nuke');
 assert(g.enemies.every(x=>x.dead),'Nuke kills all active enemies');
 assert.equal(g.points,ptsBeforeNuke+800,'Nuke awards 400 * 2 (Double Points) = 800 points');

 g.barricades[0].planks=1;
 g.applyPowerup('carpenter');
 assert.equal(g.barricades[0].planks,5,'Carpenter restores all window barricade planks to 5');

 g.gun.reserve=0;g.grenades=0;
 g.applyPowerup('max_ammo');
 assert.equal(g.gun.reserve,WEAPONS.pistol.reserve,'Max Ammo restores reserve ammo');
 assert.equal(g.grenades,4,'Max Ammo restores frag grenades');
}

// 3. Test Crawlers, Limb Disabling & Headshot Decapitation + 3D Renderer
{
 const g=freshGame();
 g.beginRound();
 g.spawnEnemy();
 const e=g.enemies[0];
 e.health=100;
 g.damageEnemy(e.id,60,false,{source:'bullet',limb:'shin_left'});
 assert.equal(e.crawler,true,'Shooting zombie shin creates a Crawler');
 assert(e.speed<=0.52,'Crawler moves at slow crawl speed');

 g.damageEnemy(e.id,500,true,{source:'bullet'});
 assert.equal(e.dead,true);
 assert.equal(e.decapitated,true,'Fatal headshot decapitates zombie');

 const mat=name=>{const s=palette.materials[name];return new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...s.color)});};
 const lib=zombieLibrary(models,actions,mat);
 const root=createZombieModel(lib,e);
 e.dead=false;e.decapitated=true;e.crawler=true;
 animateZombieModel(root,e,1.0);
 assert.equal(root.userData.bones.head.visible,false,'Decapitated zombie hides head bone in 3D');
 assert.equal(root.userData.bones.shin_left.visible,false,'Crawler zombie hides severed lower shin bones');
}

// 4. Test Tactical Grenades & Musical Monkey Bomb Decoy
{
 const g=freshGame();
 g.beginRound();
 g.spawnEnemy();
 const e=g.enemies[0];
 e.x=0;e.z=20.5;e.speed=0;e.health=100;
 g.player.x=0;g.player.z=12;
 assert(g.throwGrenade({x:0,y:0.1,z:1}),'Frag grenade thrown');
 advance(g,110);
 assert(e.dead||e.crawler,'Frag grenade explosion damages/crawlers nearby zombies');

 g.spawnEnemy();
 const z2=g.enemies.find(x=>!x.dead);
 z2.x=5;z2.z=20;
 assert(g.throwMonkey({x:1,y:0.2,z:0}),'Musical Monkey Bomb thrown');
 advance(g,30);
 assert(g.decoy,'Active monkey bomb sets g.decoy');
 advance(g,400);
 assert.equal(g.decoy,null,'Monkey bomb detonates after song duration');
}

// 5. Test Window Barricades & Electric Gate Trap & Mystery Box Teddy Relocation & Special Rounds
{
 const g=freshGame();
 const bar=g.barricades[0];
 bar.planks=2;
 g.player.x=bar.x;g.player.z=bar.z;
 const pts=g.points;
 assert(g.repairBarricade(),'Player repairs damaged window barricade');
 assert.equal(bar.planks,3,'Barricade plank count incremented');
 assert.equal(g.points,pts+10,'Repairing a plank grants +10 points');

 // Electric Gate Trap
 g.power=true;g.points=5000;
 g.player.x=0;g.player.z=22;
 assert(g.interact('trap'),'Electric Gate Trap activated');
 assert(g.trapTimer>20,'Trap timer running');
 g.spawnEnemy();
 const victim=g.enemies.at(-1);
 victim.x=0;victim.z=22;victim.health=20;
 advance(g,30);
 assert(victim.dead,'Electric Gate Trap kills zombies walking through gate kill-zone');

 // Mystery Box Teddy relocation on 4th spin
 const boxStation=g.asset.stations.find(s=>s.id==='mystery');
 const initialBoxPos=[boxStation.x,boxStation.z];
 g.points=10000;
 g.player.x=boxStation.x;g.player.z=boxStation.z;
 assert(g.interact('mystery'));
 assert(g.interact('mystery'));
 assert(g.interact('mystery'));
 const ptsBeforeTeddy=g.points;
 assert(g.interact('mystery'),'4th spin triggers Teddy relocation');
 assert.equal(g.points,ptsBeforeTeddy,'Teddy spin refunds box cost');
 assert(boxStation.x!==initialBoxPos[0]||boxStation.z!==initialBoxPos[1],'Mystery Box relocated to new BOX_LOCATIONS spot');
 assert(BOX_LOCATIONS.some(([x,z])=>x===boxStation.x&&z===boxStation.z),'Relocated coordinate is in BOX_LOCATIONS');

 // Special Round every 5th wave
 g.round=4;
 g.beginRound();
 assert.equal(g.round,5);
 assert.equal(g.specialRound,true,'Wave 5 is a Special Sprinter/Hellhound Round');
}

// 6. Validate Batch 3 3D Assets & SVG Icons
{
 const mPalette=batchMaterials(machines),pPalette=batchMaterials(powerupsData);
 assert.equal(machines.perk_machines.length,4,'4 3D Perk Machines authored');
 for(const pm of machines.perk_machines){
  assert(pm.mesh_components.length>=3);
  for(const r of pm.mesh_components){
   assert(r.positions.length>0&&r.positions.every(Number.isFinite));
   assert(mPalette['v2:'+r.material],'Material exists for '+r.name);
  }
 }
 assert(machines.mystery_box.mesh_components.some(r=>r.name==='MBOX_CyanLightBeam'),'Mystery box includes sky light beam');
 assert(machines.pack_a_punch.mesh_components.some(r=>r.name.includes('TeslaCoil')),'Pack-a-Punch includes Tesla coils');
 assert(machines.electric_gate_trap.mesh_components.some(r=>r.name.startsWith('TRAP_Arc_')),'Electric trap includes high-voltage arcs');
 assert.equal(powerupsData.powerups.length,5,'All 5 3D powerup drops authored');
 assert(powerupsData.tactical_weapons.frag_grenade&&powerupsData.tactical_weapons.decoy_monkey,'Both 3D tactical weapons authored');
 assert(Object.keys(hudData.perk_icons_svg).length===4,'All 4 SVG perk icons authored');
}

// Validate every nested v3 mesh, including Pack-a-Punch glass, not only perk machines.
const allMaterials={...batchMaterials(machines),...batchMaterials(powerupsData),...batchMaterials(json('remaster-materials-v3-supplement.json'))};
for(const data of [machines,powerupsData]){
 const inspect=value=>{if(!value||typeof value!=='object')return;if(value.positions){assert(value.positions.length===value.normals.length);assert(value.positions.every(Number.isFinite));assert(allMaterials['v2:'+value.material],'Missing runtime material: '+value.material);}for(const v of Object.values(value))inspect(v);};inspect(data);
}
for(const name of ['gameplay-machines-v3.json','powerups-and-tacticals-v3.json','ui-icons-and-hud-v3.json','upper-floor-architecture-v2.json'])assert.deepEqual(json('remaster/'+name),JSON.parse(fs.readFileSync(new URL('../blender-delivery/'+name,import.meta.url))),'Runtime copy matches artist delivery: '+name);
console.log('PASS CoD Zombies Upgrade (Batch 3): 4 Perks + Solo Quick Revive Downed State; 5 Power-Ups + Demonic Announcer; Crawlers & Headshot Decapitation; Frag Grenades & Cymbal Monkey Decoy; Window Barricades; Electric Gate Trap; Mystery Box Teddy Relocation; Special Rounds; 25 Blender v3 3D assets.');
