const CACHE='traversee-v1-257-replace-label';
const TILE_CACHE='traversee-map-tiles-v1';
const ASSETS=['./soleil-font.css?v=1.257','./soleil.css?v=1.257','./soleil-menu.css?v=1.257','./soleil-bivouac.css?v=1.257','./icons/gas-canister.svg','./reset.css?v=1.257','./reset-points.js?v=1.257','./reset-engine.js?v=1.257','./reset.js?v=1.257','./','./index.html','./home.css?v=1.257','./home.js?v=1.257','./home-bivouac.js?v=1.257','./home-pois.json?v=1.257','./home-pois-brenne.json?v=1.257','./route-data.js?v=1.257','./route-engine.js?v=1.257','./gas-points.js?v=1.257','./gas-tracker.js?v=1.257','./store-points.js','./water-points.json?v=1.257','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./bivouac/index.html','./home-map.js?v=1.257','./vendor/maplibre-gl.js','./vendor/maplibre-gl.css','./vendor/leaflet.css','./vendor/leaflet.js','./vendor/leaflet.sync.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==TILE_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function isMapTile(url){
  const h=url.hostname;
  return h==='server.arcgisonline.com'||h==='data.geopf.fr'||h==='tile.waymarkedtrails.org'||
    h==='tile.openstreetmap.org'||h.endsWith('.tile.openstreetmap.org')||h.endsWith('.tile.opentopomap.org')||
    h.endsWith('.basemaps.cartocdn.com');
}
async function trimTileCache(max=1200){
  const cache=await caches.open(TILE_CACHE),keys=await cache.keys();
  if(keys.length<=max)return;
  await Promise.all(keys.slice(0,keys.length-max).map(k=>cache.delete(k)));
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(url.origin===self.location.origin){
    const htmlRequest=event.request.mode==='navigate'||url.pathname.endsWith('/index.html');
    if(htmlRequest){
      const fallback=url.pathname.includes('/bivouac')?'./bivouac/index.html':'./index.html';
      event.respondWith(
        fetch(event.request).then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return resp;
        }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(fallback)))
      );
    }else{
      event.respondWith(
        caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return resp;
        }))
      );
    }
    return;
  }

  if(isMapTile(url)){
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache=>{
        const cached=await cache.match(event.request);
        // Leaflet image requests cache opaque responses. WebGL fetches require
        // readable CORS responses, so upgrade only incompatible cached tiles.
        if(cached&&(event.request.mode==='no-cors'||cached.type!=='opaque'))return cached;
        try{
          const resp=await fetch(event.request);
          if(resp.ok||resp.type==='opaque'){
            cache.put(event.request,resp.clone()).then(()=>trimTileCache());
          }
          return resp;
        }catch(_){
          return new Response('',{status:504,statusText:'Offline tile unavailable'});
        }
      })
    );
  }
});

