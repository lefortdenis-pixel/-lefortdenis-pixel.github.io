const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const base=path.join(__dirname,'..');
function load(trip='traversee',variant='principal'){
 const storage=new Map([['traversee-trip-v1',trip],['traversee-route-choice-v1',variant]]);let reloads=0;
 const context=vm.createContext({window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{reload:()=>reloads++}});
 for(const f of ['route-data.js','trip-alpes.js','route-engine.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),context);
 return {context,storage,get reloads(){return reloads},route:context.window.TraverseeRoutes};
}
(async()=>{
 const a=load('alpes-mancelles','brenne'),t=a.context.window.ALPES_MANCELLES,r=a.route;
 assert.equal(r.id,'alpes-mancelles');assert.equal(r.points.length,9242);assert.equal(r.data.tracks.length,3);assert(Math.abs(r.data.routeLengthKm-89.472)<.001);
 assert.deepEqual(r.points[0],r.points.at(-1));assert.equal(r.data.stores.length,0);assert.equal(r.inactiveLeg.length,0);
 assert.equal(r.data.tracks.flat().length,r.points.length+2);
 assert.equal(r.data.stageEndsKm.at(-1),r.data.routeLengthKm);
 assert(Math.abs(r.pace.travelDays(0,r.data.routeLengthKm)-3)<1e-8);assert.equal(r.pace.windowEnd(0,3),r.data.routeLengthKm);
 assert.equal(t.water.length,39);assert(t.pois.water.every(p=>p.offRouteMeters<=2500&&p.km>=0&&p.km<=t.lengthKm&&p.note));
 assert(t.pois.water.filter(p=>p.priority===3).every(p=>p.sourceUrl.startsWith('https://')));
 assert(!t.pois.water.some(p=>/miraculeuse|avenue de la Gare/i.test(p.name)));
 assert(t.pois.water.some(p=>p.name.includes('Gesnes')&&p.note.includes('22/06/2026')));
 assert.equal((r.gpx().match(/<trkpt /g)||[]).length,9242);
 await a.context.window.TraverseeTrips.choose('traversee');assert.equal(a.storage.get('traversee-trip-v1'),'traversee');assert.equal(a.storage.get('traversee-route-choice-v1'),'brenne');assert.equal(a.reloads,1);
 for(const variant of ['principal','brenne']){const b=load('traversee',variant);assert.equal(b.route.id,variant);assert.equal(b.route.data.tracks.length,90);assert(b.route.data.routeLengthKm>2000)}
 const failed=load();failed.context.window.TraverseeBivouacFlush=async()=>{throw Error('storage unavailable')};assert.equal(await failed.context.window.TraverseeTrips.choose('alpes-mancelles'),false);assert.equal(failed.storage.get('traversee-trip-v1'),'traversee');assert.equal(failed.reloads,0);
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 for(const filename of ['index.html','bivouac/index.html'])for(const m of fs.readFileSync(path.join(base,filename),'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename});
 const assets={};vm.runInNewContext(fs.readFileSync(path.join(base,'offline-assets.js'),'utf8'),assets);
 assert.equal(assets.TraverseeOfflineAssets.version,'1.296');assert(assets.TraverseeOfflineAssets.essential.includes('./trip-alpes.js?v=1.296'));
 for(const file of assets.TraverseeOfflineAssets.essential){const name=file.split('?')[0];assert(fs.existsSync(path.join(base,name)),name)}
 assert(html.indexOf('trip-alpes.js')<html.indexOf('route-engine.js'));
 console.log('PASS: official 89.472 km loop, 39 water candidates, 3 stages, route isolation, retained Brenne choice, storage failure, GPX export, inline JS and offline assets');
})().catch(e=>{console.error(e);process.exitCode=1});
