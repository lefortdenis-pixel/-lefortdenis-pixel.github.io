/* Device-local gas state. No background location or closed-app notifications. */
(()=>{
 'use strict';
 const KEY='traversee-gas-state-v1',DAY=86400000,RATE=11,MARGIN=2,PACE=20;
 const q=id=>document.getElementById(id),esc=v=>escapeHtml(String(v??''));
 const dateText=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const startTime=s=>new Date(s+'T00:00:00').getTime();
 function remaining(cart,now=Date.now()){return cart?Math.max(0,cart.grams/RATE-Math.max(0,(now-startTime(cart.started))/DAY)):null;}
 function assess({km,length,points,days,margin=MARGIN,pace=PACE,rest=0}){
  const usable=Math.max(0,days-margin),to=p=>(Math.max(0,p.km-km)+2*(p.offRouteMeters||0)/1000)/pace+rest;
  const known=points.filter(p=>p.status==='identified'&&p.offRouteMeters<=5000&&p.km>=km-.05).sort((a,b)=>a.km-b.km);
  const finish=(length-km)/pace+rest;
  if(finish<=usable)return {kind:'finish',finish};
  const reachable=known.filter(p=>to(p)<=usable),target=reachable.at(-1);
  if(!target)return {kind:'urgent',target:known[0]||null,travel:known[0]?to(known[0]):null};
  const next=known[known.indexOf(target)+1];
  return {kind:'buy',target,next,travel:to(target),after:days-to(target),nextTravel:next?to(next):finish,gap:next?(next.km-target.km+2*(next.offRouteMeters||0)/1000)/pace:(length-target.km)/pace};
 }
 const engine={remaining,assess};window.TraverseeGasTracker=engine;
 let state=parseJSON(safeStorageGet(KEY))||{},position=null,points=null;
 if(state.cart&&(!Number.isFinite(state.cart.grams)||state.cart.grams<=0||!Number.isFinite(startTime(state.cart.started))))state={};
 function save(){if(!safeStorageSet(KEY,JSON.stringify(state))){q('gasTrackerMessage').textContent='Impossible de mémoriser la cartouche sur cet appareil.';return false}return true;}
 function getPoints(){if(!points)points=window.TRAVERSEE_GAS_POINTS.map(p=>{const r=projectGps(p.lat,p.lon);return {...p,...r,offRouteMeters:r.distanceMeters}});return points;}
 const fmt=n=>Math.max(0,n).toFixed(1).replace('.',',');
 function decision(){if(!state.cart||!position)return null;return assess({km:position.km,length:DATA.routeLengthKm,points:getPoints().filter(p=>p.id!==state.lastPurchase&&!(state.unavailable||[]).includes(p.id)),days:remaining(state.cart)+(state.pending?state.pending.grams/RATE:0),rest:state.rest||0});}
 function update(){
  position=window.TraverseeHome?.getPosition()||position;
  const days=remaining(state.cart),d=decision();
  // Never erase an unacknowledged purchase alert merely because its point was passed.
  if(d&&d.kind!=='finish'&&d.target&&!state.alert){state.alert={id:d.target.id,routeId:DATA.routeId};save();}
  let target=state.alert?.routeId===DATA.routeId?getPoints().find(p=>p.id===state.alert.id):null;
  if(state.alert?.routeId!==DATA.routeId){delete state.alert;if(d?.target){state.alert={id:d.target.id,routeId:DATA.routeId};target=d.target}save();}
  const missed=target&&position&&position.km>target.km+.1;
  let title='Gaz non renseigné',detail='Ajoute ta cartouche pour recevoir une alerte au bon moment.';
  if(state.cart){title='Gaz · '+fmt(days)+' jours restants'+(state.pending?' · une cartouche en attente':'');detail=!position?'Indique ton km pour savoir où acheter':d?.kind==='finish'&&!state.alert?'Pas d’achat nécessaire pour atteindre l’arrivée, marge comprise':d?.kind==='urgent'&&!missed?'Achète avant le prochain vendeur identifié':target?'Prochain achat : '+target.name+' · '+(missed?'accès dépassé':fmt(Math.max(0,target.km-position.km)/PACE)+' j avant l’accès estimé'):'Aucun achat identifié avec la marge actuelle';}
  const banner=q('homeGasAlert');banner.classList.toggle('gasWarning',!!state.cart&&(!!state.alert||d?.kind==='urgent'));banner.innerHTML='<strong>🔥 '+esc(title)+'</strong><span>'+esc(detail)+'</span>';
  const status=q('gasCartStatus');status.textContent=state.cart?state.cart.grams+' g · environ '+fmt(days)+' jours restants':'Aucune cartouche déclarée';
  const result=q('gasDecision');result.innerHTML='';
  if(state.cart&&position){
   const actualTarget=target||d?.target;
   if(missed)result.innerHTML='<strong>Accès dépassé · achat toujours à confirmer</strong><p>'+esc(target.name)+' est derrière toi. Revenir ou chercher une autre solution.</p>';
   else if(actualTarget)result.innerHTML='<strong>'+(d.kind==='urgent'?'Achète avant '+esc(actualTarget.name):'Prochain achat : '+esc(actualTarget.name))+'</strong><p>'+fmt((Math.max(0,actualTarget.km-position.km)+2*actualTarget.offRouteMeters/1000)/PACE)+' jours de marche estimés pour y accéder.</p>';
   else result.innerHTML='<strong>'+(d.kind==='finish'?'Autonomie suffisante jusqu’à l’arrivée':'Aucun vendeur identifié atteignable avec la marge')+'</strong>';
   if(d.gap>7)result.innerHTML+='<p class="gasRisk">Une 100 g neuve ne couvre pas la suite avec 2 jours de marge ('+fmt(d.gap)+' jours estimés). Chercher un autre format ou un autre vendeur avant de continuer.</p>';
   if(position.updatedAt&&Date.now()-position.updatedAt>3600000)result.innerHTML+='<p class="gasRisk">Position ancienne : actualise le GPS pour confirmer cet achat.</p>';
   
  }
  q('gasUnavailable').hidden=!target;q('gasCartForm').hidden=!state.edit;
  q('gasEdit').hidden=false;q('gasEdit').textContent=state.cart?'J’ai acheté une cartouche':'Déclarer ma cartouche';q('gasPending').hidden=!state.pending;
  if(state.pending)q('gasPendingText').textContent=state.pending.grams+' g neuve achetée · compteur non démarré';
 }
 q('gasTracker').innerHTML='<div class="gasTrackerHead"><div class="gasEyebrow">SUIVI AUTOMATIQUE</div><div id="gasCartStatus" class="gasCartStatus"></div></div><div id="gasDecision" role="status"></div><div class="gasTrackerActions gasMainActions"><button type="button" id="gasEdit">Déclarer ma cartouche</button><button type="button" id="gasUnavailable" hidden>Introuvable</button></div><form id="gasCartForm"><p class="gasFormIntro">Ta cartouche</p><label for="gasFormat">Contenance</label><select id="gasFormat"><option value="100">100 g</option><option value="230" selected>230 g</option><option value="450">450 g</option><option value="other">Autre format</option></select><input id="gasCustom" type="number" min="1" max="1000" placeholder="Poids en grammes" aria-label="Poids en grammes" hidden><label for="gasStarted">Début d’utilisation</label><input id="gasStarted" type="date" required><div class="gasTrackerActions"><button type="submit">Je la commence</button><button type="button" id="gasBuyLater">Je termine celle en cours</button></div></form><div id="gasPending" hidden><p id="gasPendingText"></p><button type="button" id="gasActivate">Je commence cette cartouche</button></div><details><summary>Modifier</summary><label for="gasRest">Jours de repos avant le prochain achat</label><input id="gasRest" type="number" min="0" max="30" value="0"><button type="button" id="gasCorrect">Modifier la cartouche</button></details><p id="gasTrackerMessage" role="status"></p>';
 q('gasStarted').value=dateText();q('gasStarted').max=dateText();q('gasRest').value=state.rest||0;
 q('gasFormat').onchange=()=>{q('gasCustom').hidden=q('gasFormat').value!=='other';q('gasCustom').required=q('gasFormat').value==='other'};
 function grams(){const n=Number(q('gasFormat').value==='other'?q('gasCustom').value:q('gasFormat').value);return n>0&&n<=1000?n:null;}
 q('gasEdit').onclick=()=>{state.edit=true;q('gasStarted').value=dateText();update()};
 q('gasCorrect').onclick=()=>{state.edit=true;if(state.cart){q('gasFormat').value=[100,230,450].includes(state.cart.grams)?String(state.cart.grams):'other';q('gasCustom').value=state.cart.grams;q('gasFormat').onchange();q('gasStarted').value=state.cart.started}update()};
 q('gasCartForm').onsubmit=e=>{e.preventDefault();const n=grams(),started=q('gasStarted').value;if(!n||!started||startTime(started)>Date.now())return;state.lastPurchase=state.alert?.id;state.cart={grams:n,started};delete state.alert;delete state.pending;delete state.edit;if(save())update()};
 q('gasBuyLater').onclick=()=>{const n=grams();if(!n||!state.cart){q('gasTrackerMessage').textContent='Déclare d’abord la cartouche utilisée.';return}state.lastPurchase=state.alert?.id;state.pending={grams:n};delete state.alert;delete state.edit;if(save())update()};
 q('gasActivate').onclick=()=>{state.cart={grams:state.pending.grams,started:dateText()};delete state.pending;delete state.alert;delete state.edit;if(save())update()};
 q('gasRest').onchange=()=>{state.rest=Math.max(0,Math.min(30,Number(q('gasRest').value)||0));if(save())update()};
 q('gasUnavailable').onclick=()=>{if(state.alert){state.unavailable=[...new Set([...(state.unavailable||[]),state.alert.id])];delete state.alert;if(save())update()}};
 q('homeGasAlert').onclick=()=>{q('openGasBtn').click();update()};
 window.addEventListener('traversee-home-position',e=>{position=e.detail;update()});
 window.addEventListener('traversee-view',update);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')update()});
 setInterval(()=>{if(document.visibilityState==='visible')update()},60000);update();
})();
