/* Exercise the download UI against browser API doubles, including interrupted packs. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),C=require('../offline-core.js');
const base=path.resolve(__dirname,'..'),scope='https://packs.test/',nodes=new Map();
function element(){return {textContent:'',value:'',hidden:false,disabled:false,children:[],append(...v){this.children.push(...v)},replaceChildren(){this.children=[]},addEventListener(){},querySelector(){return element()},showModal(){},close(){},focus(){}}}function q(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}q('offlineDays').value='7';q('offlineRoute').value='traverse';
class Cache{constructor(){this.items=new Map()}async match(k){return this.items.get(typeof k==='string'?k:k.url)?.clone()}async put(k,v){this.items.set(typeof k==='string'?k:k.url,v.clone())}async keys(){return [...this.items.keys()].map(k=>new Request(k))}async delete(k){return this.items.delete(typeof k==='string'?k:k.url)}}const caches={items:new Map(),async open(k){if(!this.items.has(k))this.items.set(k,new Cache());return this.items.get(k)}};
class Channel{constructor(){this.port1={};this.port2={postMessage:data=>this.port1.onmessage({data})}}}
const configContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'route-data.js'),'utf8'),configContext);const points=configContext.window.TRAVERSEE_ROUTE_CONFIG.main;const route={id:'principal',version:'1.273',points,data:{routeLengthKm:2034.458},pace:{windowEnd:()=>.01}};
let tileCalls=0,failOne=true,failedUrl,abortOnTile=false;
const worker={postMessage:(message,ports)=>ports[0].postMessage({version:C.VERSION,missing:[],total:57})},registration={active:worker,update:async()=>{}};
const env={console,URL,Request,Response,Blob,AbortController,DOMException,MessageChannel:Channel,setTimeout,clearTimeout,Event,TraverseeOfflineCore:C,caches,localStorage:{setItem(){},removeItem(){}},location:{href:scope},document:{body:element(),activeElement:element(),createElement:()=>element(),getElementById:q},navigator:{onLine:true,storage:{persist:async()=>true,estimate:async()=>({quota:1e9,usage:0})},serviceWorker:{ready:Promise.resolve(registration),controller:worker,register:async()=>registration}},window:{TraverseeRoutes:route,TraverseeHome:{getPosition:()=>({km:0})},addEventListener(){},dispatchEvent(){}},fetch:async(url,options={})=>{
 if(!env.navigator.onLine)throw Error('offline');
 if(String(url).includes('/wmts?')){tileCalls++;failedUrl??=String(url);if(abortOnTile){q('offlineCancel').onclick();throw new DOMException('abort','AbortError')}if(failOne&&String(url)===failedUrl)return new Response('',{status:503});return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=','base64'));}
 if(String(url).includes('/elevation.json')){const data=JSON.parse(options.body);return new Response(JSON.stringify({elevations:data.lon.split('|').map(()=>({z:100}))}))}
 const file=path.join(base,new URL(url).pathname.slice(1));return new Response(fs.existsSync(file)?fs.readFileSync(file):'image');
}};env.TraverseeRoutes=route;vm.runInNewContext(fs.readFileSync(path.join(base,'offline.js'),'utf8'),env);
(async()=>{
 await q('offlinePrepare').onclick();assert(q('offlineStatus').textContent.includes('incomplet'));let packs=await env.window.TraverseeOffline.readPacks();assert.equal(packs.length,1);assert(!packs[0].complete);assert.equal(q('offlineShell').textContent,'Téléchargement incomplet');assert.equal(q('offlinePrepare').textContent,'Reprendre');const firstCalls=tileCalls;
 failOne=false;await q('offlinePrepare').onclick();packs=await env.window.TraverseeOffline.readPacks();assert(packs[0].complete);assert(packs[0].reliefComplete);assert.equal(tileCalls-firstCalls,1,'Resume must request only the missing tile');assert(q('offlineStatus').textContent.startsWith('✓'));
 env.navigator.onLine=false;const z=await env.window.TraverseeOffline.relief([1,1.1,1.2]);assert.deepEqual(Array.from(z),Array(9).fill(100));const useful=await (await (await caches.open(C.MAP_CACHE)).match(failedUrl)).arrayBuffer();assert(useful.byteLength>50);
 env.navigator.onLine=true;route.pace.windowEnd=()=>4;abortOnTile=true;await q('offlinePrepare').onclick();assert(q('offlineStatus').textContent.includes('interrompu'));assert((await env.window.TraverseeOffline.readPacks()).some(p=>p.complete),'Previous pack preserved');abortOnTile=false;
 // Removing a pack must preserve shared tiles and the application shell.
 const before=await env.window.TraverseeOffline.readPacks(),complete=before.find(p=>p.complete),other=before.find(p=>!p.complete),shared=complete.urls.find(u=>other.urls.includes(u));
 const shell=await caches.open('traversee-app-'+C.VERSION);await shell.put(scope+'index.html',new Response('app'));
 const row=q('offlinePackList').children.find(r=>r.children[0].textContent.startsWith('✓'));
 await row.children[1].onclick();assert.equal((await env.window.TraverseeOffline.readPacks()).length,1);assert(await (await caches.open(C.MAP_CACHE)).match(shared),'Shared tile must survive removal');assert(!(await (await caches.open(C.RELIEF_CACHE)).match(scope+'offline-pack/'+complete.id)));
 await (await caches.open('traversee-map-tiles-v1')).put(scope+'tile',new Response('tile'));
 await q('offlineDeleteAll').onclick();assert.equal((await env.window.TraverseeOffline.readPacks()).length,0);
 for(const name of [C.MAP_CACHE,C.META_CACHE,C.RELIEF_CACHE,'traversee-map-tiles-v1'])assert.equal((await (await caches.open(name)).keys()).length,0);
 assert(await shell.match(scope+'index.html'),'Deleting maps must preserve the offline application');assert(q('offlineDeleteAll').hidden);assert.equal(q('offlineShell').textContent,'Aucune carte hors ligne');assert.equal(q('offlineStatus').textContent,'');assert.equal(q('offlinePrepare').textContent,'Télécharger');
 console.log('PASS: incomplete download never marked ready; retries resume only missing tiles; offline relief restored; cancellation preserves previous pack; individual/all map removal preserves shared tiles and app.');
})().catch(e=>{console.error(e);process.exit(1)});
