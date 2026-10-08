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
 const engine={remaining,assess};window.TraverseeGasTracker=engine;
 let state=parseJSON(safeStorageGet(KEY))||{},position=null,points=null;
 /* Discard the former "cartouche en attente" workflow. Only the cartridge being used matters. */
 let migrating=state.schema!==2;
 if(migrating){delete state.pending;delete state.alert;delete state.plan;delete state.edit;state.schema=2;}
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
   points:getPoints().filter(p=>!(state.unavailable||[]).includes(p.id)),
   days:remaining(state.cart),
   rest:state.rest||0
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
  const label=target?pointLabel(target,target.km):'';

  let title='Gaz',detail='Déclare la cartouche que tu utilises.';
  if(state.cart){
   if(activeAlert) {title='À FAIRE : acheter une cartouche';detail=label?'Chez '+label:'Au prochain point identifié';}
   else if(!position) {title='Gaz · '+fmt(days)+' jours restants';detail='Indique ton km pour calculer le prochain achat.';}
   else if(d?.kind==='finish') {title='Gaz · '+fmt(days)+' jours restants';detail='Rien à faire : autonomie suffisante jusqu’à l’arrivée.';}
   else if(d?.target) {title='Gaz · '+fmt(days)+' jours restants';detail='Rien à faire maintenant. Achat prévu chez '+pointLabel(d.target,d.target.km)+' dans '+fmt(d.travel)+' jours.';}
   else {title='Gaz · '+fmt(days)+' jours restants';detail='Aucun point identifié atteignable avec la marge.';}
  }
  const banner=q('homeGasAlert');
  banner.classList.toggle('gasWarning',!!activeAlert||!!(d?.kind==='urgent'));
  banner.innerHTML='<strong>🔥 '+esc(title)+'</strong><span>'+esc(detail)+'</span>';

  const status=q('gasCartStatus');
  status.textContent=state.cart?state.cart.grams+' g · commencée le '+state.cart.started.split('-').reverse().join('/')+' · environ '+fmt(days)+' jours restants':'Aucune cartouche déclarée';
  const result=q('gasDecision');result.innerHTML='';
  if(!state.cart){
   result.innerHTML='<strong>Quelle cartouche utilises-tu ?</strong>';
  }else if(!position){
   result.innerHTML='<strong>Cartouche enregistrée</strong><p>Indique ton kilomètre pour que l’app calcule quand acheter.</p>';
  }else if(activeAlert){
   const heading=missed?'À FAIRE — point dépassé':'À FAIRE MAINTENANT';
   const text=missed?'Tu as dépassé '+label+'. Achète une cartouche dès que possible.':'Achète une cartouche compatible chez '+label+'.';
   result.innerHTML='<strong>'+esc(heading)+'</strong><p>'+esc(text)+'</p><p class="gasFollow">L’alerte reste affichée jusqu’à ce que tu déclares la nouvelle cartouche commencée.</p>';
  }else if(d?.kind==='finish'){
   result.innerHTML='<strong>Rien à faire maintenant</strong><p>Ta cartouche couvre la fin du parcours avec la marge prévue.</p>';
  }else if(d?.target){
   result.innerHTML='<strong>Rien à faire maintenant</strong><p>Le prochain achat sera chez '+esc(pointLabel(d.target,d.target.km))+' dans environ '+fmt(d.travel)+' jours. L’app t’alertera avant d’y arriver.</p>';
  }else{
   result.innerHTML='<strong>Vigilance</strong><p>Aucun vendeur identifié n’est atteignable avec la marge prévue. Vérifie le parcours avant de continuer.</p>';
  }
  if(state.cart&&d?.gap>7)result.innerHTML+='<p class="gasRisk">Une cartouche de 100 g ne suffirait pas pour la suite avec la marge prévue.</p>';
  if(state.cart&&position?.updatedAt&&Date.now()-position.updatedAt>3600000)result.innerHTML+='<p class="gasRisk">Position ancienne : actualise ton kilomètre.</p>';

  q('gasNewCart').hidden=!state.cart;
  q('gasNewCart').textContent='Je commence une nouvelle cartouche';
  q('gasCartForm').hidden=!!state.cart&&!state.edit;
  q('gasCancel').hidden=!state.cart;
  q('gasCorrect').hidden=!state.cart;
  q('gasUnavailable').hidden=!activeAlert;
  q('gasNewCart').hidden=!state.cart||!!state.edit;
  q('gasFormTitle').textContent=state.correcting?'Corriger la cartouche en cours':state.cart?'Nouvelle cartouche commencée':'Cartouche actuelle';
  q('gasRest').value=state.rest||0;
  if(state.cart&&!state.edit){q('gasFormat').value=[100,230,450].includes(state.cart.grams)?String(state.cart.grams):'other';q('gasCustom').value=state.cart.grams;q('gasFormat').onchange();q('gasStarted').value=dateText();}
 }
 q('gasTracker').innerHTML='<div class="gasTrackerHead"><div class="gasEyebrow">CARTOUCHE EN COURS</div><div id="gasCartStatus" class="gasCartStatus"></div></div><div id="gasDecision" role="status" aria-live="polite"></div><div class="gasTrackerActions gasMainActions"><button type="button" id="gasNewCart">Je commence une nouvelle cartouche</button><button type="button" id="gasUnavailable" hidden>Pas de gaz ici</button></div><form id="gasCartForm"><p id="gasFormTitle" class="gasFormIntro">'+(state.cart?'Nouvelle cartouche commencée':'Quelle cartouche utilises-tu ?')+'</p><label for="gasFormat">Contenance</label><select id="gasFormat"><option value="100">100 g</option><option value="230" selected>230 g</option><option value="450">450 g</option><option value="other">Autre format</option></select><input id="gasCustom" type="number" min="1" max="1000" placeholder="Poids en grammes" aria-label="Poids de gaz en grammes" hidden><label for="gasStarted">Date de début</label><input id="gasStarted" type="date" required><div class="gasTrackerActions"><button type="submit">Enregistrer</button><button type="button" id="gasCancel">Annuler</button></div></form><details><summary>Réglages</summary><label for="gasRest">Jours de repos avant le prochain achat</label><input id="gasRest" type="number" min="0" max="30" value="0"><button type="button" id="gasCorrect">Corriger la cartouche en cours</button></details><p id="gasTrackerMessage" role="status"></p>';
 q('gasStarted').value=dateText();q('gasStarted').max=dateText();q('gasRest').value=state.rest||0;
 q('gasFormat').onchange=()=>{q('gasCustom').hidden=q('gasFormat').value!=='other';q('gasCustom').required=q('gasFormat').value==='other'};
 function grams(){const n=Number(q('gasFormat').value==='other'?q('gasCustom').value:q('gasFormat').value);return n>0&&n<=1000?n:null;}
 q('gasNewCart').onclick=()=>{state.edit=true;delete state.correcting;q('gasFormat').value='230';q('gasCustom').value='';q('gasFormat').onchange();q('gasStarted').value=dateText();update()};
 q('gasCancel').onclick=()=>{delete state.edit;delete state.correcting;update()};
 q('gasCorrect').onclick=()=>{state.edit=true;state.correcting=true;if(state.cart){q('gasFormat').value=[100,230,450].includes(state.cart.grams)?String(state.cart.grams):'other';q('gasCustom').value=state.cart.grams;q('gasFormat').onchange();q('gasStarted').value=state.cart.started}update()};
 q('gasCartForm').onsubmit=e=>{e.preventDefault();const n=grams(),started=q('gasStarted').value;if(!n||!started||startTime(started)>Date.now())return;state.cart={grams:n,started};if(!state.correcting){delete state.alert;delete state.plan;}delete state.edit;delete state.correcting;if(save())update()};
 q('gasUnavailable').onclick=()=>{if(!state.alert)return;state.unavailable=[...new Set([...(state.unavailable||[]),state.alert.id])];delete state.alert;delete state.plan;if(save())update()};
 q('gasRest').onchange=()=>{state.rest=Math.max(0,Math.min(30,Number(q('gasRest').value)||0));if(save())update()};
 q('homeGasAlert').onclick=()=>{q('openGasBtn').click();update()};
 window.addEventListener('traversee-home-position',e=>{position=e.detail;update()});
 window.addEventListener('traversee-view',update);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')update()});
 setInterval(()=>{if(document.visibilityState==='visible')update()},60000);update();
})();
