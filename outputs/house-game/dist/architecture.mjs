// Use the exported mesh extents: the artist's navigation markers predate the final stair placement.
const box=row=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];row.positions.forEach((v,i)=>{const k=i%3;min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});return {min,max};};
const replaced=name=>name==='Entry wall left'||/^Bed (base|mattress|blanket|headboard)$/.test(name)||name==='Bedside cabinet';
export function integrateArchitecture(asset,data){
 if(!data)return;
 asset.objects=asset.objects.filter(r=>!replaced(r.name)&&!(r.roof&&r.roofZone?.[0]===-6.5));
 asset.colliders=asset.colliders.filter(r=>!replaced(r.name));
 const stairs=[];
 for(const row of data.mesh_components){
  const walkable=/^ENV_Stair_Tread_|^ENV_Upper_Floor_|^ENV_Tactical_Escape_Ledge$/.test(row.name);
  const solid=walkable||/^ENV_Upper_Parapet_/.test(row.name);
  if(!solid)continue;
  const {min,max}=box(row);
  asset.colliders.push({name:row.name,min:[min[0],min[2]],max:[max[0],max[2]],bottom:min[1],height:max[1],walkable,stair:row.name.startsWith('ENV_Stair_Tread_'),gate:false});
  if(row.name.startsWith('ENV_Stair_Tread_'))stairs.push({x:(min[0]+max[0])/2,y:max[1],z:(min[2]+max[2])/2});
 }
 stairs.sort((a,b)=>a.y-b.y);
 if(stairs.length){const first=stairs[0],last=stairs.at(-1);asset.stairRoute={base:{...first,y:.584,z:first.z+.8},steps:stairs,landing:{...last,y:3.8,z:last.z-.55}};}
}
export function stairTarget(route,enemy,target){
 if(route&&enemy.y>3.5&&target.y>3.5&&enemy.z>route.landing.z+.15&&Math.abs(enemy.x-route.base.x)<.8)return route.landing;
 if(!route||Math.abs(target.y-enemy.y)<.08)return null;
 if(target.y>enemy.y){
  if(enemy.y<.7&&(enemy.z>route.base.z+.35||enemy.z<route.steps[0].z-.3||Math.abs(enemy.x-route.base.x)>.45))return route.base;
  return route.steps.find(p=>p.y>enemy.y+.12)||route.landing;
 }
 if(enemy.y>3.55&&Math.hypot(enemy.x-route.landing.x,enemy.z-route.landing.z)>.5)return route.landing;
 return [...route.steps].reverse().find(p=>p.y<enemy.y-.12)||route.base;
}
