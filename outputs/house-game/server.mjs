import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const project=fileURLToPath(new URL('./',import.meta.url)),root=path.join(project,'dist'),delivery=path.resolve(project,'../blender-delivery');
const names=['manifest.json','zombie-templates-v1.json','zombie-actions-v1.json','player-hands-pistol-v1.json','weapons-pack-v2.json','wallbuys-and-props-v2.json','upper-floor-architecture-v2.json','gameplay-machines-v3.json','powerups-and-tacticals-v3.json','ui-icons-and-hud-v3.json'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
export async function deliveryStatus(directory=delivery){const files=[],errors=[];for(const name of names){try{const p=path.join(directory,name),[data,info]=await Promise.all([readFile(p,'utf8'),stat(p)]);JSON.parse(data);files.push({name,bytes:info.size,mtime:info.mtimeMs});}catch{errors.push(name+' غير جاهز أو غير مكتمل');}}const latest=Math.max(0,...files.map(f=>f.mtime));return {ready:errors.length===0&&Date.now()-latest>=2000,stamp:files.map(f=>f.name+':'+f.bytes+':'+f.mtime).join('|'),files:files.map(({name,bytes})=>({name,bytes})),errors};}
export function createPreviewServer(){return http.createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const url=new URL(req.url,'http://localhost');let file;
 if(url.pathname==='/__delivery/status'){res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'}).end(JSON.stringify(await deliveryStatus()));return;}
 if(url.pathname.startsWith('/__delivery/')){const name=decodeURIComponent(url.pathname.slice('/__delivery/'.length));if(!names.includes(name)){res.writeHead(404).end();return;}file=path.join(delivery,name);}
 else if(url.pathname.startsWith('/__review/')){const name=url.pathname.slice('/__review/'.length);if(!['index.html','review.mjs'].includes(name)){res.writeHead(404).end();return;}file=path.join(project,'dev',name);}
 else{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found');}});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const at=process.argv.indexOf('--port'),port=at>=0?Number(process.argv[at+1]):8123;if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid preview port');const server=createPreviewServer();server.on('error',e=>{console.error('Unable to start preview:',e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Game: http://127.0.0.1:'+port+'/?delivery=1\nAsset review: http://127.0.0.1:'+port+'/__review/index.html'));}
