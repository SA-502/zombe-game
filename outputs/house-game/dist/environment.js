import * as THREE from './assets/three.module.js';

// Procedural surfaces keep the district self-contained, without external art downloads.
const textureCache=new Map();
let seed=901;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function surface(kind){
 if(textureCache.has(kind))return textureCache.get(kind);
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle=kind==='brick'?'#50504b':'#d1d0c9';ctx.fillRect(0,0,512,512);
 if(kind==='brick'){
  const h=64,w=128;for(let row=-1;row<9;row++)for(let col=-1;col<5;col++){
   const x=col*w+(row%2)*w/2,y=row*h,v=170+rnd()*65;
   ctx.fillStyle=`rgb(${v},${v*.97},${v*.91})`;ctx.fillRect(x+3,y+3,w-6,h-6);
   ctx.fillStyle='#ffffff16';ctx.fillRect(x+4,y+4,w-8,3);ctx.fillStyle='#11150f66';ctx.fillRect(x+4,y+h-7,w-7,4);
   for(let i=0;i<8;i++){ctx.fillStyle=rnd()>.5?'#211b1425':'#ffffff18';ctx.fillRect(x+rnd()*w,y+rnd()*h,2+rnd()*20,1+rnd()*7);}
  }
 }else if(kind==='wood'){
  ctx.fillStyle='#b5b2a4';ctx.fillRect(0,0,512,512);for(let i=0;i<260;i++){const x=rnd()*512;ctx.strokeStyle=rnd()>.5?'#171b153d':'#ffffff24';ctx.lineWidth=.5+rnd()*2;ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<520;y+=35)ctx.lineTo(x+Math.sin(y*.018+i)*rnd()*8,y);ctx.stroke();}
  for(let x=0;x<512;x+=128){ctx.fillStyle='#292c2288';ctx.fillRect(x,0,3,512);}
 }else if(kind==='stone'){
  ctx.strokeStyle='#363e335a';ctx.lineWidth=3;for(let x=0;x<=512;x+=256){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.moveTo(0,x);ctx.lineTo(512,x);ctx.stroke();}
 }
 const image=ctx.getImageData(0,0,512,512);for(let i=0;i<image.data.length;i+=4){const noise=(rnd()-.5)*(kind==='road'?58:25);for(let channel=0;channel<3;channel++)image.data[i+channel]=Math.max(0,Math.min(255,image.data[i+channel]+noise));}ctx.putImageData(image,0,0);
 if(kind==='road'||kind==='plaster'||kind==='stone'){
  for(let k=0;k<(kind==='road'?11:5);k++){
   let x=rnd()*512,y=rnd()*512;ctx.strokeStyle=kind==='road'?'#1b201b99':'#353a344a';ctx.lineWidth=kind==='road'?1+rnd()*2:.6+rnd();ctx.beginPath();ctx.moveTo(x,y);for(let i=0;i<10;i++){x+=(rnd()-.5)*35;y+=10+rnd()*22;ctx.lineTo(x,y);}ctx.stroke();
  }
 }
 if(kind==='metal'){
  for(let i=0;i<220;i++){ctx.strokeStyle=rnd()>.4?'#252d2266':'#ffffff45';ctx.lineWidth=rnd()*2;ctx.beginPath();const x=rnd()*512,y=rnd()*512;ctx.moveTo(x,y);ctx.lineTo(x+rnd()*25,y+rnd()*2);ctx.stroke();}
 }
 // Large, soft stains prevent the textures from reading like clean construction material.
 ctx.filter='blur(8px)';for(let i=0;i<35;i++){ctx.fillStyle=kind==='metal'?'#352c1d30':'#17221a20';ctx.beginPath();ctx.ellipse(rnd()*512,rnd()*512,10+rnd()*40,5+rnd()*28,rnd()*6,0,Math.PI*2);ctx.fill();}ctx.filter='none';
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=512;const rc=roughCanvas.getContext('2d');rc.fillStyle=kind==='road'?'#999999':'#dddddd';rc.fillRect(0,0,512,512);
 if(kind==='road'){rc.filter='blur(6px)';for(let i=0;i<9;i++){rc.fillStyle='#292929';rc.beginPath();rc.ellipse(rnd()*512,rnd()*512,15+rnd()*60,4+rnd()*18,rnd()*6,0,Math.PI*2);rc.fill();}}
 const rough=new THREE.CanvasTexture(roughCanvas);rough.wrapS=rough.wrapT=THREE.RepeatWrapping;
 const result={map:tex,bump:tex,rough};textureCache.set(kind,result);return result;
}
export function detailMaterial(m,name){
 if(/Weapon|Player|Zombie|neon|glow|light|lettering|ember|window void|glazing|glass|screen|foliage|linen|fabric|cushion/i.test(name))return m;
 let kind=/brick/i.test(name)?'brick':/asphalt|road/i.test(name)?'road':/wood|timber|teak|oak|grip/i.test(name)?'wood':/metal|steel|bronze|frame|corroded|rust/i.test(name)?'metal':/plaster|ivory|paint/i.test(name)?'plaster':/stone|paving|concrete|limestone|sandstone/i.test(name)?'stone':null;
 if(!kind)return m;const t=surface(kind);m.map=t.map;m.bumpMap=t.bump;m.bumpScale=kind==='brick'?.055:kind==='road'?.035:.025;m.roughnessMap=t.rough;m.roughness=kind==='road'?.68:kind==='metal'?.67:.92;if(kind==='brick'||kind==='plaster')m.color.multiplyScalar(1.25);m.needsUpdate=true;return m;
}
export function projectedUV(row){const uv=new Float32Array(row.positions.length/3*2),p=row.positions,n=row.normals;for(let i=0,j=0;i<p.length;i+=3,j+=2){const ax=Math.abs(n[i]),ay=Math.abs(n[i+1]),az=Math.abs(n[i+2]);if(ay>ax&&ay>az){uv[j]=p[i]/2.4;uv[j+1]=p[i+2]/2.4;}else if(ax>az){uv[j]=p[i+2]/2.4;uv[j+1]=p[i+1]/2.4;}else{uv[j]=p[i]/2.4;uv[j+1]=p[i+1]/2.4;}}return uv;}
function glowTexture(smoke=false){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(!smoke){const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.15,'rgba(255,255,255,.5)');g.addColorStop(.5,'rgba(255,255,255,.10)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);}else{ctx.filter='blur(12px)';for(let i=0;i<20;i++){ctx.fillStyle='rgba(150,160,155,.12)';ctx.beginPath();ctx.ellipse(40+rnd()*50,35+rnd()*65,13+rnd()*25,15+rnd()*20,0,0,Math.PI*2);ctx.fill();}}return new THREE.CanvasTexture(c);}
const fallbackLights=[[-9,5.85,18],[12,5.85,29],[-10,5.85,51],[13,5.85,63],[40,5.85,40],[-38,5.85,25]].map(p=>({x:p[0],y:p[1],z:p[2],color:'#ffb15c',intensity:85}));
export class Atmosphere{
 constructor(scene,asset){
  this.scene=scene;this.time=0;this.sortTimer=0;this.anchors=asset.environment?.lights||fallbackLights;this.selected=[];this.points=[];this.glows=[];this.smoke=[];
  const glow=glowTexture();for(const l of this.anchors){const material=new THREE.SpriteMaterial({map:glow,color:l.color,transparent:true,opacity:l.y<2?.40:.28,blending:THREE.AdditiveBlending,depthWrite:false});const s=new THREE.Sprite(material);s.position.set(l.x,l.y,l.z);s.scale.setScalar(l.glowScale||(l.y<2?3.0:2.0));scene.add(s);this.glows.push({sprite:s,anchor:l});}
  for(let i=0;i<4;i++){const light=new THREE.PointLight(0xffa65a,0,28,2);scene.add(light);this.points.push(light);}
  const cloud=glowTexture(true);for(const [x,z] of asset.environment?.smoke||[]){for(let i=0;i<7;i++){const material=new THREE.SpriteMaterial({map:cloud,color:0x52616a,transparent:true,opacity:.18,depthWrite:false});const s=new THREE.Sprite(material);scene.add(s);this.smoke.push({sprite:s,x,z,phase:i/7+rnd()*.12});}}
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');const grad=ctx.createLinearGradient(0,0,0,512);grad.addColorStop(0,'#101b2c');grad.addColorStop(.4,'#273b4a');grad.addColorStop(.6,'#7b6a59');grad.addColorStop(.72,'#5b4c40');grad.addColorStop(1,'#202d35');ctx.fillStyle=grad;ctx.fillRect(0,0,1024,512);ctx.filter='blur(17px)';for(let i=0;i<95;i++){ctx.fillStyle=i%3?'#101a234d':'#8a8b8220';ctx.beginPath();ctx.ellipse(rnd()*1200-90,rnd()*310,60+rnd()*160,8+rnd()*25,rnd()*.15,0,Math.PI*2);ctx.fill();}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;this.sky=new THREE.Mesh(new THREE.SphereGeometry(120,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false,fog:false}));this.sky.renderOrder=-20;scene.add(this.sky);
 }
 update(dt,camera,power=false){
  this.time+=dt;this.sky.position.copy(camera.position);this.sortTimer-=dt;if(this.sortTimer<=0){this.selected=[...this.anchors].sort((a,b)=>Math.hypot(a.x-camera.position.x,a.z-camera.position.z)-Math.hypot(b.x-camera.position.x,b.z-camera.position.z)).slice(0,4);this.sortTimer=.35;}
  for(let i=0;i<this.points.length;i++){const p=this.points[i],l=this.selected[i];if(!l){p.intensity=0;continue;}p.position.set(l.x,l.y,l.z);p.color.set(l.color);const flicker=.95+.05*Math.sin(this.time*3.3+i*7.5);p.intensity=l.intensity*flicker*(power&&l.x===29?1.7:1);}
  for(const {sprite:s,anchor:l} of this.glows){s.visible=camera.position.distanceTo(s.position)<70;const pulse=1+.04*Math.sin(this.time*2+l.x);s.scale.setScalar((l.glowScale||(l.y<2?3:2))*pulse);}
  for(const s of this.smoke){const phase=(s.phase+this.time*.025)%1;s.sprite.position.set(s.x+Math.sin(phase*5+s.z)*.7+phase*2.5,.5+phase*10,s.z+Math.cos(phase*4)*.6);s.sprite.scale.set(2+phase*4,2.5+phase*5,1);s.sprite.material.opacity=Math.sin(phase*Math.PI)*.15;}
 }
}
