/* A destination is a chainage on the selected GPX, never a routed shortcut. */
(()=>{
  'use strict';
  const q=id=>document.getElementById(id),home=window.TraverseeHome;
  const key='traversee-arrival-v1:'+DATA.routeId;
  let destination=null,picking=false,marker=null,speed=4;
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===DATA.version&&Number.isFinite(saved.km)&&saved.km>=0&&saved.km<=DATA.routeLengthKm)destination=saved.km;if(saved?.speed>=1&&saved.speed<=7)speed=saved.speed}catch(_){}
  const control=document.createElement('button');control.id='homeArrival';control.type='button';control.className='homeArrival';
  q('homeView').append(control);
  const clear=document.createElement('button');clear.id='arrivalClear';clear.type='button';clear.className='arrivalClear';clear.textContent='×';clear.setAttribute('aria-label','Retirer mon arrivée');q('homeView').append(clear);
  const choices=document.createElement('div');choices.id='arrivalCandidates';choices.className='arrivalCandidates';choices.hidden=true;q('homeView').append(choices);
  const cancel=document.createElement('button');cancel.id='arrivalCancel';cancel.type='button';cancel.className='arrivalCancel';cancel.textContent='Touche la trace · Annuler';cancel.hidden=true;q('homeView').append(cancel);
  function save(){try{localStorage.setItem(key,JSON.stringify({version:DATA.version,km:destination,speed}))}catch(_){}}
  function stopPicking(){picking=false;cancel.hidden=true;choices.hidden=true;control.hidden=false;clear.hidden=destination===null}
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
    clear.hidden=picking||destination===null;
    control.title='Toucher pour changer l’arrivée';
    marker?.remove();marker=null;
    if(destination!==null&&map)marker=map.addMarker(at(destination),'⚑','Mon arrivée · km '+destination.toFixed(1),open,'arrival');
  }
  function open(){picking=true;choices.hidden=true;cancel.textContent='Touche la trace · Annuler';cancel.hidden=false;control.hidden=true;clear.hidden=true}
  function choose(km){destination=km;save();stopPicking();render()}
  control.onclick=open;cancel.onclick=stopPicking;
  clear.onclick=()=>{destination=null;save();stopPicking();render()};
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
    const box=choices;box.replaceChildren();box.hidden=false;
    const label=document.createElement('p');label.textContent='Quel passage ?';box.append(label);
    for(const p of options){const button=document.createElement('button');button.type='button';button.textContent='Km '+p.km.toFixed(2).replace('.',',');button.onclick=()=>choose(p.km);box.append(button)}
  });
  window.addEventListener('traversee-home-position',render);
  window.addEventListener('traversee-view',event=>{if(event.detail.name!=='home')stopPicking()});
  render();
})();
