const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');global.window=global;
vm.runInThisContext(fs.readFileSync(path.join(root,'reset-engine.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root,'reset-points.js'),'utf8'));
const E=TraverseeResetEngine;
assert.equal(new Set(TRAVERSEE_RESET_POINTS.map(p=>p.zone)).size,9);
assert.equal(TRAVERSEE_RESET_POINTS.length,14);
for(const p of TRAVERSEE_RESET_POINTS){assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon),p.id);assert.ok(p.sourceUrl.startsWith('https://'));assert.equal(p.opening2027,'unknown')}
assert.equal(E.level(TRAVERSEE_RESET_POINTS.find(p=>p.id==='vallee')),'usable');assert.equal(E.level(TRAVERSEE_RESET_POINTS.find(p=>p.id==='galets')),'backup');assert.equal(E.level(TRAVERSEE_RESET_POINTS.find(p=>p.id==='rivage')),'usable');
assert.deepEqual(E.walkingDays(60,{}),{min:2,max:3,recent:false});
const samples=[];for(let d=1;d<=6;d++)for(let h of [7,10,13,16])samples.push({mode:'gps',routeId:'principal',km:d*25+(h-7)*25/9,updatedAt:Date.UTC(2027,3,d,h-2)});
const pace=E.recentPace(samples,Date.UTC(2027,3,8));assert.equal(pace.count,5);assert.equal(pace.kmPerDay,25);
assert.equal(E.recentPace(samples.map(s=>({...s,mode:'km'})),Date.UTC(2027,3,8)).count,0);
assert.equal(E.recentPace(samples.filter(s=>new Date(s.updatedAt).getUTCHours()<10),Date.UTC(2027,3,8)).count,0);
assert.equal(E.recentPace(samples.map((s,i)=>({...s,km:i*100})),Date.UTC(2027,3,8)).count,0);
assert.equal(E.recentPace(samples,Date.UTC(2027,4,8)).count,0);
assert.equal(E.sinceReset({km:100,routeId:'principal',at:0},{km:150,routeId:'principal'},()=>null,[]).km,50);
assert.equal(E.sinceReset({km:100,lat:1,lon:2,routeId:'principal',at:0},{km:202,routeId:'brenne'},()=>({km:152}),[]).km,50);
// Both actual itineraries must project the same venue independently, in order.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const projection=html.match(/function projectGps\(lat,lon\)\{[\s\S]*?\n\}\n\nfunction stageFromKm/)[0].replace(/\n\nfunction stageFromKm$/,'');
let principalKm;
for(const routeId of ['principal','brenne']){
 const c={window:{},localStorage:{getItem:()=>routeId},location:{reload(){}},R:6371000,rad:n=>n*Math.PI/180,Number,Math};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(root,'route-data.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(root,'route-engine.js'),'utf8'),c);
 c.DATA=c.TraverseeRoutes.data;c.SEGMENTS=[];let startKm=0;for(const track of c.DATA.tracks)for(let i=1;i<track.length;i++){const a=track[i-1],b=track[i],r=Math.PI/180;const len=2*6371.0088*Math.asin(Math.sqrt(Math.sin((b[0]-a[0])*r/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2));c.SEGMENTS.push({a,b,startKm,lengthKm:len});startKm+=len}
 vm.runInContext(projection,c);const ps=E.projectPoints(TRAVERSEE_RESET_POINTS,c.projectGps),gs=E.groups(ps,0);assert.equal(gs.length,9);for(let i=1;i<gs.length;i++)assert.ok(gs[i].km>=gs[i-1].km);
 const greoux=ps.find(p=>p.id==='pinede').km;if(routeId==='principal')principalKm=greoux;else assert.ok(greoux-principalKm>50&&greoux-principalKm<55);
 assert.equal(E.groups(ps,700)[0].name,'La Châtre');console.log(routeId,gs.map(g=>g.name+': '+g.km.toFixed(1)).join(' | '));
}
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');const assets=vm.runInNewContext(sw.match(/const ASSETS=(\[[^;]*\])/)[1]);for(const url of assets){assert.ok(fs.existsSync(path.join(root,url.split('?')[0])),url)}for(const f of ['reset.js','reset-engine.js','reset-points.js','reset.css'])assert.ok(assets.includes('./'+f+'?v=1.269'));
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
console.log('PASS: service categories, fallback/recent pace, manual exclusions, stale data, reset anchors, both routes, inline syntax and offline assets');
