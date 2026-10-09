/* Shares the canonical embedded route and existing tools. */
(()=>{
  'use strict';
  const q=id=>document.getElementById(id);
  const root=q('homeView'),line=q('homeBottomBar'),bubble=q('homePoiBubble');
  const gps=q('homeGpsToggle'),panel=q('homeGpsPanel'),status=q('homeGpsStatus');
  const input=q('homeKmInput'),refresh=q('homeGpsRefresh'),message=q('homeMapMessage');
  const POSITION_KEY='traversee-home-position-v1';
  const categories=[{id:'water',label:'Eau',icon:'<svg class="soleilIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 16a4 4 0 0 0 3 4"/></svg>',button:'openWaterBtn'},{id:'bivouac',label:'Bivouac',icon:'<svg class="soleilIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 10 19H2L12 2Z M8 21l4-9 4 9"/></svg>',button:'openBivouacBtn'},{id:'store',label:'Magasin',icon:'<svg class="soleilIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h3l3 12h12l2-9H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>',button:'openStoreBtn'},{id:'gas',label:'Gaz',icon:'<svg class="soleilIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="8" width="14" height="14" rx="3"/><path d="M9 8V4h6v4M11 4V1h2v3M5 16h14"/></svg>',button:'openGasBtn'},{id:'reset',label:'Douche',icon:'<svg class="soleilIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10V6a4 4 0 0 1 8 0v2M9 10h8l-2-3h-4Z M9 14v2m4-2v2m4-2v2M9 20v2m4-2v2m4-2v2"/></svg>',button:'openResetBtn'}];
  let activeCategory='water',nextCardOpen=false;
  const state={position:null,data:null,bivouac:null,selected:null,selectedPoi:null,points:[],map:null,markers:new Map(),location:null,request:0,gpsBusy:false,lastGpsAttempt:0};
  window.TraverseeHome={getPosition:()=>state.position};
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
  function setNextCardOpen(open){
    if(nextCardOpen===open)return;
    nextCardOpen=open;
    q('homeNextCard').hidden=!open;
    root.classList.toggle('has-next-card',open);
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded',String(open&&b.dataset.category===activeCategory)));
    requestAnimationFrame(()=>state.map?.invalidateSize({pan:false}));
  }
  function closeBubble(){
    state.selected=null;state.selectedPoi=null;bubble.hidden=true;
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded',String(nextCardOpen&&b.dataset.category===activeCategory)));
    updateMarkerStyles();
  }
  function closeGps(){panel.hidden=true;gps.setAttribute('aria-expanded','false');}
  function openGps(){setNextCardOpen(false);closeBubble();panel.hidden=false;gps.setAttribute('aria-expanded','true');}
  function offsetText(p){
    if(p.customRoute)return '';
    if(!Number.isFinite(p.offRouteMeters))return 'Écart hors trace non renseigné';
    if(p.offRouteMeters<=40)return 'Sur la trace';
    return (p.offRouteMeters>=1000?kmText(p.offRouteMeters/1000)+' km':Math.round(p.offRouteMeters/10)*10+' m')+' hors trace';
  }
  function distanceText(p){return p.delta<-.05?kmText(-p.delta)+' km derrière':p.delta<.05?'À ton niveau':'Dans '+kmText(p.delta)+' km';}
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
        if(category.id==='reset'){const p=window.TraverseeResets?.next(km);if(p)point={...p,delta:p.km-km}}
        if(category.id==='store')point=nextStore(km);
        if(category.id==='bivouac'&&!state.bivouac)point=nextProjected(state.data?.camping,km);
      }
      if(category.id==='bivouac'&&state.bivouac)point={...state.bivouac,delta:state.bivouac.customRoute||!Number.isFinite(km)?state.bivouac.distanceKm:state.bivouac.km-km};
      return {...category,label:point?.type==='camping'?'Camping':category.label,point};
    }).sort((a,b)=>(a.point?.delta??Infinity)-(b.point?.delta??Infinity));
  }
  function updateNextCard(){
    const item=state.points.find(p=>p.id===activeCategory)||categories[0],p=item.point;
    q('homeNextCard').querySelector('p').textContent=activeCategory==='gas'?'PROCHAIN VENDEUR':'PROCHAIN ARRÊT';
    q('homeNextIcon').innerHTML=item.icon;q('homeNextTitle').textContent=item.label;
    q('homeNextDistance').textContent=p&&Number.isFinite(p.delta)?(Math.abs(p.delta)<1?Math.round(Math.abs(p.delta)*1000)+' m':kmText(Math.abs(p.delta))+' km'):activeCategory==='bivouac'?'Ce soir':'—';
    const name=p?(activeCategory==='water'?cleanWaterName(p):activeCategory==='gas'?window.gasPointLabel(p,p.km):p.name):!state.position?'Choisis ta position':activeCategory==='bivouac'?'Préparer mon bivouac':'Voir les points disponibles';
    q('homeNextMeta').textContent=name+(p&&activeCategory!=='reset'?' · '+offsetText(p):'');
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded',String(nextCardOpen&&b.dataset.category===activeCategory)));
    q('homeNextOpen').setAttribute('aria-label',item.label+' · '+q('homeNextDistance').textContent+' · ouvrir le module');
  }
  function render(){
    state.points=buildPoints();
    state.points.forEach(item=>{
      const button=line.querySelector('[data-category="'+item.id+'"]');
      const distance=item.point?kmText(Math.abs(item.point.delta))+' km':item.id==='bivouac'?'À choisir':state.position?(state.data?'Aucun':'…'):'—';
      button.querySelector('[data-distance]').textContent=distance;
      button.classList.toggle('is-unavailable',!item.point);
      button.setAttribute('aria-label',item.label+(item.point?' · '+distanceText(item.point):' · '+distance));
    });
    updateNextCard();
    if(state.map){state.map.setZone(bivouacZone());renderMapPois();}
  }
  const poiKey=(id,p)=>id+':'+p.lat.toFixed(6)+':'+p.lon.toFixed(6);
  function allMapPois(){
    const result=[],km=state.position?.km;
    const add=(id,points)=>{const category=categories.find(c=>c.id===id);for(const p of points||[]){
      if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
      result.push({...category,point:{...p,delta:Number.isFinite(km)?p.km-km:null},key:poiKey(id,p)});
    }};
    add('reset',window.TraverseeResets?.points);
    add('gas',state.data?.gas);
    add('store',ALL_STORES.filter(p=>!['EXCLU','A_QUALIFIER'].includes(p.role)).map(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)?p:{...p,...atKm(p.km),routeAnchor:true}));
    add('bivouac',state.data?.camping);
    add('water',state.data?.water);
    return result;
  }
  function renderMapPois(){
    if(!state.map)return;
    const {width,height}=state.map.size();if(!width||!height)return;
    const visible=new Map(),placed=[];
    const candidates=allMapPois().map(item=>({...item,xy:state.map.screenPoint(item.point)}))
      .filter(({xy})=>Number.isFinite(xy.x)&&Number.isFinite(xy.y)&&xy.x>=0&&xy.y>=0&&xy.x<=width&&xy.y<=height)
      .sort((a,b)=>Math.hypot(a.xy.x-width/2,a.xy.y-height/2)-Math.hypot(b.xy.x-width/2,b.xy.y-height/2));
    // A small number of individual pins, nearest to the view centre; no clusters.
    if(state.selectedPoi){const xy=state.map.screenPoint(state.selectedPoi.point);if(xy.x>=0&&xy.y>=0&&xy.x<=width&&xy.y<=height)candidates.unshift({...state.selectedPoi,xy})}
    for(const item of candidates){
      if(visible.has(item.key)||placed.some(xy=>Math.hypot(item.xy.x-xy.x,item.xy.y-xy.y)<44))continue;
      placed.push(item.xy);visible.set(item.key,item);if(visible.size>=8)break;
    }
    state.markers.forEach((marker,key)=>{if(!visible.has(key)){marker.remove();state.markers.delete(key)}});
    visible.forEach((item,key)=>{
      if(state.markers.has(key))return;
      const p=item.point,title=(p.routeAnchor?'Accès sur la trace · ':'')+(item.id==='water'?cleanWaterName(p):item.id==='gas'?window.gasPointLabel(p,p.km):p.name);
      state.markers.set(key,state.map.addMarker(p,item.icon,title,()=>showBubble(item.id,false,{...item,point:{...p,delta:Number.isFinite(state.position?.km)?p.km-state.position.km:null}})));
    });
    updateMarkerStyles();
  }

  function bivouacZone(){
    const p=state.bivouac;if(!p)return null;
    if(p.zoneCoordinates?.length>1)return p.zoneCoordinates;
    if(p.customRoute||!Number.isFinite(p.km))return null;
    const a=Math.max(0,p.km-3),b=Math.min(DATA.routeLengthKm,p.km+3),coords=[];
    for(let k=a;k<b;k+=.025){const p=atKm(k);coords.push([p.lat,p.lon])}
    const end=atKm(b);coords.push([end.lat,end.lon]);return coords;
  }
  function updateMarkerStyles(){
    if(!state.map)return;
    state.markers.forEach((m,key)=>state.map.selectMarker(m,state.selectedPoi?.key===key));
  }
  function showBubble(id,pan=true,selectedPoi=null){
    const item=selectedPoi||state.points.find(p=>p.id===id);if(!item)return;
    setNextCardOpen(false);closeGps();state.selected=id;state.selectedPoi=item.point?{...item,key:poiKey(id,item.point)}:null;
    const p=item.point;
    const name=p?(id==='water'?cleanWaterName(p):id==='gas'?window.gasPointLabel(p,p.km):p.name):id==='bivouac'?'Choisir un bivouac':item.label;
    const extra=p?(id==='reset'?'':[offsetText(p),id==='gas'?p.gasContact||'':p.note||'',p.hours||'',p.routeAnchor?'Repère d’accès sur la trace':''].filter(Boolean).join(' · ')):(!state.position?'Choisis ta position avec le bouton GPS.':id==='bivouac'?'Ouvre le module pour préparer ce soir.':'Aucun autre point disponible.');
    bubble.innerHTML='<button type="button" class="homePoiClose" aria-label="Fermer la fiche">×</button><div class="homePoiTitle">'+escape(name)+'</div>'+(p&&Number.isFinite(p.delta)?'<div class="homePoiDistance">'+escape(distanceText(p))+'</div>':'')+(extra?'<div class="homePoiExtra">'+escape(extra)+'</div>':'')+'<button type="button" class="homePoiOpen" data-open-tool="'+item.button+'">'+(id==='reset'?'Douche · lessive · recharge':id==='bivouac'?'Préparer mon bivouac':id==='water'?'Plus de points d’eau':id==='store'?'Plus de magasins':id==='gas'?'Trouver plus de gaz':'Ouvrir '+item.label.toLowerCase())+' ↗</button>';
    if(p?.phone)bubble.innerHTML+='<a class="homePoiSource" href="tel:'+escape(p.phone.replace(/[^+0-9]/g,''))+'">Appeler '+escape(p.phone)+'</a>';
    if(p?.sourceUrl)bubble.innerHTML+='<a class="homePoiSource" href="'+escape(p.sourceUrl)+'" target="_blank" rel="noopener">Infos du site ↗</a>';
    bubble.hidden=false;
    line.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.category===id)));
    updateMarkerStyles();
    if(p&&pan&&state.map)state.map.setView([p.lat,p.lon],Math.max(13,state.map.getZoom()),{animate:false});
  }
  function setPosition(position,{center=true,persist=true,manualEntry=false}={}){
    if(!position||!Number.isFinite(position.km)||position.km<0||position.km>DATA.routeLengthKm)return;
    const coord=position.mode==='gps'&&Number.isFinite(position.lat)&&Number.isFinite(position.lon)?{lat:position.lat,lon:position.lon}:atKm(position.km);
    state.position={km:position.km,...coord,mode:position.mode==='gps'?'gps':'km',updatedAt:persist?Date.now():(position.updatedAt||Date.now()),accuracy:position.accuracy,offRouteMeters:position.offRouteMeters,routeId:DATA.routeId,routeVersion:DATA.version};
    if(persist)safeStorageSet(POSITION_KEY,JSON.stringify(state.position));
    input.value=position.km.toFixed(1);
    ['storeKmInput','waterKmInput','gasKmInput'].forEach(id=>{const el=q(id);if(el)el.value=position.km.toFixed(1)});
    lastShown={km:position.km,stage:stageFromKm(position.km),offRoute:position.mode==='gps'?projectGps(coord.lat,coord.lon)?.distanceMeters:0};
    status.textContent=(state.position.mode==='gps'?'GPS':'Position saisie')+' · km '+kmText(position.km);
    closeBubble();render();
    window.dispatchEvent(new CustomEvent('traversee-home-position',{detail:{...state.position,manualEntry}}));
    if(state.map){
      state.map.setPosition(state.position,center);
    }
  }
  function syncCompass(){
    const button=q('homeCompassToggle'),north=!state.map?.gl||state.map.getViewMode()==='north';
    button.disabled=!state.map?.gl;
    button.setAttribute('aria-pressed',String(north));
    const label=!state.map?.gl?'Vue verticale, nord en haut · vue inclinée indisponible':north?'Revenir à la vue inclinée dans le sens de la marche':'Afficher la carte verticale, nord en haut';
    button.setAttribute('aria-label',label);button.title=label;
    q('homeCompassMode').textContent=north?'N':'3D';
  }
  function initMap(){
    const start=state.position||atKm(0);
    state.map=window.TraverseeHomeMap.create({tracks:DATA.tracks,inactive:window.TraverseeRoutes.inactiveLeg,start,atKm});
    syncCompass();
    if(!state.map){notice('Carte indisponible. Les outils restent accessibles.',0);return}
    if(state.position)setPosition(state.position,{persist:false});else render();
    state.map.on('click',()=>{setNextCardOpen(false);closeBubble();closeGps()});
    state.map.on('moveend',renderMapPois);state.map.on('resize',renderMapPois);renderMapPois();
    requestAnimationFrame(()=>state.map.invalidateSize());
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
      setPosition({km:projection.km,lat,lon,mode:'gps',accuracy,offRouteMeters:projection.distanceMeters});closeGps();notice('');
    },error=>{
      if(request!==state.request)return;
      gpsBusy(false);status.textContent=error?.code===1?'GPS refusé. Saisis ton km.':'GPS indisponible. Réessaie ou saisis ton km.';notice(status.textContent);
    },{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  }
  async function loadPoints(){
    try{
      const response=await fetch(DATA.routeId==='brenne'?'./home-pois-brenne.json?v=1.262':'./home-pois.json?v=1.262');if(!response.ok)throw Error('points');
      const data=await response.json();if(Math.abs(data.routeLengthKm-DATA.routeLengthKm)>.001||data.routeId!==DATA.routeId||!Array.isArray(data.water)||!Array.isArray(data.gas))throw Error('route mismatch');
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
      const previous=JSON.stringify(state.bivouac);
      const point=window.TraverseeBivouacPoint.fromSaved(saved,{...window.TraverseeRoutes,project:projectGps});
      if(point&&point.updatedAt<(state.bivouac?.updatedAt||0))return;
      state.bivouac=point;
      if(previous!==JSON.stringify(state.bivouac)){
        const selected=state.selected,selectedPoi=state.selectedPoi;render();
        if(selected)showBubble(selected,false,selectedPoi);
      }
    }catch(_){/* A missing optional project does not block the home. */}finally{db?.close();}
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==q('bivouacHost')?.contentWindow||event.data?.type!=='bivouac-selection')return;
    const point=window.TraverseeBivouacPoint.fromSnapshot(event.data.point,window.TraverseeRoutes);if(!point)return;
    ++bivouacRequest;state.bivouac=point;const selected=state.selected,selectedPoi=state.selectedPoi;render();if(selected)showBubble(selected,false,selectedPoi);
  });
  gps.addEventListener('click',()=>panel.hidden?openGps():closeGps());
  refresh.addEventListener('click',locate);
  q('homeCompassToggle').addEventListener('click',()=>{
    if(!state.map?.gl)return;
    closeGps();closeBubble();
    state.map.setViewMode(state.map.getViewMode()==='north'?'pov':'north');
    syncCompass();
  });
  const routeChoice=q('homeRouteChoice');routeChoice.value=DATA.routeId;
  routeChoice.addEventListener('change',()=>{if(window.TraverseeRoutes.choose(routeChoice.value)===false){routeChoice.value=DATA.routeId;status.textContent='Impossible de mémoriser le parcours.';}});
  q('homeKmForm').addEventListener('submit',event=>{
    event.preventDefault();if(!input.reportValidity())return;
    ++state.request;gpsBusy(false);setPosition({km:Number(input.value),mode:'km'},{manualEntry:true});closeGps();notice('');input.blur();
  });
  line.addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');if(!button||!event.isTrusted)return;
    event.stopImmediatePropagation();
    const open=!(nextCardOpen&&activeCategory===button.dataset.category);
    closeBubble();closeGps();activeCategory=button.dataset.category;setNextCardOpen(open);updateNextCard();
  },true);
  let swipeUntil=0;
  q('homeNextOpen').addEventListener('click',()=>{if(Date.now()<swipeUntil)return;const item=categories.find(p=>p.id===activeCategory);q(item.button)?.click();});
  let swipeX=null;const nextCard=q('homeNextOpen');
  nextCard.addEventListener('touchstart',e=>{swipeX=e.touches[0].clientX},{passive:true});
  nextCard.addEventListener('touchend',e=>{if(swipeX===null)return;const dx=e.changedTouches[0].clientX-swipeX;swipeX=null;if(Math.abs(dx)<40)return;swipeUntil=Date.now()+500;const ids=['water','store','gas','reset','bivouac'];activeCategory=ids[(ids.indexOf(activeCategory)+(dx<0?1:4))%5];closeBubble();updateNextCard();},{passive:true});
  bubble.addEventListener('click',event=>{
    if(event.target.closest('.homePoiClose')){closeBubble();return;}
    const button=event.target.closest('[data-open-tool]');if(button){if(state.selected==='reset'&&state.selectedPoi?.point?.id)window.TraverseeResets.open(state.selectedPoi.point.id);else q(button.dataset.openTool)?.click();}
  });
  root.addEventListener('click',event=>{
    if(!event.target.closest('.homeBottomBar,.soleilNext'))setNextCardOpen(false);
    if(!event.target.closest('.homePosition'))closeGps();
    if(!event.target.closest('.homeBottomBar,.homePoiBubble,.homeMapPin'))closeBubble();
  });
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){setNextCardOpen(false);closeBubble();closeGps();gps.focus();}});
  window.addEventListener('traversee-position',event=>{
    ++state.request;gpsBusy(false);setPosition(event.detail,{center:event.detail?.mode!=='gps',manualEntry:event.detail?.mode==='km'});
  });
  window.addEventListener('traversee-view',event=>{
    setNextCardOpen(false);closeBubble();closeGps();const name=event.detail.name,p=state.position;
    if(name==='home'){
      requestAnimationFrame(()=>{state.map?.invalidateSize({pan:false});if(p)state.map?.setPosition(p,true)});
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
      if(state.position?.mode!=='km'&&Date.now()-state.lastGpsAttempt>30000)locate();
    }
  });
  window.addEventListener('pageshow',event=>{if(event.persisted&&root.classList.contains('active')){state.map?.invalidateSize({pan:false});if(state.position?.mode!=='km')locate();}});
  const saved=parseJSON(safeStorageGet(POSITION_KEY));
  if(saved&&Number.isFinite(saved.km)){
    if(saved.routeId===DATA.routeId&&saved.routeVersion===DATA.version)setPosition(saved,{persist:false});
    else if(Number.isFinite(saved.lat)&&Number.isFinite(saved.lon)){
      const projected=projectGps(saved.lat,saved.lon);
      if(projected&&projected.distanceMeters<=750)setPosition({...saved,km:projected.km});
      else {status.textContent='Choisis ta position sur ce parcours.';openGps();}
    }
  }
  render();initMap();loadPoints();refreshBivouac();if(state.position?.mode!=='km')locate();
})();

