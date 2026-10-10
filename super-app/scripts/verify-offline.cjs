const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),C=require('../offline-core.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'route-data.js'),'utf8'),context);
const config=context.window.TRAVERSEE_ROUTE_CONFIG;
const geometries=[config.main,[...config.main.slice(0,config.joins[0]),...config.variant,...config.main.slice(config.joins[1]+1)]];
for(const points of geometries){const g=C.geometry(points),end=25,list=C.tiles(points,0,end),set=new Set(list.map(t=>`${t.z}/${t.x}/${t.y}`));assert.equal(set.size,list.length);for(let km=0;km<=end;km+=.1){const p=g.at(km);for(const z of [5,10,13,14,15])for(const dlat of [-1.9/111.32,0,1.9/111.32])for(const dlon of [-1.9/111.32/Math.cos(p.lat*Math.PI/180),0,1.9/111.32/Math.cos(p.lat*Math.PI/180)]){const t=C.tileXY(p.lat+dlat,p.lng+dlon,z);assert(set.has(`${z}/${Math.floor(t.x)}/${Math.floor(t.y)}`),'Missing corridor tile')}}assert(Math.abs(g.at(0).lat-points[0][0])<1e-10);}
for(const name of ['index.html','bivouac/index.html']){const source=fs.readFileSync(path.join(root,name),'utf8');for(const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:name});}
const key=r=>typeof r==='string'?r:r.url;
class Cache{constructor(){this.items=new Map()}async match(r){return this.items.get(key(r))?.clone()}async put(r,v){this.items.set(key(r),v.clone())}async delete(r){return this.items.delete(key(r))}async keys(){return [...this.items.keys()].map(u=>new Request(u))}}
class Caches{constructor(){this.items=new Map()}async open(k){if(!this.items.has(k))this.items.set(k,new Cache());return this.items.get(k)}async keys(){return [...this.items.keys()]}async delete(k){return this.items.delete(k)}async match(r){for(const c of this.items.values()){const v=await c.match(r);if(v)return v}}}
const caches=new Caches(),handlers={},scope='https://offline.test/',environment={console,Response,Request,URL,AbortController,setTimeout,clearTimeout,caches,fetch:async r=>{const u=key(r);if(environment.offline)throw Error('offline');if(environment.fail===u)return new Response('',{status:404});const file=path.join(root,new URL(u).pathname.replace(/^\//,''));if(fs.existsSync(file)&&fs.statSync(file).isFile())return new Response(fs.readFileSync(file));if(new URL(u).origin===scope.slice(0,-1)&&new URL(u).pathname==='/')return new Response(fs.readFileSync(path.join(root,'index.html')));return new Response('tile');},self:{registration:{scope},location:{origin:scope.slice(0,-1)},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn}};
const ctx=vm.createContext(environment);environment.importScripts=(...names)=>names.forEach(n=>vm.runInContext(fs.readFileSync(path.join(root,n.split('?')[0].replace(/^\.\//,'')),'utf8'),ctx));vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);
async function event(name,extra={}){const promises=[];let response;handlers[name]({...extra,waitUntil:p=>promises.push(p),respondWith:p=>response=p});const value=response?await response:null;await Promise.all(promises);return value;}
(async()=>{
 const assets=environment.TraverseeOfflineAssets;assert(assets.essential.includes('./shelter-points.json'));for(const item of [...assets.essential,...assets.optional]){const f=path.join(root,item.split('?')[0]);assert(fs.existsSync(f),'Missing '+item)}
 await event('install');await event('activate');let report;await event('message',{data:{type:'VERIFY_OFFLINE'},ports:[{postMessage:r=>report=r}]});assert.equal(report.missing.length,0);assert.equal(report.version,C.VERSION);
 environment.offline=true;for(const file of ['index.html','bivouac/index.html','route-data.js?v='+C.VERSION,'water-points.json?v='+C.VERSION,'home-pois-brenne.json?v='+C.VERSION,'shelter-points.json']){const request=new Request(scope+file);if(file.endsWith('.html'))Object.defineProperty(request,'mode',{value:'navigate'});const r=await event('fetch',{request});assert.equal(r.status,200,file);assert((await r.text()).length>100,file)}
 const pinned=await caches.open(C.MAP_CACHE),url=C.tileUrl(15,16355,11217);await pinned.put(url,new Response('verified-map'));const r=await event('fetch',{request:new Request(url)});assert.equal(await r.text(),'verified-map');
 // Even with the device reporting online, map failures must settle promptly.
 environment.offline=false;const realFetch=environment.fetch;
 environment.fetch=async()=>new Response('',{status:503});
 assert.equal((await event('fetch',{request:new Request(C.tileUrl(15,1,1))})).status,504);
 environment.fetch=(request,{signal}={})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('network stalled'))));
 const started=Date.now();assert.equal((await event('fetch',{request:new Request('https://server.arcgisonline.com/stalled')})).status,504);assert(Date.now()-started<5000);
 environment.fetch=realFetch;
 // Cached application navigation also survives a server 500.
 environment.offline=false;environment.fail=scope+'index.html';const request=new Request(scope+'index.html');Object.defineProperty(request,'mode',{value:'navigate'});assert.equal((await event('fetch',{request})).status,200);
 // Failed installation leaves the previous validated shell and pinned maps intact.
 const shell=await caches.open('traversee-app-'+C.VERSION);await shell.delete(scope+'shelter-points.json');environment.fail=scope+'shelter-points.json';await assert.rejects(event('install'));assert(await pinned.match(url));assert(await shell.match(scope+'index.html'));await event('message',{data:{type:'VERIFY_OFFLINE'},ports:[{postMessage:r=>report=r}]});assert(report.missing.includes('./shelter-points.json'));
 console.log('PASS: both route corridors, inline syntax, all assets, verified installation, offline reopening/data/maps, server failure and missing-file detection.');
})().catch(e=>{console.error(e);process.exit(1)});
