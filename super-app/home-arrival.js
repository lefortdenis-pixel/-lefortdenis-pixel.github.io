/* A destination is a chainage on the selected GPX, never a routed shortcut. */
(()=>{
  'use strict';
  const q=id=>document.getElementById(id),home=window.TraverseeHome;
  const key='traversee-arrival-v1:'+DATA.routeId;
  let destination=null,picking=false,marker=null,speed=4;
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===DATA.version&&Number.isFinite(saved.km)&&saved.km>=0&&saved.km<=DATA.routeLengthKm)destination=saved.km;if(saved?.speed>=1&&saved.speed<=7)speed=saved.speed}catch(_){}
  const control=document.createElement('button');control.id='homeArrival';control.type='button';control.className='homeArrival';
  control.setAttribute('aria-haspopup','dialog');q('homeView').append(control);
  const dialog=document.createElement('dialog');dialog.id='homeArrivalDialog';dialog.className='homeArrivalDialog';
  dialog.innerHTML='<form method="dialog"><button class="arrivalClose" aria-label="Fermer">×</button></form><h2>Mon arrivée</h2><p>Choisis un point sur ta trace. La distance suit exactement le GPX sélectionné.</p><button type="button" id="arrivalPick">Choisir sur la carte</button><form id="arrivalForm"><label for="arrivalKm">Ou choisir le kilomètre sur la trace</label><input id="arrivalKm" type="number" min="0" step="0.001" required inputmode="decimal"><label for="arrivalSpeed">Vitesse de marche estimée (km/h)</label><input id="arrivalSpeed" type="number" min="1" max="7" step="0.1" required inputmode="decimal"><small>Durée hors pauses, sans correction du relief. Ajuste la vitesse au terrain.</small><button type="submit">Définir l’arrivée</button></form><div id="arrivalCandidates" hidden></div><button type="button" id="arrivalClear">Retirer l’arrivée</button>';
  document.body.append(dialog);q('arrivalKm').max=DATA.routeLengthKm;
  const cancel=document.createElement('button');cancel.id='arrivalCancel';cancel.type='button';cancel.className='arrivalCancel';cancel.textContent='Touche la trace · Annuler';cancel.hidden=true;q('homeView').append(cancel);
  function save(){try{localStorage.setItem(key,JSON.stringify({version:DATA.version,km:destination,speed}))}catch(_){}}
  function stopPicking(){picking=false;cancel.hidden=true;control.hidden=false}
  function at(km){const s=SEGMENTS.find(s=>km<=s.startKm+s.lengthKm)||SEGMENTS.at(-1),t=s.lengthKm?(km-s.startKm)/s.lengthKm:0;return {lat:s.a[0]+t*(s.b[0]-s.a[0]),lon:s.a[1]+t*(s.b[1]-s.a[1])}}
  function render(){
    const current=home.getPosition(),map=home.getMap();
    if(destination===null)control.textContent='⚑ Définir mon arrivée';
    else if(!current)control.textContent='⚑ Arrivée · active ta position';
    else{
      const remaining=destination-current.km,minutes=Math.ceil(Math.max(0,remaining)/speed*60);
      const duration=Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0');
      control.textContent=remaining<-.05?'⚑ Arrivée dépassée':remaining<=.025?'⚑ Arrivée atteinte':'⚑ '+remaining.toFixed(1).replace('.',',')+' km · ≈ '+duration;
    }
    control.title='Distance sur le GPX · durée estimée hors pauses';
    marker?.remove();marker=null;
    if(destination!==null&&map)marker=map.addMarker(at(destination),'⚑','Mon arrivée · km '+destination.toFixed(1),open,'arrival');
  }
  function open(){stopPicking();q('arrivalKm').value=destination===null?'':destination.toFixed(3);q('arrivalSpeed').value=speed;q('arrivalClear').hidden=destination===null;q('arrivalCandidates').hidden=true;dialog.showModal()}
  function choose(km){destination=km;save();stopPicking();dialog.close();render()}
  control.onclick=open;cancel.onclick=stopPicking;
  q('arrivalPick').onclick=()=>{if(!q('arrivalSpeed').reportValidity())return;speed=Number(q('arrivalSpeed').value);dialog.close();picking=true;cancel.textContent='Touche la trace · Annuler';cancel.hidden=false;control.hidden=true};
  q('arrivalClear').onclick=()=>{destination=null;save();dialog.close();render()};
  q('arrivalForm').onsubmit=event=>{event.preventDefault();if(!event.target.reportValidity())return;speed=Number(q('arrivalSpeed').value);choose(Number(q('arrivalKm').value))};
  // Consider every segment. At a crossing, let the user select the GPX passage.
  function candidates(lat,lon){
    const rad=Math.PI/180,cos=Math.cos(lat*rad),rows=[];
    for(const s of SEGMENTS){
      const ax=(s.a[1]-lon)*rad*cos*6371008.8,ay=(s.a[0]-lat)*rad*6371008.8;
      const vx=(s.b[1]-s.a[1])*rad*cos*6371008.8,vy=(s.b[0]-s.a[0])*rad*6371008.8;
      const t=Math.max(0,Math.min(1,-(ax*vx+ay*vy)/(vx*vx+vy*vy||1)));
      rows.push({km:s.startKm+t*s.lengthKm,distance:Math.hypot(ax+t*vx,ay+t*vy)});
    }
    rows.sort((a,b)=>a.distance-b.distance);const best=rows[0],options=[];
    for(const row of rows){if(row.distance>best.distance+20)break;if(!options.some(p=>Math.abs(p.km-row.km)<.15))options.push(row)}
    return {best,options:options.sort((a,b)=>a.km-b.km)};
  }
  const map=home.getMap();
  map?.on('click',event=>{
    if(!picking)return;
    const ll=event.lngLat||event.latlng;if(!ll)return;
    const {best,options}=candidates(ll.lat,ll.lng);
    if(!best||best.distance>250){cancel.textContent='Touche plus près de la trace · Annuler';return}
    if(options.length===1){choose(best.km);return}
    stopPicking();open();const box=q('arrivalCandidates');box.replaceChildren();box.hidden=false;
    const label=document.createElement('p');label.textContent='Plusieurs passages de la trace ici. Choisis le kilomètre d’arrivée :';box.append(label);
    for(const p of options){const button=document.createElement('button');button.type='button';button.textContent='Km '+p.km.toFixed(2).replace('.',',');button.onclick=()=>choose(p.km);box.append(button)}
  });
  window.addEventListener('traversee-home-position',render);
  window.addEventListener('traversee-view',event=>{if(event.detail.name!=='home')stopPicking()});
  render();
})();
