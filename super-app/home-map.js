/* Perspective home map; Leaflet remains available when WebGL is unavailable. */
(()=>{
  const empty=()=>({type:'FeatureCollection',features:[]});
  const feature=(type,coordinates)=>({type:'Feature',properties:{},geometry:{type,coordinates}});
  function bearing(a,b){const r=Math.PI/180,x=a.lat*r,y=b.lat*r,d=(b.lon-a.lon)*r;return Math.atan2(Math.sin(d)*Math.cos(y),Math.cos(x)*Math.sin(y)-Math.sin(x)*Math.cos(y)*Math.cos(d))/r;}
  function create({tracks,inactive,start,atKm}){
    if(!window.maplibregl)return leaflet({tracks,inactive,start});
    try{
      const sources={osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'},route:{type:'geojson',data:feature('MultiLineString',tracks.map(t=>t.map(p=>[p[1],p[0]])))},alternative:{type:'geojson',data:feature('LineString',inactive.map(p=>[p[1],p[0]]))},bivouac:{type:'geojson',data:empty()},position:{type:'geojson',data:empty()}};
      const map=new maplibregl.Map({container:'homeMap',center:[start.lon,start.lat],zoom:13,pitch:45,bearing:0,maxPitch:60,attributionControl:false,style:{version:8,sources,layers:[{id:'osm',type:'raster',source:'osm'},{id:'alternative',type:'line',source:'alternative',paint:{'line-color':'#7d8b7e','line-width':3,'line-dasharray':[2,2]}},{id:'route',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#315ecb','line-width':4}},{id:'bivouac-band',type:'line',source:'bivouac',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ef9537','line-width':30,'line-opacity':.28}},{id:'bivouac-line',type:'line',source:'bivouac',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e68b24','line-width':7,'line-opacity':.9}},{id:'position',type:'circle',source:'position',paint:{'circle-radius':8,'circle-color':'#315ecb','circle-stroke-color':'white','circle-stroke-width':3}}]}});
      map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
      let zone=empty(),position=empty();
      map.on('load',()=>{map.getSource('bivouac').setData(zone);map.getSource('position').setData(position)});
      const update=(id,data)=>{if(map.isStyleLoaded())map.getSource(id)?.setData(data)};
      return {gl:true,on:(e,fn)=>map.on(e,fn),invalidateSize:()=>map.resize(),getZoom:()=>map.getZoom(),
        setView(ll,z){map.jumpTo({center:[ll[1],ll[0]],zoom:z})},
        setPosition(p,center){position=feature('Point',[p.lon,p.lat]);update('position',position);if(center){const ahead=atKm(p.km+.5);map.jumpTo({center:[p.lon,p.lat],zoom:14.5,pitch:45,bearing:bearing(p,ahead)});map.panBy([0,-Math.min(110,map.getContainer().clientHeight*.16)],{duration:0})}},
        setZone(coords){zone=coords?.length>1?feature('LineString',coords.map(p=>[p[1],p[0]])):empty();update('bivouac',zone)},
        addMarker(p,icon,title,click){const el=document.createElement('button');el.type='button';el.className='homeMapPin';el.innerHTML='<span>'+icon+'</span>';el.setAttribute('aria-label',title);el.addEventListener('click',e=>{e.stopPropagation();click()});return new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([p.lon,p.lat]).addTo(map)},
        selectMarker(marker,on){marker.getElement().classList.toggle('homeMapPinSelected',on)}
      };
    }catch(_){document.getElementById('homeMap').replaceChildren();return leaflet({tracks,inactive,start})}
  }
  function leaflet({tracks,inactive,start}){
    if(!window.L)return null;
    const map=L.map('homeMap',{zoomControl:false,preferCanvas:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    L.polyline(inactive,{color:'#7d8b7e',weight:3,dashArray:'7 7',interactive:false}).addTo(map);
    tracks.forEach(t=>L.polyline(t,{color:'#315ecb',weight:4,interactive:false}).addTo(map));map.setView([start.lat,start.lon],13);
    let pos,zone=[];
    return {gl:false,on:(e,f)=>map.on(e,f),invalidateSize:()=>map.invalidateSize({pan:false}),getZoom:()=>map.getZoom(),setView:(ll,z)=>map.setView(ll,z,{animate:false}),setPosition(p,center){pos?.remove();pos=L.circleMarker([p.lat,p.lon],{radius:9,weight:3,color:'#fff',fillColor:'#315ecb',fillOpacity:1}).addTo(map);if(center)map.setView([p.lat,p.lon],14,{animate:false})},setZone(coords){zone.forEach(l=>l.remove());zone=[];if(coords?.length>1){zone=[L.polyline(coords,{color:'#ef9537',weight:30,opacity:.28,interactive:false}).addTo(map),L.polyline(coords,{color:'#e68b24',weight:7,opacity:.9,interactive:false}).addTo(map)]}},addMarker(p,icon,title,click){return L.marker([p.lat,p.lon],{icon:L.divIcon({className:'homeMapPin',html:'<span>'+icon+'</span>',iconSize:[36,36],iconAnchor:[18,18]}),title}).addTo(map).on('click',e=>{L.DomEvent.stopPropagation(e);click()})},selectMarker(marker,on){marker.getElement()?.classList.toggle('homeMapPinSelected',on)}};
  }
  window.TraverseeHomeMap={create};
})();
