importScripts('./offline-core.js?v=1.280','./offline-assets.js');
const A=TraverseeOfflineAssets,C=TraverseeOfflineCore,CACHE='traversee-app-'+A.version,TILE_CACHE='traversee-map-tiles-v1';
const absolute=p=>new URL(p,self.registration.scope).href;
async function fetchGood(request,timeout=20000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(request,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);return r}finally{clearTimeout(timer)}}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Activation happens only after every essential file is safely written.
 for(const path of A.essential){const url=absolute(path);await cache.put(url,await fetchGood(url));}
 await cache.put(absolute('./offline-installed'),new Response(JSON.stringify({version:A.version,at:Date.now()})));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Retain the previous shell for tabs still running its scripts. Never erase packs.
 const keys=await caches.keys(),appKeys=keys.filter(k=>k.startsWith('traversee-app-')&&k!==CACHE);
 for(const key of appKeys.slice(0,-1))await caches.delete(key);
 await self.clients.claim();
})()));
function isMapTile(u){return u.hostname==='data.geopf.fr'&&u.pathname==='/wmts'||u.hostname==='server.arcgisonline.com'||u.hostname==='tile.waymarkedtrails.org'||u.hostname==='tile.openstreetmap.org'||u.hostname.endsWith('.tile.openstreetmap.org')||u.hostname.endsWith('.tile.opentopomap.org')||u.hostname.endsWith('.basemaps.cartocdn.com')}
function ignCanonical(u){if(u.hostname!=='data.geopf.fr'||u.pathname!=='/wmts')return null;const p=Object.fromEntries([...u.searchParams].map(([k,v])=>[k.toLowerCase(),v]));return p.layer==='GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'?C.tileUrl(p.tilematrix,p.tilecol,p.tilerow):null;}
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);
 if(url.origin===self.location.origin){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   if(event.request.mode==='navigate'||url.pathname.endsWith('/index.html')){
    const path=url.pathname.includes('/bivouac')?'./bivouac/index.html':'./index.html';
    // Serve the shell belonging to this worker: no mixture of deployment versions.
    const saved=await cache.match(absolute(path));if(saved)return saved;
    try{return await fetchGood(event.request,4000)}catch(_){return await caches.match(absolute(path))||new Response('Rouvre l’application avec du réseau pour la préparer.',{status:503})}
   }
   const saved=await cache.match(event.request)||await caches.match(event.request);if(saved)return saved;
   try{const response=await fetchGood(event.request,10000);await cache.put(event.request,response.clone());return response}catch(_){return new Response('',{status:504})}
  })());return;
 }
 if(isMapTile(url))event.respondWith((async()=>{
  const canonical=ignCanonical(url),pinned=await caches.open(C.MAP_CACHE);
  if(canonical){const saved=await pinned.match(canonical);if(saved)return saved;}
  const cache=await caches.open(TILE_CACHE),saved=await cache.match(event.request);
  if(saved&&(event.request.mode==='no-cors'||saved.type!=='opaque'))return saved;
  try{const r=await fetch(event.request);if(r.ok||r.type==='opaque')event.waitUntil((async()=>{await cache.put(event.request,r.clone());const keys=await cache.keys();for(const k of keys.slice(0,Math.max(0,keys.length-1200)))await cache.delete(k)})());return r}catch(_){return new Response('',{status:504})}
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='VERIFY_OFFLINE')return;
 event.waitUntil((async()=>{const cache=await caches.open(CACHE),missing=[];for(const p of A.essential)if(!(await cache.match(absolute(p))))missing.push(p);event.ports[0]?.postMessage({version:A.version,missing,total:A.essential.length});})());
});
