/* Shares the canonical embedded route and existing tools. */
(()=>{
  'use strict';
  const q=id=>document.getElementById(id);
  const root=q('homeView'),line=q('homeMetroLine'),bubble=q('homePoiBubble');
  const gps=q('homeGpsToggle'),panel=q('homeGpsPanel'),status=q('homeGpsStatus');
  const input=q('homeKmInput'),refresh=q('homeGpsRefresh'),message=q('homeMapMessage');
  const POSITION_KEY='traversee-home-position-v1';
  const categories=[{id:'water',label:'Eau',icon:'💧',button:'openWaterBtn'},{id:'bivouac',label:'Bivouac',icon:'⛺',button:'openBivouacBtn'},{id:'store',label:'Magasin',icon:'🛒',button:'openStoreBtn'},{id:'gas',label:'Gaz',icon:'🔥',button:'openGasBtn'}];
  const state={position:null,data:null,bivouac:null,selected:null,points:[],map:null,markers:new Map(),location:null,request:0,gpsBusy:false,lastGpsAttempt:0};
  let messageTimer=0,bivouacRequest=0;
  const kmText=km=>km.toFixed(1).replace('.',',');
  const escape=value=>escapeHtml(String(value??''));
  function atKm(km){
    const target=Math.max(0,Math.min(DATA.routeLengthKm,km));
    const s=SEGMENTS.find(s=>target<=s.startKm+s.lengthKm)||SEGMENTS[SEGMENTS.length-1];
    const t=s.lengthKm?Math.max(0,Math.min(1,(target-s.startKm)/s.lengthKm)):0;
    return {lat:s.a[0]+(s.b[0]-s.a[0])*t,lon:s.a[1]+(s.b[1]-s.a[1])*t};
  }
  function notice(text,ms=6500){
    clearTimeout(messageTimer);message.textContent=text;message.hidden=!text;
    if(text&&ms)messageTimer=setTimeout(()=>{message.hidden=true},ms);
  }
  function closeBubble(){
    state.selected=null;bubble.hidden=true;
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded','false'));
    updateMarkerStyles();
  }
  function closeGps(){panel.hidden=true;gps.setAttribute('aria-expanded','false');}
  function openGps(){closeBubble();panel.hidden=false;gps.setAttribute('aria-expanded','true');}
  function offsetText(p){
    if(!Number.isFinite(p.offRouteMeters))return 'Écart hors trace non renseigné';
    if(p.offRouteMeters<=40)return 'Sur la trace';
    return (p.offRouteMeters>=1000?kmText(p.offRouteMeters/1000)+' km':Math.round(p.offRouteMeters/10)*10+' m')+' hors trace';
  }
  function distanceText(p){return p.delta<.05?'À ton niveau':'Dans '+kmText(p.delta)+' km';}
  function cleanWaterName(p){
    const name=String(p.name||'Point d’eau').replace(/\s+\d+(?:[.,]\d+)?[a-z]?$/i,'').trim();
    if(name.toUpperCase()==='EAU')return 'Point d’eau';
    if(name.toUpperCase()==='WC')return 'Toilettes publiques';
    if(name.toUpperCase()==='CIMETIERE')return 'Cimetière';
    return /^[A-ZÀ-ÖØ-Þ '\-]+$/.test(name)?name.charAt(0)+name.slice(1).toLowerCase():name;
  }
  function nextProjected(rows,km){
    let best=null,score=Infinity;
    for(const p of rows||[]){
      const delta=p.km-km;if(delta<0)continue;
      const candidate=delta+(p.offRouteMeters||0)/1000;
      if(candidate<score){best={...p,delta};score=candidate;}
    }
    return best;
  }
  function nextStore(km){
    const s=ALL_STORES.find(s=>s.km>=km&&s.role!=='EXCLU'&&s.role!=='A_QUALIFIER');
    if(!s)return null;
    const actual=Number.isFinite(s.lat)&&Number.isFinite(s.lon);
    return {...s,...(actual?{}:atKm(s.km)),delta:s.km-km,routeAnchor:!actual};
  }
  function buildPoints(){
    const km=state.position?.km;
    return categories.map(category=>{
      let point=null;
      if(Number.isFinite(km)){
        if(category.id==='water')point=nextProjected(state.data?.water,km);
        if(category.id==='gas')point=nextProjected(state.data?.gas,km);
        if(category.id==='store')point=nextStore(km);
        if(category.id==='bivouac'&&state.bivouac&&state.bivouac.km>=km)point={...state.bivouac,delta:state.bivouac.km-km};
      }
      return {...category,point};
    }).sort((a,b)=>(a.point?.delta??Infinity)-(b.point?.delta??Infinity));
  }
  function render(){
    state.points=buildPoints();
    line.innerHTML=state.points.map(item=>{
      const distance=item.point?kmText(item.point.delta)+' <small>km</small>':item.id==='bivouac'?'À choisir':state.position?(state.data?'Aucun':'…'):'—';
      return '<button type="button" class="homeMetroStop'+(item.point?'':' is-unavailable')+'" data-category="'+item.id+'" aria-expanded="false" aria-controls="homePoiBubble" aria-label="'+escape(item.label+(item.point?' · '+distanceText(item.point):''))+'"><span class="homeMetroCircle" aria-hidden="true">'+item.icon+'</span><b>'+distance+'</b><small>'+item.label+'</small></button>';
    }).join('');
    if(state.map){
      state.markers.forEach(m=>m.remove());state.markers.clear();
      state.points.forEach(item=>{
        if(!item.point)return;
        const p=item.point;
        const title=(p.routeAnchor?'Accès sur la trace · ':'')+(item.id==='water'?cleanWaterName(p):p.name);
        const marker=L.marker([p.lat,p.lon],{icon:markerIcon(item),title,keyboard:true}).addTo(state.map);
        marker.on('click',e=>{L.DomEvent.stopPropagation(e);showBubble(item.id,false)});
        state.markers.set(item.id,marker);
      });
    }
  }
  function markerIcon(item){return L.divIcon({className:'homeMapPin'+(state.selected===item.id?' homeMapPinSelected':''),html:'<span>'+item.icon+'</span>',iconSize:[36,36],iconAnchor:[18,18]});}
  function updateMarkerStyles(){
    if(!state.map)return;
    state.points.forEach(item=>state.markers.get(item.id)?.setIcon(markerIcon(item)));
  }
  function showBubble(id,pan=true){
    const item=state.points.find(p=>p.id===id);if(!item)return;
    closeGps();state.selected=id;
    const p=item.point;
    const name=p?(id==='water'?cleanWaterName(p):p.name):id==='bivouac'?'Choisir un bivouac':item.label;
    const extra=p?[offsetText(p),p.routeAnchor?'Repère d’accès sur la trace':'',p.role==='CANDIDATE'?'Commerce à vérifier':''].filter(Boolean).join(' · '):(!state.position?'Choisis ta position avec le bouton GPS.':id==='bivouac'?'Ouvre le module pour préparer ce soir.':'Aucun autre point disponible.');
    bubble.innerHTML='<button type="button" class="homePoiClose" aria-label="Fermer la bulle">×</button><button type="button" class="homePoiTitle" data-open-tool="'+item.button+'"><span>'+escape(name)+'</span><em aria-hidden="true">↗</em></button>'+(p?'<div class="homePoiDistance">'+escape(distanceText(p))+'</div>':'')+'<div class="homePoiExtra">'+escape(extra)+'</div>';
    bubble.hidden=false;
    const index=state.points.findIndex(p=>p.id===id);
    bubble.style.setProperty('--bubble-arrow',Math.max(8,Math.min(90,12.5+index*25))+'%');
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.category===id)));
    updateMarkerStyles();
    if(p&&pan&&state.map)state.map.setView([p.lat,p.lon],Math.max(13,state.map.getZoom()),{animate:false});
  }
  function setPosition(position,{center=true,persist=true}={}){
    if(!position||!Number.isFinite(position.km)||position.km<0||position.km>DATA.routeLengthKm)return;
    const coord=Number.isFinite(position.lat)&&Number.isFinite(position.lon)?{lat:position.lat,lon:position.lon}:atKm(position.km);
    state.position={km:position.km,...coord,mode:position.mode==='gps'?'gps':'km',updatedAt:Date.now()};
    if(persist)safeStorageSet(POSITION_KEY,JSON.stringify(state.position));
    input.value=position.km.toFixed(1);
    ['storeKmInput','waterKmInput','gasKmInput'].forEach(id=>{const el=q(id);if(el)el.value=position.km.toFixed(1)});
    lastShown={km:position.km,stage:stageFromKm(position.km),offRoute:position.mode==='gps'?projectGps(coord.lat,coord.lon)?.distanceMeters:0};
    status.textContent=(state.position.mode==='gps'?'GPS':'Position saisie')+' · km '+kmText(position.km);
    closeBubble();render();
    if(state.map){
      if(state.location)state.location.remove();
      state.location=L.circleMarker([coord.lat,coord.lon],{radius:9,weight:3,color:'#fff',fillColor:'#315ecb',fillOpacity:1}).addTo(state.map);
      state.location.bindTooltip(state.position.mode==='gps'?'Ma position GPS':'Position au km '+kmText(position.km));
      if(center)state.map.setView([coord.lat,coord.lon],14,{animate:false});
    }
  }
  function initMap(){
    if(!window.L){notice('Carte indisponible. Les outils restent accessibles.',0);return;}
    state.map=L.map('homeMap',{zoomControl:false,preferCanvas:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(state.map);
    DATA.tracks.forEach(track=>L.polyline(track.map(p=>[p[0],p[1]]),{color:'#315ecb',weight:4,opacity:.95,interactive:false}).addTo(state.map));
    if(state.position)setPosition(state.position,{persist:false});
    else state.map.setView(DATA.tracks[0][0].slice(0,2),13);
    state.map.on('click',()=>{closeBubble();closeGps()});
    requestAnimationFrame(()=>state.map.invalidateSize({pan:false}));
  }
  function gpsBusy(value){state.gpsBusy=value;gps.classList.toggle('is-loading',value);refresh.disabled=value;gps.setAttribute('aria-busy',String(value));}
  function locate(){
    if(state.gpsBusy)return;
    if(!navigator.geolocation){status.textContent='GPS indisponible. Saisis ton km.';notice(status.textContent);return;}
    const request=++state.request;state.lastGpsAttempt=Date.now();gpsBusy(true);status.textContent='Recherche de la position…';
    navigator.geolocation.getCurrentPosition(pos=>{
      if(request!==state.request)return;
      gpsBusy(false);
      const accuracy=Number(pos.coords.accuracy),lat=pos.coords.latitude,lon=pos.coords.longitude;
      if(!Number.isFinite(accuracy)||accuracy>150){status.textContent='GPS imprécis. Réessaie ou saisis ton km.';notice(status.textContent);return;}
      const projection=projectGps(lat,lon);
      if(!projection||projection.distanceMeters>750){status.textContent='GPS hors du parcours. Saisis ton km.';notice(status.textContent);return;}
      setPosition({km:projection.km,lat,lon,mode:'gps'});closeGps();notice('');
    },error=>{
      if(request!==state.request)return;
      gpsBusy(false);status.textContent=error?.code===1?'GPS refusé. Saisis ton km.':'GPS indisponible. Réessaie ou saisis ton km.';notice(status.textContent);
    },{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  }
  async function loadPoints(){
    try{
      const response=await fetch('./home-pois.json');if(!response.ok)throw Error('points');
      const data=await response.json();if(data.routeLengthKm!==DATA.routeLengthKm||!Array.isArray(data.water)||!Array.isArray(data.gas))throw Error('route mismatch');
      state.data=data;closeBubble();render();
    }catch(_){status.textContent='Points indisponibles. Rouvre l’app avec une connexion pour les charger.';notice(status.textContent,0);}
  }
  async function refreshBivouac(){
    const request=++bivouacRequest;let db;
    try{
      if(!window.indexedDB)return;
      db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('bivouac-scout',1);
        r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('projects'))r.result.createObjectStore('projects')};
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      const saved=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      if(request!==bivouacRequest)return;
      state.bivouac=null;
      if(saved?.gpx&&saved.mode!=='three'&&Number.isFinite(Number(saved.zones?.[0]))){
        const xml=new DOMParser().parseFromString(saved.gpx,'application/xml');
        const points=Array.from(xml.getElementsByTagName('trkpt')).map(p=>[Number(p.getAttribute('lat')),Number(p.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));
        if(points.length>1){
          let walked=0,coordinate=null;const target=Number(saved.progressKm||0)+Number(saved.zones[0]);
          for(let i=1;i<points.length;i++){
            const length=havKm(points[i-1],points[i]);
            if(coordinate===null&&walked+length>=target){const t=length?Math.max(0,Math.min(1,(target-walked)/length)):0;coordinate=[points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];}
            walked+=length;
          }
          if(Math.abs(walked-DATA.routeLengthKm)<DATA.routeLengthKm*.03&&coordinate){
            const r=projectGps(...coordinate);
            if(r&&r.distanceMeters<=750)state.bivouac={name:'Bivouac prévu',km:r.km,lat:coordinate[0],lon:coordinate[1],offRouteMeters:r.distanceMeters};
          }
        }
      }
      closeBubble();render();
    }catch(_){/* A missing optional project does not block the home. */}finally{db?.close();}
  }
  gps.addEventListener('click',()=>panel.hidden?openGps():closeGps());
  refresh.addEventListener('click',locate);
  q('homeKmForm').addEventListener('submit',event=>{
    event.preventDefault();if(!input.reportValidity())return;
    ++state.request;gpsBusy(false);setPosition({km:Number(input.value),mode:'km'});closeGps();notice('');input.blur();
  });
  line.addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');if(!button)return;
    if(state.selected===button.dataset.category)closeBubble();else showBubble(button.dataset.category);
  });
  bubble.addEventListener('click',event=>{
    if(event.target.closest('.homePoiClose')){closeBubble();return;}
    const button=event.target.closest('[data-open-tool]');if(button)q(button.dataset.openTool)?.click();
  });
  root.addEventListener('click',event=>{
    if(!event.target.closest('.homePosition'))closeGps();
    if(!event.target.closest('.homeMetro,.homePoiBubble,.homeMapPin'))closeBubble();
  });
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){closeBubble();closeGps();gps.focus();}});
  window.addEventListener('traversee-position',event=>{
    ++state.request;gpsBusy(false);setPosition(event.detail,{center:false});
  });
  window.addEventListener('traversee-view',event=>{
    closeBubble();closeGps();const name=event.detail.name,p=state.position;
    if(name==='home'){
      requestAnimationFrame(()=>state.map?.invalidateSize({pan:false}));
      refreshBivouac();setTimeout(refreshBivouac,800);
    }
    if(!p)return;
    if(name==='store')show(p.km,stageFromKm(p.km),lastShown.offRoute);
    if(name==='water')window.TraverseeWater?.search({lat:p.lat,lon:p.lon},'',p.km);
    if(name==='gas')window.TraverseeGas?.render(p.km);
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&root.classList.contains('active')){
      refreshBivouac();requestAnimationFrame(()=>state.map?.invalidateSize({pan:false}));
      if(Date.now()-state.lastGpsAttempt>30000)locate();
    }
  });
  window.addEventListener('pageshow',event=>{if(event.persisted&&root.classList.contains('active')){state.map?.invalidateSize({pan:false});locate();}});
  const saved=parseJSON(safeStorageGet(POSITION_KEY));
  if(saved&&Number.isFinite(saved.km)&&saved.km>=0&&saved.km<=DATA.routeLengthKm)setPosition(saved,{persist:false});
  render();initMap();loadPoints();refreshBivouac();locate();
})();
