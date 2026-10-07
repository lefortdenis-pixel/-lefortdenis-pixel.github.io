// Rebuild after changing the embedded route or the GPX points.
const fs=require('fs'),path=require('path'),vm=require('vm');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const data=JSON.parse(html.match(/const DATA = (.*);/)[1]);
const source=html.slice(html.indexOf('function havKm('),html.indexOf('function stageFromKm('));
const context=vm.createContext({DATA:data,R:6371008.8,rad:d=>d*Math.PI/180});
vm.runInContext(source+';globalThis.project=projectGps;',context);
const water=JSON.parse(fs.readFileSync(path.join(base,'water-points.json'),'utf8'));
const gas=JSON.parse(html.match(/<script id="gas-search">[\s\S]*?const rows=(.*);/)[1]);
function project(p){const lat=Number(p.a??p.lat),lon=Number(p.o??p.lon),r=context.project(lat,lon);return {lat,lon,km:+r.km.toFixed(4),offRouteMeters:Math.round(r.distanceMeters),name:p.n??p.name,type:p.t??'gas'};}
const result={version:1,routeLengthKm:data.routeLengthKm,water:water.map(project).sort((a,b)=>a.km-b.km),gas:gas.map(project).sort((a,b)=>a.km-b.km)};
fs.writeFileSync(path.join(base,'home-pois.json'),JSON.stringify(result));
console.log('Projected '+result.water.length+' water points and '+result.gas.length+' gas points.');
