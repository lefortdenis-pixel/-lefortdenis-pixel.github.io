// Rebuild after changing the embedded route or the GPX points.
const fs=require('fs'),path=require('path'),vm=require('vm');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const source=html.slice(html.indexOf('function havKm('),html.indexOf('function stageFromKm('));
const water=JSON.parse(fs.readFileSync(path.join(base,'water-points.json'),'utf8'));
const gasContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'gas-points.js'),'utf8'),gasContext);const gas=gasContext.window.TRAVERSEE_GAS_POINTS;
const branch=JSON.parse(fs.readFileSync(path.join(base,'brenne-pois.json'),'utf8'));
for(const id of ['principal','brenne']){
  const context=vm.createContext({window:{},localStorage:{getItem:()=>id}});
  vm.runInContext(fs.readFileSync(path.join(base,'route-data.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(base,'route-engine.js'),'utf8'),context);
  const data=context.window.TraverseeRoutes.data;
  // Compile the trusted geometry helpers in the native runtime. A vm context
  // otherwise makes the 100 million segment comparisons needlessly slow.
  const engine=new Function('DATA','R','rad','document','window',source+';return {projectGps};')(data,6371008.8,d=>d*Math.PI/180,{getElementById:()=>null},context.window);
  function project(p){const lat=Number(p.a??p.lat),lon=Number(p.o??p.lon),r=engine.projectGps(lat,lon);return {lat,lon,km:Math.min(data.routeLengthKm,+r.km.toFixed(4)),offRouteMeters:Math.round(r.distanceMeters),name:p.n??p.name,type:p.t??p.type??'gas',...(p.note?{note:p.note}:{}),...(p.id?{id:p.id,status:p.status,source:p.source,stockConfirmed:false}:{}),...(p.sourceUrl?{sourceUrl:p.sourceUrl}:{}),...(p.phone?{phone:p.phone,hours:p.hours,gasContact:p.gasContact,kind:p.kind}:{})};}
  const result={version:2,routeId:id,routeLengthKm:data.routeLengthKm,water:water.map(project).filter(p=>p.offRouteMeters<=2500).sort((a,b)=>a.km-b.km),gas:gas.map(project).sort((a,b)=>a.km-b.km),camping:id==='brenne'?branch.camping.map(project):[]};
  fs.writeFileSync(path.join(base,id==='brenne'?'home-pois-brenne.json':'home-pois.json'),JSON.stringify(result));
  console.log(id+': '+result.water.length+' water points, '+result.gas.length+' gas points, '+result.camping.length+' camping.');
}
