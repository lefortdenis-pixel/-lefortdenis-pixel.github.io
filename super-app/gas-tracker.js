/* Device-local gas state. No background location or closed-app notifications. */
(()=>{
 'use strict';
 const KEY='traversee-gas-state-v1',DAY=86400000,RATE=11,MARGIN=2,PACE=20,ALERT_LEAD_DAYS=2;
 const q=id=>document.getElementById(id),esc=v=>escapeHtml(String(v??''));
 const dateText=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const startTime=s=>new Date(s+'T00:00:00').getTime();
 const pointLabel=(point,km)=>window.gasPointLabel?window.gasPointLabel(point,km):('Point de ravitaillement · km '+(Number(km)||0).toFixed(1).replace('.',','));
 function remaining(cart,now=Date.now()){
  return cart?Math.max(0,cart.grams/RATE-Math.max(0,(now-startTime(cart.started))/DAY)):null;
 }
 function assess({km,length,points,days,margin=MARGIN,pace=PACE,rest=0}){
  const usable=Math.max(0,days-margin);
  const to=p=>(Math.max(0,p.km-km)+2*(p.offRouteMeters||0)/1000)/pace+rest;
  const known=points.filter(p=>p.status==='identified'&&p.offRouteMeters<=5000&&p.km>=km-.05).sort((a,b)=>a.km-b.km);
  const finish=Math.max(0,length-km)/pace+rest;
  if(finish<=usable)return {kind:'finish',finish};
  const reachable=known.filter(p=>to(p)<=usable),target=reachable.at(-1);
  if(!target)return {kind:'urgent',target:known[0]||null,travel:known[0]?to(known[0]):null};
  const next=known[known.indexOf(target)+1];
  return {kind:'buy',target,next,travel:to(target),after:days-to(target),nextTravel:next?to(next):finish,gap:next?(next.km-target.km+2*(next.offRouteMeters||0)/1000)/pace:(length-target.km)/pace};
 }
 function durationText(days){
  const value=Math.max(0,Number(days)||0);
  if(value===0)return '0 jour';
  if(value<1)return 'moins d’un jour';
  const rounded=Math.round(value);
  return 'environ '+rounded+' jour'+(rounded>1?'s':'');
 }
 const engine={remaining,assess,durationText};window.TraverseeGasTracker=engine;
 let state=parseJSON(safeStorageGet(KEY))||{},position=null,points=null;
 /* Discard the former "cartouche en attente" workflow. Only the cartridge being used matters. */
 let migrating=state.schema!==2;
 if(migrating){delete state.pending;delete state.alert;delete state.plan;delete state.edit;state.schema=2;}
 if('rest' in state){delete state.rest;migrating=true;}
 /* The removed "Pas de gaz ici" button used to persist exclusions indefinitely. */
 if('unavailable' in state){
  if(Array.isArray(state.unavailable)&&state.unavailable.length){delete state.alert;delete state.plan;}
  delete state.unavailable;migrating=true;
 }
 if(state.cart&&(!Number.isFinite(state.cart.grams)||state.cart.grams<=0||!Number.isFinite(startTime(state.cart.started))))state={};
 function save(){
  const {edit,correcting,...persisted}=state;
  if(!safeStorageSet(KEY,JSON.stringify(persisted))){q('gasTrackerMessage').textContent='Impossible de mémoriser la cartouche sur cet appareil.';return false}
  migrating=false;
  return true;
 }
 function getPoints(){
  if(!points)points=window.TRAVERSEE_GAS_POINTS.map(p=>{const r=projectGps(p.lat,p.lon);return {...p,...r,offRouteMeters:r.distanceMeters}});
  return points;
 }
 const fmt=n=>Math.max(0,Number(n)||0).toFixed(1).replace('.',',');
 function decision(){
  if(!state.cart||!position)return null;
  return assess({
   km:position.km,
   length:DATA.routeLengthKm,
   points:getPoints(),
   days:remaining(state.cart)
  });
 }
 function currentTarget(){
  if(!state.alert||state.alert.routeId!==DATA.routeId)return null;
  return getPoints().find(p=>p.id===state.alert.id)||null;
 }
 function update(){
  position=window.TraverseeHome?.getPosition()||position;
  const before=JSON.stringify(state);
  if(state.alert&&state.alert.routeId!==DATA.routeId)delete state.alert;
  if(state.plan&&state.plan.routeId!==DATA.routeId)delete state.plan;
  const days=remaining(state.cart),d=decision();
  let target=currentTarget();
  if(state.alert&&!target)delete state.alert;
  /* Keep a purchase warning, but never skip an earlier useful seller for a stale target. */
  if(target&&position&&target.km>=position.km-.05&&d?.target&&d.target.km<target.km-.1){
   state.alert={id:d.target.id,routeId:DATA.routeId};target=d.target;
   state.plan={id:d.target.id,routeId:DATA.routeId};
  }
  const previousPlan=state.plan?.routeId===DATA.routeId?getPoints().find(p=>p.id===state.plan.id):null;
  if(!state.alert&&previousPlan&&d?.kind==='urgent'&&position&&position.km>previousPlan.km+.1)state.alert={id:previousPlan.id,routeId:DATA.routeId};
  /* Store the useful point before the alert window, so a later app opening can still warn. */
  if(d?.target&&d.kind!=='finish'&&!state.alert&&(!state.plan||state.plan.id!==d.target.id))state.plan={id:d.target.id,routeId:DATA.routeId};
  const planned=state.plan?.routeId===DATA.routeId?getPoints().find(p=>p.id===state.plan.id):null;
  const shouldAlert=!!d&&(d.kind==='urgent'||(d.kind==='buy'&&Math.max(0,d.target.km-position.km)/PACE<=ALERT_LEAD_DAYS));
  if(!state.alert&&shouldAlert&&d.target){state.alert={id:d.target.id,routeId:DATA.routeId};target=d.target;}
  if(d?.kind==='finish'&&!state.alert)delete state.plan;
  target=currentTarget()||target||planned;
  if(before!==JSON.stringify(state)||migrating)save();
  const missed=!!(target&&position&&position.km>target.km+.1);
  const activeAlert=!!state.alert;
  const outOfRange=!missed&&d?.kind==='urgent'&&d.target?.id===target?.id;
  const label=target?pointLabel(target,target.km):'';
  const distance=target&&position?fmt(Math.max(0,target.km-position.km)):'';
  const place=label;
  const next=target?getPoints().filter(p=>p.status==='identified'&&p.offRouteMeters<=5000&&p.km>target.km+.05).sort((a,b)=>a.km-b.km)[0]:null;
  const gapKm=target?Math.max(0,(next?.km??DATA.routeLengthKm)-target.km):0;
  const gapDays=target?(gapKm+2*(next?.offRouteMeters||0)/1000)/PACE:0;
  const format=[100,230,450].find(grams=>grams/RATE>=gapDays+MARGIN);
  const purchase='Achète '+(format?'une cartouche de '+format+' g':'du gaz');
  const alternative=target&&position?getPoints().filter(p=>p.status==='probable'&&p.offRouteMeters<=5000&&p.km>=position.km&&p.km>target.km+.05&&p.km<(next?.km??DATA.routeLengthKm)).sort((a,b)=>a.km-b.km)[0]:null;

  let title='Gaz',detail='Déclare la cartouche que tu utilises.';
  if(state.cart){
   if(activeAlert) {title=missed?'Achète du gaz dès que possible':outOfRange?'Cherche du gaz dès maintenant':purchase+' dans '+distance+' km';detail=missed?'Tu as dépassé le magasin prévu.':outOfRange?'Le prochain vendeur enregistré est dans '+distance+' km, trop loin pour ton autonomie.':place;}
   else if(!position) {title='Gaz · '+durationText(days);detail='Indique ton km pour calculer le prochain achat.';}
   else if(d?.kind==='finish') {title='Gaz · '+durationText(days);detail='Rien à faire : autonomie suffisante jusqu’à l’arrivée.';}
   else if(d?.target) {title='Gaz · '+durationText(days);detail='Achat conseillé dans '+distance+' km.';}
   else {title='Gaz · '+durationText(days);detail='Cherche un vendeur : le prochain point enregistré est trop loin.';}
  }
  const banner=q('homeGasAlert');
  banner.classList.toggle('gasWarning',!!activeAlert||!!(d?.kind==='urgent'));
  banner.hidden=!state.cart||!(activeAlert||d?.kind==='urgent');
  const gasButton=q('openGasBtn');
  gasButton.classList.toggle('needs-cart',!state.cart);
  gasButton.title=state.cart?'Gaz':'Gaz · cartouche à renseigner';

  banner.innerHTML='<strong><img class="gasIcon" src="./icons/gas-canister.svg" alt="" aria-hidden="true"> '+esc(title)+'</strong>'+(detail?'<span>'+esc(detail)+'</span>':'');

  q('gasTracker').classList.toggle('gasNeedsCart',!state.cart);
  q('gasTrackerHead').hidden=!state.cart;
  q('gasDecision').hidden=!state.cart;
  const status=q('gasCartStatus');
  status.textContent=state.cart?state.cart.grams+' g · commencée le '+state.cart.started.split('-').reverse().join('/')+' · autonomie estimée : '+durationText(days):'Aucune cartouche déclarée';
  const result=q('gasDecision');result.innerHTML='';
  if(!state.cart){
   result.innerHTML='<strong>Quelle cartouche utilises-tu ?</strong>';
  }else if(!position){
   result.innerHTML='<strong>Cartouche enregistrée</strong><p>Indique ton kilomètre pour que l’app calcule quand acheter.</p>';
  }else if(activeAlert){
   const heading=missed?'Achète du gaz dès que possible':outOfRange?'Cherche du gaz dès maintenant':purchase+' dans '+distance+' km';
   result.innerHTML='<strong>'+esc(heading)+'</strong>'+(missed?'<p>'+esc('Tu as dépassé le magasin prévu'+(place?' : '+place:'')+'.')+'</p>':place?'<p>'+esc(place)+'</p>':'');
   if(!missed){
    if(!outOfRange)result.innerHTML+='<a class="gasDirections" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(target.lat+','+target.lon)+'" target="_blank" rel="noopener">Y aller ↗</a>';
   }
   if(alternative&&!missed)result.innerHTML+='<p class="gasFollow">Autre possibilité dans '+fmt(alternative.km-position.km)+' km : '+esc(pointLabel(alternative,alternative.km))+'.</p>';
  }else if(d?.kind==='finish'){
   result.innerHTML='<strong>Pas d’achat prévu</strong><p>Selon l’estimation, ta cartouche couvre la fin du parcours.</p>';
  }else if(d?.target){
   result.innerHTML='<strong>Achat à prévoir</strong><p>Achat conseillé dans '+distance+' km.</p>'+(place?'<p>'+esc(place)+'</p>':'')+(target?'<a class="gasDirections" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(target.lat+','+target.lon)+'" target="_blank" rel="noopener">Voir ce point sur la carte ↗</a>':'');
  }else{
   result.innerHTML='<strong>Cherche un vendeur de gaz</strong><p>Aucun vendeur enregistré n’est assez proche pour ton autonomie estimée.</p>';
  }

  q('gasNewCart').hidden=!state.cart;
  q('gasNewCart').textContent='Je change de cartouche';
  q('gasCartForm').hidden=!!state.cart&&!state.edit;
  q('gasCancel').hidden=!state.cart;
  q('gasCorrect').hidden=!state.cart||!!state.edit;
  q('gasNewCart').hidden=!state.cart||!!state.edit;
  q('gasFormTitle').textContent=state.correcting?'Corriger la cartouche en cours':state.cart?'Nouvelle cartouche commencée':'Quelle cartouche utilises-tu ?';
  if(state.cart&&!state.edit){q('gasFormat').value=[100,230,450].includes(state.cart.grams)?String(state.cart.grams):'other';q('gasCustom').value=state.cart.grams;q('gasFormat').onchange();q('gasStarted').value=dateText();}
 }
 q('gasTracker').innerHTML='<div id="gasTrackerHead" class="gasTrackerHead"><div class="gasEyebrow">CARTOUCHE EN COURS</div><div id="gasCartStatus" class="gasCartStatus"></div></div><div id="gasDecision" role="status" aria-live="polite"></div><div class="gasTrackerActions gasMainActions"><button type="button" id="gasNewCart">Je change de cartouche</button></div><form id="gasCartForm"><p id="gasFormTitle" class="gasFormIntro">'+(state.cart?'Nouvelle cartouche commencée':'Quelle cartouche utilises-tu ?')+'</p><label for="gasFormat">Contenance</label><select id="gasFormat" required><option value="" disabled selected>Choisis ta cartouche</option><option value="100">100 g</option><option value="230">230 g</option><option value="450">450 g</option><option value="other">Autre format</option></select><input id="gasCustom" type="number" min="1" max="1000" placeholder="Poids en grammes" aria-label="Poids de gaz en grammes" hidden><label for="gasStarted">Date de début</label><input id="gasStarted" type="date" required><div class="gasTrackerActions"><button type="submit">Enregistrer</button><button type="button" id="gasCancel">Annuler</button></div></form><button type="button" id="gasCorrect" class="gasEditCart">Modifier ma cartouche</button><p id="gasTrackerMessage" role="status"></p>';
 q('gasStarted').value=dateText();q('gasStarted').max=dateText();
 q('gasFormat').onchange=()=>{q('gasCustom').hidden=q('gasFormat').value!=='other';q('gasCustom').required=q('gasFormat').value==='other'};
 function grams(){const n=Number(q('gasFormat').value==='other'?q('gasCustom').value:q('gasFormat').value);return n>0&&n<=1000?n:null;}
 q('gasNewCart').onclick=()=>{state.edit=true;delete state.correcting;q('gasFormat').value='';q('gasCustom').value='';q('gasFormat').onchange();q('gasStarted').value=dateText();update()};
 q('gasCancel').onclick=()=>{delete state.edit;delete state.correcting;update()};
 q('gasCorrect').onclick=()=>{state.edit=true;state.correcting=true;if(state.cart){q('gasFormat').value=[100,230,450].includes(state.cart.grams)?String(state.cart.grams):'other';q('gasCustom').value=state.cart.grams;q('gasFormat').onchange();q('gasStarted').value=state.cart.started}update()};
 q('gasCartForm').onsubmit=e=>{e.preventDefault();const n=grams(),started=q('gasStarted').value;if(!n||!started||startTime(started)>Date.now())return;state.cart={grams:n,started};delete state.alert;delete state.plan;delete state.edit;delete state.correcting;if(save())update()};
 q('homeGasAlert').onclick=()=>{q('openGasBtn').click();update()};
 window.addEventListener('traversee-home-position',e=>{
  position=e.detail;
  if(e.detail?.manualEntry){
   // A position correction changes the purchase plan, never the active cartridge.
   delete state.alert;delete state.plan;
   save();
  }
  update();
 });
 window.addEventListener('traversee-view',update);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')update()});
 setInterval(()=>{if(document.visibilityState==='visible')update()},60000);update();
})();
