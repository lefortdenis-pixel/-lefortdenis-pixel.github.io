// Build both usable itineraries from the official GPX. The alternative replaces
// the main leg between its endpoints; it is never appended to the main track.
const fs=require('fs'),path=require('path');
const base=path.join(__dirname,'..'),xml=fs.readFileSync(path.join(base,'traversee-officielle.gpx'),'utf8');
const points=text=>[...text.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g)].map(m=>[+m[1],+m[2],+(m[3].match(/<ele>([^<]+)<\/ele>/)||[])[1]]);
const trackMarkup=[...xml.matchAll(/<trk>[\s\S]*?<\/trk>/g)].map(m=>m[0]);
const tracks=trackMarkup.map(points);
let sig=2166136261>>>0;
for(const track of trackMarkup)for(let k=0;k<track.length;k++)sig=Math.imul(sig^track.charCodeAt(k),16777619)>>>0;
const anchors=JSON.parse(fs.readFileSync(path.join(base,'stage-anchors.json'),'utf8'));
if(sig.toString(16).padStart(8,'0')!==anchors.tracksHashFnv32||tracks[0].length!==anchors.mainPointCount||tracks[1].length!==anchors.variantPointCount)throw Error('Walking route changed: stage anchors require review');
if(tracks.length!==2||tracks.some(p=>p.length<2))throw Error('Expected main track and Brenne alternative');
const [main,variant]=tracks,R=6371008.8,rad=d=>d*Math.PI/180;
function hav(a,b){const p1=rad(a[0]),p2=rad(b[0]),dp=p2-p1,dl=rad(b[1]-a[1]);return 2*R/1000*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2));}
function cumulative(p){const c=[0];for(let i=1;i<p.length;i++)c.push(c.at(-1)+hav(p[i-1],p[i]));return c;}
function nearestIndex(p,from=0){let best=from,d=Infinity;for(let i=from;i<main.length;i++){const v=hav(p,main[i]);if(v<d){d=v;best=i}}if(d>.1)throw Error('Waypoint does not match main track');return best;}
const joins=[nearestIndex(variant[0]),nearestIndex(variant.at(-1))];
if(joins[0]>=joins[1]||hav(main[joins[0]],variant[0])>.001||hav(main[joins[1]],variant.at(-1))>.001)throw Error('Invalid branch endpoints');
const waypoints=[...xml.matchAll(/<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/g)];
// Stage boundaries are positions on the walking route, not lodging coordinates.
const indices=anchors.indices;
if(indices.length!==90||indices.some((i,j)=>!Number.isInteger(i)||i<0||i>=main.length||(j>0&&i<=indices[j-1]))||indices.at(-1)!==main.length-1)throw Error('Invalid stage anchors');
const nightStops=[47,82,83,84,89].map(stage=>{
  const m=waypoints[stage];if(!m)throw Error('Night waypoint missing: '+stage);
  const name=m[3].match(/<name>([^<]*)<\/name>/)?.[1]||'';
  const description=m[3].match(/<desc>([^<]*)<\/desc>/)?.[1]||'';
  if(!name||!description)throw Error('Incomplete corrected overnight waypoint: '+stage);
  const decode=t=>t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  return {stage,lat:+m[1],lon:+m[2],name:decode(name),description:decode(description),kind:stage===84?'gite':'camping',verifiedPositionFrom:'GPX_nuits_corrigees_2026-10-08'};
});
const routePoints={principal:main,brenne:[...main.slice(0,joins[0]),...variant,...main.slice(joins[1]+1)]};
const mainCum=cumulative(main),branchCum=cumulative(variant),start=mainCum[joins[0]],end=mainCum[joins[1]],branchLength=branchCum.at(-1),extra=branchLength-(end-start);
const stageEnds={principal:indices.map(i=>mainCum[i]),brenne:indices.map(i=>mainCum[i]<=start?mainCum[i]:mainCum[i]>=end?mainCum[i]+extra:start+(mainCum[i]-start)/(end-start)*branchLength)};
function project(p,route){let km=0,best=null;const lat0=rad(p[0]);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],len=hav(a,b),ax=rad(a[1]-p[1])*Math.cos(lat0)*R,ay=rad(a[0]-p[0])*R,bx=rad(b[1]-p[1])*Math.cos(lat0)*R,by=rad(b[0]-p[0])*R,vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy,t=den?Math.max(0,Math.min(1,-(ax*vx+ay*vy)/den)):0,dist=Math.hypot(ax+t*vx,ay+t*vy);if(!best||dist<best.distanceMeters)best={km:km+t*len,distanceMeters:dist};km+=len;}return best;}
const sourceStores=JSON.parse(fs.readFileSync(path.join(base,'route-stores.json'),'utf8'));
const stores={};
for(const id of ['principal','brenne']){
  stores[id]=sourceStores.flatMap(s=>{
    if(s.routeOnly&&s.routeOnly!==id)return [];
    const p=[s.lat??s.anchorLat,s.lon??s.anchorLon],r=project(p,routePoints[id]);
    // Legacy points on the bypassed main leg must not become nearby shops.
    if(id==='brenne'&&!s.routeOnly&&project(p,main).km>start&&project(p,main).km<end&&r.distanceMeters>3000)return [];
    const stage=stageEnds[id].findIndex(end=>r.km<=end)+1;
    return [{...s,km:+r.km.toFixed(4),stage:stage||90,...(Number.isFinite(s.lat)?{offRouteMeters:Math.round(r.distanceMeters)}:{})}];
  }).sort((a,b)=>a.km-b.km);
}
const camping=JSON.parse(fs.readFileSync(path.join(base,'brenne-pois.json'),'utf8')).camping;
const result={version:'2026-10-07-gpx-v2',main,variant,joins,startKm:start,endMainKm:end,endBrenneKm:start+branchLength,extraKm:extra,stageEnds,stores,camping,lengths:{principal:mainCum.at(-1),brenne:mainCum.at(-1)+extra},nightStops};
fs.writeFileSync(path.join(base,'route-data.js'),'// Generated by scripts/build-routes.cjs\nwindow.TRAVERSEE_ROUTE_CONFIG='+JSON.stringify(result)+';\n');
console.log(JSON.stringify({lengths:result.lengths,branchLength,start,end,extra,stores:stores.brenne.filter(s=>s.routeOnly)}));
