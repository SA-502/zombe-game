export const SPAWN={x:3,z:11};
export const BOUNDS=[-47.25,47.25,-25.25,73.25];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function blocked(x,z,colliders,radius=.28,feet=.2,bounds=BOUNDS){
  if(x<bounds[0]+radius||x>bounds[1]-radius||z<bounds[2]+radius||z>bounds[3]-radius)return true;
  return colliders.some(b=>{if(b.disabled||feet>=(b.height??4)-.045)return false;const cx=clamp(x,b.min[0],b.max[0]),cz=clamp(z,b.min[1],b.max[1]);return (x-cx)**2+(z-cz)**2<radius**2;});
}
export function move(position,dx,dz,colliders,radius=.28,feet=.2,bodies=[]){
  const bodyBlocked=(x,z)=>bodies.some(b=>{
    if(b===position||b.dead||feet>=(b.y??.2)+(b.height??1.65)||feet+1.65<=(b.y??.2))return false;
    const separation=radius+(b.radius??.30),next=(x-b.x)**2+(z-b.z)**2;
    if(next>=separation**2-1e-9)return false;
    const previous=(position.x-b.x)**2+(position.z-b.z)**2;
    // Existing overlap may separate, never deepen: no permanent collision lock.
    return previous>=separation**2-1e-9||next<previous-1e-9;
  });
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.10));
  for(let i=0;i<steps;i++){const x=position.x+dx/steps;if(!blocked(x,position.z,colliders,radius,feet)&&!bodyBlocked(x,position.z))position.x=x;const z=position.z+dz/steps;if(!blocked(position.x,z,colliders,radius,feet)&&!bodyBlocked(position.x,z))position.z=z;}return position;
}
export function floorAt(x,z){return x>-6.25&&x<6.25&&z>-1.8&&z<7.8?.584:.20;}
export function supportAt(x,z,colliders,feet){let y=floorAt(x,z);for(const c of colliders){if(c.disabled||c.height>feet+.10)continue;if(x>c.min[0]-.1&&x<c.max[0]+.1&&z>c.min[1]-.1&&z<c.max[1]+.1)y=Math.max(y,c.height);}return y;}
export function roomAt(x,z){if(z<8&&Math.abs(x)<9)return z<-1.8?'فناء الملجأ':'الملجأ';if(x>18&&z>36)return 'محطة الكهرباء';if(x<-15&&z>43)return 'مستودع القطارات';if(x<-17&&z>24)return 'العيادة';if(x>17&&z<20)return 'متجر الإمداد';if(Math.abs(x)<15&&z>29)return 'الساحة المركزية';return 'شارع الرماد';}
export function clearLine(ax,az,bx,bz,colliders,padding=.15){
 // Intersect the full segment: point sampling can skip thin walls at close range.
 const dx=bx-ax,dz=bz-az;
 for(const c of colliders){
  if(c.disabled||.2>=(c.height??4)-.045)continue;
  let enter=0,exit=1;
  for(const [a,d,min,max] of [[ax,dx,c.min[0]-padding,c.max[0]+padding],[az,dz,c.min[1]-padding,c.max[1]+padding]]){
   if(Math.abs(d)<1e-9){if(a<min||a>max){enter=2;break;}}
   else{const t1=(min-a)/d,t2=(max-a)/d;enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));if(enter>exit)break;}
  }
  if(enter<=exit&&exit>1e-6&&enter<1-1e-6)return false;
 }
 return true;
}
export class FlowField{
  constructor(colliders){this.colliders=colliders;this.minX=-48;this.minZ=-26;this.w=96;this.h=101;this.walls=new Uint8Array(this.w*this.h);this.distance=new Int32Array(this.w*this.h);this.queue=new Int32Array(this.w*this.h);this.rebuild();}
  index(x,z){const cx=Math.floor(x-this.minX),cz=Math.floor(z-this.minZ);return cx<0||cx>=this.w||cz<0||cz>=this.h?-1:cz*this.w+cx;}
  center(i){return {x:this.minX+i%this.w+.5,z:this.minZ+Math.floor(i/this.w)+.5};}
  rebuild(){for(let i=0;i<this.walls.length;i++){const p=this.center(i);this.walls[i]=blocked(p.x,p.z,this.colliders,.37)?1:0;}this.distance.fill(-1);}
  update(x,z){this.distance.fill(-1);let root=this.index(x,z);if(root<0)return;if(this.walls[root]){let best=-1,d=Infinity;for(let zz=-2;zz<=2;zz++)for(let xx=-2;xx<=2;xx++){const k=this.index(x+xx,z+zz);if(k<0||this.walls[k])continue;const p=this.center(k),v=Math.hypot(p.x-x,p.z-z);if(v<d){d=v;best=k;}}root=best;}if(root<0)return;let head=0,tail=0;this.queue[tail++]=root;this.distance[root]=0;while(head<tail){const i=this.queue[head++],cx=i%this.w;const neighbors=[cx>0?i-1:-1,cx<this.w-1?i+1:-1,i-this.w,i+this.w];for(const n of neighbors)if(n>=0&&n<this.walls.length&&!this.walls[n]&&this.distance[n]===-1){this.distance[n]=this.distance[i]+1;this.queue[tail++]=n;}}}
  direction(x,z,px,pz){const i=this.index(x,z);if(i<0)return {x:0,z:0};let best=i,bestD=this.distance[i]<0?Infinity:this.distance[i];for(const n of [i-1,i+1,i-this.w,i+this.w]){if(n<0||n>=this.distance.length||Math.abs(n%this.w-i%this.w)>1)continue;const d=this.distance[n];if(d>=0&&d<bestD){bestD=d;best=n;}}const p=best===i?{x:px,z:pz}:this.center(best);const dx=p.x-x,dz=p.z-z,len=Math.hypot(dx,dz);return len>.03?{x:dx/len,z:dz/len}:{x:0,z:0};}
}

