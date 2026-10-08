/* Pure calculations; kilometres always belong to the active canonical itinerary. */
(()=>{
 'use strict';
 const dayKey=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 const hour=t=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(new Date(t)));
 const level=p=>p.services.shower===true&&p.services.washer===true?(p.services.dryer===true?'complete':'usable'):'backup';
 function projectPoints(points,project){return points.map(p=>{const r=Number.isFinite(p.lat)&&Number.isFinite(p.lon)?project(p.lat,p.lon):null;return {...p,level:level(p),km:r?.km??null,offRouteMeters:r?.distanceMeters??null}})}
 function upcoming(points,km){return points.filter(p=>Number.isFinite(p.km)&&p.km>=km-.1).map(p=>({...p,delta:Math.max(0,p.km-km)})).sort((a,b)=>a.km-b.km)}
 function groups(points,km){const out=[];for(const p of upcoming(points,km)){let g=out.find(g=>g.name===p.zone);if(!g){g={name:p.zone,km:p.km,delta:p.delta,points:[]};out.push(g)}g.points.push(p)}return out}
 function recentPace(samples,now=Date.now()){
  const days=new Map(),today=dayKey(now);
  for(const s of samples||[]){if(s.mode!=='gps'||!Number.isFinite(s.km)||!Number.isFinite(s.updatedAt)||now-s.updatedAt>14*86400000||s.updatedAt>now)continue;const key=dayKey(s.updatedAt);if(key===today)continue;if(!days.has(key))days.set(key,[]);days.get(key).push(s)}
  const good=[];
  for(const [date,ss] of days){ss.sort((a,b)=>a.updatedAt-b.updatedAt);const first=ss[0],last=ss.at(-1);if(ss.length<3||first.routeId!==last.routeId||ss.some(s=>s.routeId!==first.routeId)||hour(first.updatedAt)>10||hour(last.updatedAt)<16)continue;
   let distance=0,valid=true;
   for(let i=1;i<ss.length;i++){const dt=(ss[i].updatedAt-ss[i-1].updatedAt)/3600000,dk=ss[i].km-ss[i-1].km;if(dt>4||dk<-.5||dk>dt*7+.2){valid=false;break}distance+=Math.max(0,dk)}
   if(valid&&distance>=5&&distance<=60)good.push({date,distance});
  }
  good.sort((a,b)=>b.date.localeCompare(a.date));const selected=good.slice(0,5);
  return selected.length?{kmPerDay:selected.reduce((s,d)=>s+d.distance,0)/selected.length,count:selected.length,days:selected}:{kmPerDay:null,count:0,days:[]};
 }
 function walkingDays(distance,pace){return pace?.kmPerDay?{min:distance/pace.kmPerDay,max:distance/pace.kmPerDay,recent:true}:{min:distance/30,max:distance/20,recent:false}}
 function sinceReset(record,position,project,samples){if(!record||!position)return null;const anchor=record.routeId===position.routeId?record.km:project(record.lat,record.lon)?.km;if(!Number.isFinite(anchor))return null;const days=new Set((samples||[]).filter(s=>s.updatedAt>=record.at&&s.mode==='gps'&&s.km>anchor+.1).map(s=>dayKey(s.updatedAt)));return {km:Math.max(0,position.km-anchor),days:days.size,estimated:record.routeId!==position.routeId}}
 window.TraverseeResetEngine={dayKey,level,projectPoints,upcoming,groups,recentPace,walkingDays,sinceReset};
})();
