/* Read the actual chosen bivouac, including short trips and three-day projects. */
(()=>{
  const hav=(a,b)=>{const r=Math.PI/180,p=a[0]*r,q=b[0]*r;return 2*6371.0088*Math.asin(Math.sqrt(Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin((b[1]-a[1])*r/2)**2));};
  function fromSnapshot(p,route){
    if(!p||![p.lat,p.lon,p.distanceKm].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.distanceKm<0)return null;
    const canonical=p.routeId===route.id&&p.routeVersion===route.version&&Number.isFinite(p.routeKm);
    const zoneCoordinates=Array.isArray(p.zoneCoordinates)?p.zoneCoordinates.filter(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=90&&Math.abs(c[1])<=180):null;
    return {zoneCoordinates,name:'Bivouac choisi',lat:p.lat,lon:p.lon,km:canonical?p.routeKm:null,customRoute:!canonical,distanceKm:p.distanceKm,updatedAt:Number(p.updatedAt)||0,offRouteMeters:canonical?0:null,note:canonical?'':p.note||'Sur le GPX du projet Bivouac'};
  }
  function fromSaved(saved,route){
    const snapshot=fromSnapshot(saved?.homeBivouac,route);if(snapshot?.zoneCoordinates?.length>1)return snapshot;
    if(!saved?.gpx||!Array.isArray(saved.zones)||!saved.zones.length)return null;
    const xml=new DOMParser().parseFromString(saved.gpx,'application/xml');
    if(xml.getElementsByTagName('parsererror').length)return null;
    // Independent tracks are alternatives, not a single concatenated walk.
    const tracks=Array.from(xml.getElementsByTagNameNS('*','trk'));if(tracks.length>1)return null;
    let nodes=Array.from(xml.getElementsByTagNameNS('*','trkpt'));if(!nodes.length)nodes=Array.from(xml.getElementsByTagNameNS('*','rtept'));
    const points=nodes.map(p=>[Number(p.getAttribute('lat')),Number(p.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(points.length<2)return null;
    const selected=Math.max(0,Math.min(saved.zones.length-1,Math.floor(Number(saved.selected)||0)));
    const progress=saved.mode==='three'?0:Math.max(0,Number(saved.progressKm)||0);
    const distance=saved.zones.slice(0,selected+1).map(Number).reduce((a,b)=>a+b,0);if(!Number.isFinite(distance)||distance<0)return null;
    let walked=0,coordinate=null;const target=progress+distance,zoneCoordinates=[];
    for(let i=1;i<points.length;i++){const length=hav(points[i-1],points[i]);if(coordinate===null&&walked+length>=target){const t=length?Math.max(0,Math.min(1,(target-walked)/length)):0;coordinate=[points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];}const low=Math.max(walked,target-3),high=Math.min(walked+length,target+3);
      if(high>=low&&length>0){for(const km of [low,high]){const t=(km-walked)/length;zoneCoordinates.push([points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t])}}
      walked+=length;}
    if(!coordinate&&target<=walked+.01)coordinate=points.at(-1);if(!coordinate)return null;
    const canonical=saved.mode!=='three'&&Math.abs(walked-route.data.routeLengthKm)<route.data.routeLengthKm*.03&&hav(points[0],route.points[0])<.1&&hav(points.at(-1),route.points.at(-1))<.1;
    const projection=canonical?route.project(...coordinate):null;
    if(snapshot)return {...snapshot,zoneCoordinates};
    return {zoneCoordinates,name:'Bivouac choisi',lat:coordinate[0],lon:coordinate[1],km:projection?.distanceMeters<=750?projection.km:null,customRoute:!projection||projection.distanceMeters>750,distanceKm:distance,updatedAt:0,offRouteMeters:projection?.distanceMeters??null,note:canonical?'':saved.mode==='three'?'Depuis le départ de ton GPX':'Depuis la position du projet Bivouac'};
  }
  window.TraverseeBivouacPoint={fromSnapshot,fromSaved};
})();

