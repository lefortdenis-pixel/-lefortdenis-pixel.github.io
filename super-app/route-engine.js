/* One selected itinerary for all tools, including the Bivouac iframe. */
(()=>{
  'use strict';
  const c=window.TRAVERSEE_ROUTE_CONFIG,key='traversee-route-choice-v1';
  let id='principal';try{if(localStorage.getItem(key)==='brenne')id='brenne'}catch(_){}
  const points=id==='brenne'?[...c.main.slice(0,c.joins[0]),...c.variant,...c.main.slice(c.joins[1]+1)]:c.main;
  const hav=(a,b)=>{const r=Math.PI/180,p1=a[0]*r,p2=b[0]*r;return 2*6371.0088*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[1]-a[1])*r/2)**2));};
  function split(points,ends){
    const tracks=[];let start=0,walked=0,index=1;
    for(let stage=0;stage<ends.length;stage++){
      while(index<points.length&&walked<ends[stage]-1e-7){walked+=hav(points[index-1],points[index]);index++;}
      tracks.push(points.slice(start,index));start=index-1;
    }
    return tracks;
  }
  const tracks=split(points,c.stageEnds[id]);
  const actualEnds=[];let cumulative=0;
  tracks.forEach(track=>{for(let i=1;i<track.length;i++)cumulative+=hav(track[i-1],track[i]);actualEnds.push(cumulative)});
  // Resample altitude every 200 m and smooth three samples to reduce GPX noise.
  function terrain(track){
    let length=0,next=.2;const samples=[track[0][2]];
    for(let i=1;i<track.length;i++){
      const d=hav(track[i-1],track[i]);
      while(d>0&&next<=length+d){const t=(next-length)/d;samples.push(track[i-1][2]+t*(track[i][2]-track[i-1][2]));next+=.2;}
      length+=d;
    }
    samples.push(track.at(-1)[2]);
    const smooth=samples.map((_,i)=>{const v=samples.slice(Math.max(0,i-1),i+2);return v.reduce((a,b)=>a+b,0)/v.length});
    let ascent=0;for(let i=1;i<smooth.length;i++)ascent+=Math.max(0,smooth[i]-smooth[i-1]);
    return {lengthKm:length,ascentMeters:ascent,kind:ascent>=500&&ascent/Math.max(length,.001)>=20?'mountain':'flat'};
  }
  const reference=split(c.main,c.stageEnds.principal).map(terrain);
  const averages={};
  for(const kind of ['flat','mountain']){
    const group=reference.filter(s=>s.kind===kind);
    if(!group.length)throw Error('Missing reference terrain: '+kind);
    averages[kind]=group.reduce((sum,s)=>sum+s.lengthKm,0)/group.length;
  }
  const profiles=tracks.map(terrain).map((s,i)=>({...s,startKm:i?actualEnds[i-1]:0,endKm:actualEnds[i]}));
  function windowEnd(km,days){
    let end=Math.max(0,Math.min(cumulative,km)),budget=Math.max(0,days);
    for(const s of profiles){
      if(s.endKm<=end+1e-9)continue;
      const rate=averages[s.kind],cost=(s.endKm-end)/rate;
      if(budget<=cost)return Math.min(cumulative,end+budget*rate);
      budget-=cost;end=s.endKm;
    }
    return cumulative;
  }
  function travelDays(from,to){
    let days=0;for(const s of profiles){const distance=Math.min(to,s.endKm)-Math.max(from,s.startKm);if(distance>0)days+=distance/averages[s.kind];}return days;
  }
  function journeyDays(from,to,detourKm=0){const section=profiles.find(s=>s.endKm>Math.min(from,to))||profiles.at(-1);return travelDays(Math.min(from,to),Math.max(from,to))+Math.max(0,detourKm)/averages[section.kind];}
  const pace={averages,profiles,reference,windowEnd,travelDays,journeyDays,method:'90 planned stages; mountain: smoothed ascent >=500 m and >=20 m/km'};
  const data={version:c.version,routeId:id,routeLengthKm:cumulative,tracks,stageEndsKm:actualEnds,stores:c.stores[id]};
  window.TraverseeRoutes={id,version:c.version,data,points,pace,camping:id==='brenne'?c.camping:[],branch:{startKm:c.startKm,endKm:c.endBrenneKm,extraKm:c.extraKm},
    inactiveLeg:id==='brenne'?c.main.slice(c.joins[0],c.joins[1]+1):c.variant,
    choose(next){if(!['principal','brenne'].includes(next)||next===id)return;try{localStorage.setItem(key,next)}catch(_){return false}location.reload();return true;},
    gpx(){return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Traversée 2027" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Traversée 2027 — '+(id==='brenne'?'via Brenne':'principale')+'</name><trkseg>'+points.map(p=>'<trkpt lat="'+p[0]+'" lon="'+p[1]+'">'+(Number.isFinite(p[2])?'<ele>'+p[2]+'</ele>':'')+'</trkpt>').join('')+'</trkseg></trk></gpx>';}
  };
})();
