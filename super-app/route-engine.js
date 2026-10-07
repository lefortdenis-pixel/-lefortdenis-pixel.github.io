/* One selected itinerary for all tools, including the Bivouac iframe. */
(()=>{
  'use strict';
  const c=window.TRAVERSEE_ROUTE_CONFIG,key='traversee-route-choice-v1';
  let id='principal';try{if(localStorage.getItem(key)==='brenne')id='brenne'}catch(_){}
  const points=id==='brenne'?[...c.main.slice(0,c.joins[0]),...c.variant,...c.main.slice(c.joins[1]+1)]:c.main;
  const ends=c.stageEnds[id],tracks=[];let start=0,walked=0,index=1;
  const hav=(a,b)=>{const r=Math.PI/180,p1=a[0]*r,p2=b[0]*r;return 2*6371.0088*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[1]-a[1])*r/2)**2));};
  // Split only at vertices and share each boundary. No repeated legs or gaps.
  for(let stage=0;stage<ends.length;stage++){
    while(index<points.length&&walked<ends[stage]-1e-7){walked+=hav(points[index-1],points[index]);index++;}
    tracks.push(points.slice(start,index));start=index-1;
  }
  const actualEnds=[];let cumulative=0;
  tracks.forEach(track=>{for(let i=1;i<track.length;i++)cumulative+=hav(track[i-1],track[i]);actualEnds.push(cumulative)});
  const data={version:c.version,routeId:id,routeLengthKm:cumulative,tracks,stageEndsKm:actualEnds,stores:c.stores[id]};
  window.TraverseeRoutes={id,version:c.version,data,points,camping:id==='brenne'?c.camping:[],branch:{startKm:c.startKm,endKm:c.endBrenneKm,extraKm:c.extraKm},
    inactiveLeg:id==='brenne'?c.main.slice(c.joins[0],c.joins[1]+1):c.variant,
    choose(next){if(!['principal','brenne'].includes(next)||next===id)return;try{localStorage.setItem(key,next)}catch(_){return false}location.reload();return true;},
    gpx(){return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Traversée 2027" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Traversée 2027 — '+(id==='brenne'?'via Brenne':'principale')+'</name><trkseg>'+points.map(p=>'<trkpt lat="'+p[0]+'" lon="'+p[1]+'">'+(Number.isFinite(p[2])?'<ele>'+p[2]+'</ele>':'')+'</trkpt>').join('')+'</trkseg></trk></gpx>';}
  };
})();
