(()=>{
 'use strict';
 const KEY='traversee-reset-state-v1',E=window.TraverseeResetEngine,q=id=>document.getElementById(id),esc=v=>escapeHtml(String(v??''));
 const fmt=n=>Number(n).toFixed(1).replace('.',','),labels={complete:'Reset complet',usable:'Reset utilisable',backup:'Option de secours'};
 let state=parseJSON(safeStorageGet(KEY))||{history:[],samples:[]};if(!Array.isArray(state.history))state.history=[];if(!Array.isArray(state.samples))state.samples=[];
 let position=null,map=null,userMarker=null,markers=new Map(),selectedId=null,gpsRequest=0;
 const points=E.projectPoints(window.TRAVERSEE_RESET_POINTS,projectGps);
 function save(){if(safeStorageSet(KEY,JSON.stringify(state)))return true;q('resetMessage').textContent='Impossible d’enregistrer sur cet appareil.';return false}
 function pace(){return E.recentPace(state.samples)}
 function days(distance){const d=E.walkingDays(distance,pace());if(d.max<1)return 'moins d’un jour de marche';const lo=Math.max(1,Math.round(d.min)),hi=Math.max(lo,Math.round(d.max));return '≈ '+(d.recent||lo===hi?lo:lo+'–'+hi)+' jours de marche'}
 function at(km){const s=SEGMENTS.find(s=>km<=s.startKm+s.lengthKm)||SEGMENTS.at(-1),t=s.lengthKm?Math.max(0,Math.min(1,(km-s.startKm)/s.lengthKm)):0;return {lat:s.a[0]+(s.b[0]-s.a[0])*t,lon:s.a[1]+(s.b[1]-s.a[1])*t}}
 function eligible(p){return p.level==='complete'&&p.offRouteMeters<=5000}
 function next(km){return E.upcoming(points,km).find(p=>p.level!=='backup'&&p.offRouteMeters<=5000)||null}
 function distance(p){return position?'Dans '+fmt(Math.max(0,p.km-position.km))+' km sur la trace · '+days(Math.max(0,p.km-position.km)):'Km '+fmt(p.km)+' sur le parcours'}
 function access(p){
  if(p.access?.verified)return 'Détour : '+fmt(p.access.additionalKm)+' km supplémentaires';
  if(!Number.isFinite(p.offRouteMeters))return 'Accès à confirmer';
  if(p.offRouteMeters<40)return 'À proximité immédiate de la trace · accès à vérifier';
  return 'Écart à vol d’oiseau : '+(p.offRouteMeters<1000?Math.round(p.offRouteMeters)+' m':fmt(p.offRouteMeters/1000)+' km')+'. Trajet pédestre à vérifier.';
 }
 const serviceIcons={shower:['Douche','🚿'],washer:['Lave-linge','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="3"/><path d="M3 7h18M6 4.5h3"/><circle cx="12" cy="14" r="5"/><path d="M8 14q2-2 4 0t4 0"/></svg>'],dryer:['Sèche-linge','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="3"/><path d="M3 7h18M6 4.5h3"/><circle cx="12" cy="14" r="5"/><path d="M10 17v-6m4 6v-6"/></svg>'],power:['Recharge','🔌'],sleep:['Camping','⛺']};
 function service(p){return Object.entries(serviceIcons).map(([k,[name,icon]])=>{const status=p.services[k]===true?'Confirmé':p.services[k]===false?'Absent':'À confirmer',label=name+' : '+status;return '<li class="resetService '+(p.services[k]===true?'yes':p.services[k]===false?'no':'unknown')+'" title="'+label+'" aria-label="'+label+'"><span aria-hidden="true">'+icon+'</span><b aria-hidden="true">'+(p.services[k]===true?'✓':p.services[k]===false?'×':'?')+'</b></li>'}).join('')}

 function card(p,isNext){const nextComplete=position?E.upcoming(points,position.km).find(eligible):null;return '<article class="resetPlace" id="reset-place-'+p.id+'"><div class="resetPlaceHead"><span class="resetBadge '+p.level+'">'+labels[p.level]+'</span>'+(isNext?'<span class="resetPossible">Reset possible</span>':'')+'</div><h3>'+esc(p.name)+'</h3>'+(Number.isFinite(p.km)?'<p class="resetDistance">'+esc(distance(p))+'</p>':'<p>Position à confirmer</p>')+'<p class="resetAccess">'+esc(access(p))+'</p>'+(p.offRouteMeters>1000?'<p class="resetWarning">Détour important possible : au moins '+fmt(2*p.offRouteMeters/1000)+' km pour un aller-retour.</p>':'')+(nextComplete?.id===p.id?'<p class="resetOpportunity">Prochaine vraie opportunité · ouverture 2027 à confirmer</p>':'')+'<ul class="resetServices">'+service(p)+'</ul><p class="resetChecked">Vérifié le '+p.checkedAt.split('-').reverse().join('/')+' · 2027 à confirmer</p><div class="resetActions">'+(Number.isFinite(p.lat)?'<button type="button" data-reset-map="'+p.id+'">Voir sur la carte</button>':'')+'<button type="button" class="resetDone" data-reset-record="'+p.id+'" data-complete="true">Reset effectué ici</button><button type="button" data-reset-record="'+p.id+'" data-complete="false">Reset partiel</button></div><div id="reset-confirm-'+p.id+'"></div></article>'}
 function render(){
  position=window.TraverseeHome?.getPosition()||position;
  const pp=pace(),current=position?.km??0,gs=E.groups(points,current),first=position?next(current):null;
  q('resetKmInput').max=DATA.routeLengthKm;if(position)q('resetKmInput').value=position.km.toFixed(1);
  q('resetRouteChoice').value=DATA.routeId;
  q('resetStatus').textContent='';
  q('resetPace').textContent='';
  const complete=E.upcoming(points,current).filter(eligible),following=first?complete.find(p=>p.zone!==first.zone&&p.km>first.km):null;
  const gap=following&&first?following.km-first.km:null;
  q('resetNext').innerHTML=!position?'':!first?'<strong>Aucune autre opportunité enregistrée devant toi.</strong>':'<span>Reset possible</span><h2>'+esc(first.zone)+'</h2><strong>'+esc(distance(first))+'</strong>'+(gap>5*(pp.kmPerDay||25)?'<p>Reset conseillé si tu en as besoin : '+days(gap)+' avant le prochain reset complet enregistré dans une autre zone.</p>':'')+(following?'<p>Alternative disponible plus loin : '+esc(following.zone)+' · dans '+fmt(following.km-current)+' km.</p>':'');
  const last=state.history.filter(r=>r.complete).at(-1),since=E.sinceReset(last,position,projectGps,state.samples);
  q('resetTracking').innerHTML=last?'<b>Dernier reset : '+esc(last.name)+'</b><span>'+new Date(last.at).toLocaleDateString('fr-FR')+(since?' · '+fmt(since.km)+' km depuis'+(since.days?' · '+since.days+' jours de marche observés':''):'')+'</span>':'<span>Aucun reset effectué enregistré.</span>';
  if(state.history.length)q('resetTracking').innerHTML+='<button type="button" id="resetUndo">Annuler le dernier enregistrement</button>';
  q('resetList').innerHTML=gs.map(g=>'<section class="resetZone"><h2>'+esc(g.name)+'</h2>'+g.points.map(p=>card(p,first?.id===p.id)).join('')+'</section>').join('');
  updateMap();
 }
 function updateMap(){if(!map)return;markers.forEach((m,id)=>{const p=points.find(p=>p.id===id);m.setOpacity(!position||p.km>=position.km-.1?1:.35)});if(position){if(!userMarker)userMarker=L.circleMarker([position.lat,position.lon],{radius:7,color:'#fff',weight:3,fillColor:'#315ecb',fillOpacity:1}).addTo(map);else userMarker.setLatLng([position.lat,position.lon]);}const target=points.find(p=>p.id===selectedId)||next(position?.km??0);if(target)map.setView([target.lat,target.lon],14);}
 function initMap(){if(map)return;map=L.map('resetMap',{zoomControl:true,preferCanvas:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);DATA.tracks.forEach(t=>L.polyline(t.map(p=>[p[0],p[1]]),{color:'#315ecb',weight:3}).addTo(map));points.forEach(p=>{if(!Number.isFinite(p.lat))return;const colors={complete:'#206b4c',usable:'#b06d13',backup:'#697588'};const m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'resetMapIcon',html:'<span style="--reset-color:'+colors[p.level]+'" aria-label="'+esc(p.name)+'">🚿</span>',iconSize:[44,50],iconAnchor:[22,46]})}).addTo(map);m.bindTooltip(p.name+' · '+labels[p.level]);m.on('click',()=>select(p.id,false));markers.set(p.id,m)});map.setView(position?[position.lat,position.lon]:[46.6,2.5],position?9:5);updateMap();q('resetMap').setAttribute('aria-label','Carte des resets et du parcours '+DATA.routeId)}
 function select(id,pan=true){selectedId=id;const p=points.find(p=>p.id===id);if(pan&&p&&map)map.setView([p.lat,p.lon],14);q('reset-place-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest'});q('reset-place-'+id)?.classList.add('resetSelected');document.querySelectorAll('.resetPlace').forEach(el=>{if(el.id!=='reset-place-'+id)el.classList.remove('resetSelected')});}
 function recordSample(p){if(p.mode!=='gps'||!Number.isFinite(p.accuracy)||p.offRouteMeters>100||p.accuracy>100)return;const ss=state.samples,last=ss.at(-1);if(last&&p.updatedAt-last.updatedAt<10*60000)return;ss.push({...p});state.samples=ss.filter(s=>Date.now()-s.updatedAt<30*86400000);save()}
 function gps(){if(!navigator.geolocation){q('resetMessage').textContent='GPS indisponible. Saisis ton kilomètre.';return}const request=++gpsRequest;q('resetMessage').textContent='Recherche de la position…';navigator.geolocation.getCurrentPosition(pos=>{if(request!==gpsRequest)return;if(!Number.isFinite(pos.coords.accuracy)||pos.coords.accuracy>150){q('resetMessage').textContent='GPS trop imprécis. Réessaie ou saisis ton kilomètre.';return}const r=projectGps(pos.coords.latitude,pos.coords.longitude);if(!r||r.distanceMeters>5000){q('resetMessage').textContent='Tu es trop loin du parcours. Saisis ton kilomètre.';return}q('resetMessage').textContent=r.distanceMeters>100?'Position hors trace : progression approximative.':'';window.dispatchEvent(new CustomEvent('traversee-position',{detail:{km:r.km,lat:pos.coords.latitude,lon:pos.coords.longitude,mode:'gps',offRouteMeters:r.distanceMeters,accuracy:pos.coords.accuracy}}));},()=>{if(request===gpsRequest)q('resetMessage').textContent='GPS indisponible ou refusé. Saisis ton kilomètre.'},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
 q('resetGpsBtn').addEventListener('click',()=>{try{gps()}catch(_){q('resetMessage').textContent='GPS indisponible. Saisis ton kilomètre.'}});
 q('resetKmForm').addEventListener('submit',event=>{event.preventDefault();const input=q('resetKmInput');if(input.value.trim()===''||!input.reportValidity())return;++gpsRequest;q('resetMessage').textContent='';window.dispatchEvent(new CustomEvent('traversee-position',{detail:{km:Number(input.value),mode:'km'}}))});
 q('resetRouteChoice').addEventListener('change',()=>{if(window.TraverseeRoutes.choose(q('resetRouteChoice').value)===false)q('resetMessage').textContent='Impossible de mémoriser le parcours.'});
 q('resetList').addEventListener('click',event=>{
  const btn=event.target.closest('button');if(!btn)return;
  if(btn.dataset.resetMap){initMap();select(btn.dataset.resetMap);q('resetMap').scrollIntoView({behavior:'smooth',block:'start'});return}
  const p=points.find(p=>p.id===btn.dataset.resetRecord);if(!p)return;
  if(btn.dataset.resetRecord){if(!position){q('resetMessage').textContent='Indique ta position avant d’enregistrer un reset.';return}if(Math.abs(position.km-p.km)>5){q('resetMessage').textContent='Ce lieu est loin de la position indiquée. Actualise le GPS ou saisis le kilomètre du lieu pour enregistrer ce reset.';q('resetMessage').scrollIntoView({block:'nearest'});return}const complete=btn.dataset.complete==='true',entry={id:p.id,name:p.name,at:Date.now(),km:position.km,lat:position.lat,lon:position.lon,routeId:DATA.routeId,complete};const old=state.history;state.history=[...old,entry];if(!save()){state.history=old;return}q('resetMessage').textContent=complete?'Reset enregistré. Le suivi repart de zéro.':'Services partiels enregistrés. Le suivi du reset complet est conservé.';render()}
 });
 q('resetTracking').addEventListener('click',event=>{if(event.target.id!=='resetUndo')return;const old=state.history;state.history=old.slice(0,-1);if(!save()){state.history=old;return}q('resetMessage').textContent='Dernier enregistrement annulé.';render()});
 q('openResetBtn').addEventListener('click',()=>openAppView('reset'));
 window.addEventListener('traversee-home-position',event=>{position=event.detail;selectedId=null;recordSample(position);render()});
 window.addEventListener('traversee-view',event=>{if(event.detail.name!=='reset')return;render();initMap();requestAnimationFrame(()=>map?.invalidateSize());if(selectedId)select(selectedId)});
 window.TraverseeResets={points,next,open(id){selectedId=id;q('openResetBtn').click()},pace};
 render();
})();
