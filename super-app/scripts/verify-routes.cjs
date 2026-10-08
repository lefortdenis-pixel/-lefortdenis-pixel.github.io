const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const base=path.join(__dirname,'..');const html=fs.readFileSync(path.join(base,'index.html'),'utf8');const source=html.slice(html.indexOf('function havKm('),html.indexOf('function select('));let results={};
for(const id of ['principal','brenne']){
 const context=vm.createContext({window:{},localStorage:{getItem:()=>id}});vm.runInContext(fs.readFileSync(path.join(base,'route-data.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(base,'route-engine.js'),'utf8'),context);const route=context.window.TraverseeRoutes,d=route.data;
 const e=new Function('DATA','R','rad','document','window',source+';return {SEGMENTS,projectGps,havKm,stageFromKm,autonomyWindowEnd,daysNeededForStore};')(d,6371008.8,n=>n*Math.PI/180,{getElementById:()=>null},context.window);
 assert.equal(d.tracks.length,90);assert.equal(e.SEGMENTS.length,route.points.length-1);assert(Math.abs(e.SEGMENTS.at(-1).startKm+e.SEGMENTS.at(-1).lengthKm-d.routeLengthKm)<1e-8);assert(Math.abs(d.routeLengthKm-context.window.TRAVERSEE_ROUTE_CONFIG.lengths[id])<1e-6);
 for(let i=1;i<d.tracks.length;i++)assert.deepEqual(d.tracks[i-1].at(-1),d.tracks[i][0]);assert(e.SEGMENTS.every(s=>s.lengthKm<2));assert(route.points.every(p=>Number.isFinite(p[2])));assert.equal((route.gpx().match(/<trk>/g)||[]).length,1);
 const start=e.projectGps(47.011226,1.097510),end=e.projectGps(46.867901,1.395830);assert(start.distanceMeters<.001&&end.distanceMeters<.001);assert(Math.abs(start.km-704.6860656354)<1e-6);assert(Math.abs(end.km-(id==='principal'?749.3034046252:801.6820642825))<1e-6);
 const pois=JSON.parse(fs.readFileSync(path.join(base,id==='brenne'?'home-pois-brenne.json':'home-pois.json')));assert.equal(pois.routeId,id);assert(Math.abs(pois.routeLengthKm-d.routeLengthKm)<1e-8);assert.equal(pois.water.length,3522);assert.equal(pois.gas.length,34);assert(pois.water.every(p=>p.km<=d.routeLengthKm));
 if(id==='brenne'){
  assert.equal(d.stores.filter(s=>s.routeOnly==='brenne').length,3);assert(d.stores.filter(s=>s.routeOnly==='brenne').every(s=>s.offRouteMeters<50));assert(!d.stores.some(s=>/Clion|Châtillon/i.test(s.name)));
  const km=730;assert.equal(e.autonomyWindowEnd(km,e.stageFromKm(km),2),780);assert.equal(e.daysNeededForStore(km,e.stageFromKm(km),769.6),2);assert(pois.camping[0].offRouteMeters<100);
 }else assert(!d.stores.some(s=>s.routeOnly==='brenne'));
 results[id]={d,e,route};console.log(id,'PASS',d.routeLengthKm.toFixed(3),'km',route.points.length,'vertices');
}
const point=results.principal.route.points.at(-2000),a=results.principal.e.projectGps(...point),b=results.brenne.e.projectGps(...point);assert(Math.abs(b.km-a.km-52.37865965736)<1e-6);assert(b.distanceMeters<.001);console.log('PASS downstream position migration: +52.379 km, same physical coordinates');
