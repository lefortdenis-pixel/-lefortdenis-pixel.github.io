const CACHE='traversee-v1-144-modes-3days';
const ASSETS=['./','./index.html','./water-points.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./bivouac/index.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin){
    const htmlRequest=event.request.mode==='navigate'||url.pathname.endsWith('/index.html');
    if(htmlRequest){
      event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp;}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
    }else{
      event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp;})));
    }
  }
});
