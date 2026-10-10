/* Shared offline geometry and storage contract. No external dependency. */
(function(root){
 'use strict';
 const VERSION='1.289', MAP_CACHE='traversee-offline-planign-v1', META_CACHE='traversee-offline-packs-v1', RELIEF_CACHE='traversee-offline-relief-v1';
 const TILE_URL='https://data.geopf.fr/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&style=normal&format=image/png&tilematrixset=PM&tilematrix={z}&tilerow={y}&tilecol={x}';
 const hav=(a,b)=>{const r=Math.PI/180;return 12742.0176*Math.asin(Math.min(1,Math.sqrt(Math.sin((b[0]-a[0])*r/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2)))};
 function geometry(points){const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum[i-1]+hav(points[i-1],points[i]));function at(km){km=Math.max(0,Math.min(cum.at(-1),km));let lo=1,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<km)lo=mid+1;else hi=mid}const a=points[lo-1],b=points[lo],t=(km-cum[lo-1])/(cum[lo]-cum[lo-1]||1);return {lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t,ele:a[2]+(b[2]-a[2])*t}}return {cum,at};}
 function projectWindowEnd(km,days,length,zones){
  const first=Math.max(0,Math.min(length,Number(zones?.[0])||Math.min(25,length))),second=Math.max(first,Math.min(length,first+(Number(zones?.[1])||Math.min(25,length-first))));
  const ends=[first,second,length];let end=Math.max(0,Math.min(length,km)),budget=Math.max(0,days),start=0;
  for(const stop of ends){const rate=stop-start;start=stop;if(stop<=end||rate<=0)continue;const cost=(stop-end)/rate;if(budget<=cost)return Math.min(length,end+budget*rate);budget-=cost;end=stop;}return length;
 }
 function tileXY(lat,lon,z){const n=2**z;return {x:(lon+180)/360*n,y:(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n};}
 function tileUrl(z,x,y){return TILE_URL.replace('{z}',z).replace('{x}',x).replace('{y}',y)}
 // Conservative square around dense samples; includes 2 km on each side.
 function tiles(points,start,end,minZoom=5,maxZoom=15,marginKm=2){const g=geometry(points),set=new Map();for(let z=minZoom;z<=maxZoom;z++){const n=2**z;for(let km=start;;km=Math.min(end,km+.25)){const p=g.at(km),dy=marginKm/111.32,dx=dy/Math.cos(p.lat*Math.PI/180),a=tileXY(p.lat+dy,p.lng-dx,z),b=tileXY(p.lat-dy,p.lng+dx,z);for(let x=Math.floor(a.x);x<=Math.floor(b.x);x++)for(let y=Math.floor(a.y);y<=Math.floor(b.y);y++)if(x>=0&&x<n&&y>=0&&y<n)set.set(z+'/'+x+'/'+y,{z,x,y,url:tileUrl(z,x,y)});if(km>=end)break;}}return [...set.values()];}
 function offset(p,prev,next,metres){const dx=(next.lng-prev.lng)*Math.cos(p.lat*Math.PI/180),dy=next.lat-prev.lat,length=Math.hypot(dx,dy)||1;return {lat:p.lat+dx/length*metres/111320,lng:p.lng-dy/length*metres/(111320*Math.cos(p.lat*Math.PI/180))};}
 function reliefPoints(g,km){const p=g.at(km),prev=g.at(km-.02),next=g.at(km+.02);return [p,offset(p,prev,next,-15),offset(p,prev,next,15)];}
 function projectId(text){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return 'bivouac-'+(hash>>>0).toString(16);}
 const api={VERSION,MAP_CACHE,META_CACHE,RELIEF_CACHE,TILE_URL,projectId,hav,geometry,tileXY,tileUrl,projectWindowEnd,tiles,reliefPoints};root.TraverseeOfflineCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
