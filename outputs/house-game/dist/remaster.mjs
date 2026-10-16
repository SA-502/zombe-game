const mix=(a,b,t)=>a+(b-a)*t;
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const VARIANT_SCALES={walker:[1,1,1],runner:[.86,.96,.86],heavy:[1.2,1.06,1.2]};
export const variantFor=id=>['walker','runner','heavy'][(Math.max(1,id)-1)%3];

export function validateRemaster(models,actions,fp,materials){
 const bones=new Set(actions.rig.map(b=>b.id));
 const checkRows=rows=>{for(const r of rows){if(!r.positions.length||r.positions.length%9||r.positions.length!==r.normals.length||!r.positions.every(Number.isFinite)||!r.normals.every(Number.isFinite))throw Error('Invalid mesh '+r.name);if(!materials[r.material])throw Error('Missing Blender material '+r.material);}};
 for(const id of Object.keys(VARIANT_SCALES)){const rows=models.templates[id];if(!rows?.length)throw Error('Missing variant '+id);checkRows(rows);if(rows.some(r=>!bones.has(r.bone)))throw Error('Unknown bone in '+id);}
 checkRows(fp.mesh_components);
 for(const name of ['muzzle_point','iron_sight_rear','iron_sight_front'])if(!fp.sockets[name]?.every(Number.isFinite))throw Error('Missing socket '+name);
 const visited=new Set();for(const b of actions.rig){if(b.parent&&!visited.has(b.parent))throw Error('Rig order '+b.id);visited.add(b.id);}
 for(const [name,c] of Object.entries(actions.clips)){if(!(c.duration>0)||!c.frames.length)throw Error('Invalid clip '+name);let last=-1;for(const f of c.frames){if(f.time<last)throw Error('Unsorted clip '+name);last=f.time;for(const [id,p]of Object.entries(f.bones)){if(!bones.has(id)||p.rot&&!p.rot.every(Number.isFinite)||p.pos&&!p.pos.every(Number.isFinite))throw Error('Invalid track '+name);}}}
 const attack=actions.clips.zombie_attack;if(!attack||!attack.frames.some(f=>f.is_hit_frame&&Math.abs(f.time-attack.hit_time)<1e-4))throw Error('Missing attack contact marker');
 return true;
}

export function restPose(rig,scale=[1,1,1]){
 return Object.fromEntries(rig.map(b=>{const parent=rig.find(p=>p.id===b.parent);return [b.id,{rot:[0,0,0],pos:b.pivot.map((v,i)=>(v-(parent?.pivot[i]??0))*scale[i])}];}));
}

export function samplePose(clip,time,rig,scale=[1,1,1]){
 const pose=restPose(rig,scale);time=clip.loop?((time%clip.duration)+clip.duration)%clip.duration:clamp(time,0,clip.duration);
 let low=0,high=clip.frames.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(clip.frames[mid].time<=time)low=mid;else high=mid-1;}
 const a=clip.frames[low],b=clip.frames[Math.min(low+1,clip.frames.length-1)],t=b.time>a.time?clamp((time-a.time)/(b.time-a.time),0,1):0;
 for(const bone of rig){const from=a.bones[bone.id],to=b.bones[bone.id]??from;if(!from)continue;if(from.rot)pose[bone.id].rot=from.rot.map((v,i)=>angle(v,to.rot?.[i]??v,t));if(from.pos)pose[bone.id].pos=from.pos.map((v,i)=>mix(v,to.pos?.[i]??v,t)*scale[i]);}
 return pose;
}

export function blendPose(a,b,t){return Object.fromEntries(Object.keys(b).map(id=>[id,{rot:b[id].rot.map((v,i)=>angle(a[id].rot[i],v,t)),pos:b[id].pos.map((v,i)=>mix(a[id].pos[i],v,t))}]));}

export function clipState(enemy,time,clips,travel=0){
 const started=enemy.actionStartedAt??time,elapsed=Math.max(0,time-started);
 if(enemy.dead)return {name:'zombie_death_forward',time:enemy.deathTime};
 if(enemy.action==='windup')return {name:'zombie_attack',time:clips.zombie_attack.hit_time*clamp(elapsed/Math.max(.001,enemy.strikeAt-started),0,1)};
 if(enemy.action==='recover'){const c=clips.zombie_attack;return {name:'zombie_attack',time:c.hit_time+(c.duration-c.hit_time)*clamp(elapsed/Math.max(.001,enemy.actionUntil-started),0,1)};}
 if(enemy.action==='stagger')return {name:'zombie_hit_head',time:clips.zombie_hit_head.duration*clamp(elapsed/Math.max(.001,enemy.actionUntil-started),0,1)};
 const running=variantFor(enemy.id)==='runner';return travel>1e-5?{name:running?'zombie_run':'zombie_walk',time:travel/(running?1.3:.95)*clips[running?'zombie_run':'zombie_walk'].duration}:{name:'zombie_idle',time};
}
