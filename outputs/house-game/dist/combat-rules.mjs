import {clearLine} from './physics.mjs';

export const ENEMY_ATTACK={startRange:1.2,hitRange:1.25,windup:.42,recovery:.68,spacing:.12,vertical:1.35};
export const MELEE={range:1.85,cone:.65,cooldown:.8,killBonus:130};

export function meleeDamage(round){return 110+Math.min(8,Math.max(0,round-1))*8;}

export function meleeTarget(player,enemies,aim,colliders){
 const length=Math.hypot(aim.x,aim.z);
 if(!Number.isFinite(length)||length<.001)return null;
 let target=null,nearest=MELEE.range;
 for(const e of enemies){
  if(e.dead||Math.abs(e.y-player.y)>1.2)continue;
  const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz);
  if(d>nearest||(d>.001&&(dx*aim.x+dz*aim.z)/(d*length)<MELEE.cone))continue;
  if(!clearLine(player.x,player.z,e.x,e.z,colliders,.05,player.y+1.1))continue;
  nearest=d;target=e;
 }
 return target;
}

export function canEnemyHit(enemy,player,colliders){
 const dx=player.x-enemy.x,dz=player.z-enemy.z,d=Math.hypot(dx,dz);
 return d<=ENEMY_ATTACK.hitRange&&Math.abs(player.y-enemy.y)<ENEMY_ATTACK.vertical&&
  (d<.001||(Math.sin(enemy.facing)*dx+Math.cos(enemy.facing)*dz)/d>.35)&&
  clearLine(enemy.x,enemy.z,player.x,player.z,colliders,.05,enemy.y+1.1);
}

// Reserve impact times, rather than granting the player blanket invulnerability.
// A crowd remains dangerous, but its first attacks cannot all land at once.
export function attackSlot(time,enemies){
 let at=time+ENEMY_ATTACK.windup;
 const reservations=enemies.filter(e=>!e.dead&&e.action==='windup'&&Number.isFinite(e.strikeAt)).map(e=>e.strikeAt).sort((a,b)=>a-b);
 for(const other of reservations)if(Math.abs(at-other)<ENEMY_ATTACK.spacing-1e-8)at=other+ENEMY_ATTACK.spacing;
 return at;
}

export function spawnHidden(x,z,player,view,colliders){
 const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz);
 if(d<15)return false;
 if(!clearLine(player.x,player.z,x,z,colliders,.05,player.y+1.1))return true;
 // Include a margin beyond the rendered field of view. No visible pop-in fallback.
 const length=Math.hypot(view.x,view.z);
 const halfAngle=Math.min(Math.PI*.95,(view.fov??100)*Math.PI/360+Math.PI/18);
 return length>.001&&(dx*view.x+dz*view.z)/(d*length)<Math.cos(halfAngle);
}
