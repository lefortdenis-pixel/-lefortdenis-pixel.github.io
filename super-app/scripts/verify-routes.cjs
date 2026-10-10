const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const base=path.join(__dirname,'..');const html=fs.readFileSync(path.join(base,'index.html'),'utf8');const source=html.slice(html.indexOf('function havKm('),html.indexOf('function select('));let results={};
for(const id of ['principal','brenne']){
 const context=vm.createContext({window:{},localStorage:{getItem:()=>id}});vm.runInContext(fs.readFileSync(path.join(base,'route-data.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(base,'route-engine.js'),'utf8'),context);const route=context.window.TraverseeRoutes,d=route.data;
 const e=new Function('DATA','R','rad','document','window',source+';return {SEGMENTS,projectGps,havKm,stageFromKm,autonomyWindowEnd,daysNeededForStore};')(d,6371008.8,n=>n*Math.PI/180,{getElementById:()=>null},context.window);
 assert.equal(d.tracks.length,90);assert.equal(e.SEGMENTS.length,route.points.length-1);assert(Math.abs(e.SEGMENTS.at(-1).startKm+e.SEGMENTS.at(-1).lengthKm-d.routeLengthKm)<1e-8);assert(Math.abs(d.routeLengthKm-context.window.TRAVERSEE_ROUTE_CONFIG.lengths[id])<1e-6);
 for(let i=1;i<d.tracks.length;i++)assert.deepEqual(d.tracks[i-1].at(-1),d.tracks[i][0]);assert(e.SEGMENTS.every(s=>s.lengthKm<2));assert(route.points.every(p=>Number.isFinite(p[2])));assert.equal((route.gpx().match(/<trk>/g)||[]).length,1);
 const start=e.projectGps(47.011226,1.097510),end=e.projectGps(46.867901,1.395830);assert(start.distanceMeters<.001&&end.distanceMeters<.001);assert(Math.abs(start.km-704.6860656354)<1e-6);assert(Math.abs(end.km-(id==='principal'?749.3034046252:801.6820642825))<1e-6);
 const pois=JSON.parse(fs.readFileSync(path.join(base,id==='brenne'?'home-pois-brenne.json':'home-pois.json')));assert.equal(pois.routeId,id);assert(Math.abs(pois.routeLengthKm-d.routeLengthKm)<1e-8);assert.equal(pois.water.length,id==='principal'?1701:1718);assert(pois.water.every(p=>p.offRouteMeters<=2500));assert.equal(pois.gas.length,36);assert(!pois.gas.some(p=>p.id==='gas-44.261077-4.706398'),'Excluded seller must never reappear');const contacts=pois.gas.filter(p=>p.phone);assert.equal(contacts.length,30);assert(contacts.every(p=>p.phone&&p.name&&p.sourceUrl));assert(pois.water.every(p=>p.km<=d.routeLengthKm));
 if(id==='brenne'){
  assert.equal(d.stores.filter(s=>s.routeOnly==='brenne').length,3);assert(d.stores.filter(s=>s.routeOnly==='brenne').every(s=>s.offRouteMeters<50));assert(!d.stores.some(s=>/Clion|Châtillon/i.test(s.name)));
  const km=730;assert(Math.abs(e.autonomyWindowEnd(km,e.stageFromKm(km),2)-(km+2*route.pace.averages.flat))<1e-6);assert(pois.camping[0].offRouteMeters<100);
 }else assert(!d.stores.some(s=>s.routeOnly==='brenne'));
 results[id]={d,e,route};console.log(id,'PASS',d.routeLengthKm.toFixed(3),'km',route.points.length,'vertices');
}
const point=results.principal.route.points.at(-2000),a=results.principal.e.projectGps(...point),b=results.brenne.e.projectGps(...point);assert(Math.abs(b.km-a.km-52.37865965736)<1e-6);assert(b.distanceMeters<.001);console.log('PASS downstream position migration: +52.379 km, same physical coordinates');

// Day budgets are continuous across stage ends and terrain changes.
for(const {d,e,route} of Object.values(results)){
 const pace=route.pace;assert(pace.reference.length===90);assert(pace.profiles.length===90);
 for(const kind of ['flat','mountain']){const group=pace.reference.filter(s=>s.kind===kind);assert(group.length>0);assert(Math.abs(pace.averages[kind]-group.reduce((sum,s)=>sum+s.lengthKm,0)/group.length)<1e-9);}
 for(const start of [0,10,225,700,1100,1500,d.routeLengthKm-10]){
  for(const days of [1,2,3,4]){const end=pace.windowEnd(start,days);assert(end>=start&&end<=d.routeLengthKm);if(end<d.routeLengthKm-1e-6){assert(Math.abs(pace.travelDays(start,end)-days)<1e-8);assert.equal(e.daysNeededForStore(start,e.stageFromKm(start),end),days);}}
 }
 const same=pace.profiles.find((s,i)=>pace.profiles[i+1]?.kind===s.kind&&s.lengthKm>2);
 const start=same.endKm-1,days=2/pace.averages[same.kind];assert(Math.abs(pace.windowEnd(start,days)-(start+2))<1e-8);
 const change=pace.profiles.find((s,i)=>pace.profiles[i+1]&&pace.profiles[i+1].kind!==s.kind&&s.lengthKm>2);
 const next=pace.profiles[pace.profiles.indexOf(change)+1];assert(Math.abs(pace.windowEnd(change.endKm-1,1/pace.averages[change.kind]+1/pace.averages[next.kind])-(change.endKm+1))<1e-8);
 assert.equal(pace.windowEnd(d.routeLengthKm-1,4),d.routeLengthKm);
 console.log(route.id,'pace:',JSON.stringify(pace.averages),'reference stages:',pace.reference.filter(s=>s.kind==='flat').length,'flat /',pace.reference.filter(s=>s.kind==='mountain').length,'mountain');
}
console.log('PASS terrain pace: reference means, mid-stage continuity, mixed relief, day inverse and arrival clamp');

const C=require('../offline-core.js');
assert.equal(C.projectWindowEnd(0,1,100,[35,35]),35);
assert.equal(C.projectWindowEnd(0,2,100,[35,35]),70);
assert.equal(C.projectWindowEnd(0,3,100,[35,35]),100);
assert.equal(C.projectWindowEnd(25,1,100,[35,35]),60);
for(const {route} of Object.values(results)){
 assert.equal(route.pace.journeyDays(0,225),route.pace.travelDays(0,225));
 assert(route.pace.journeyDays(0,225,2)>route.pace.travelDays(0,225));
}
console.log('PASS shared pace and custom project: stage budgets, progress, arrival and detours');
