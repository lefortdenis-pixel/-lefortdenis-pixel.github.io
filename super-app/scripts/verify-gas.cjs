const vm=require('vm'),fs=require('fs'),assert=require('assert'),path=require('path');
const base=path.join(__dirname,'..'),source=fs.readFileSync(path.join(base,'gas-tracker.js'),'utf8');
const el=()=>({hidden:false,value:'',textContent:'',innerHTML:'',classList:{toggle(){}},click(){},addEventListener(){}}),elements=new Map(),events={};
const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};let stored=null,position=null;
const today=new Date().toLocaleDateString('en-CA');
const c={Date,Math,Number,String,Set,JSON,document:{getElementById:get,visibilityState:'visible',addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f,TRAVERSEE_GAS_POINTS:[{id:'a',name:'GAZ 100',lat:1,lon:100,status:'identified'},{id:'p',name:'GAZ 200',lat:1,lon:200,status:'probable'},{id:'b',name:'GAZ 450',lat:1,lon:450,status:'identified'}],gasPointLabel:(p)=>p.id==='a'?'Bricomarché':p.name,TraverseeHome:{getPosition:()=>position}},DATA:{routeId:'principal',routeLengthKm:850},projectGps:(lat,lon)=>({km:lon,distanceMeters:100}),escapeHtml:s=>s,parseJSON:s=>s?JSON.parse(s):null,safeStorageGet:()=>stored,safeStorageSet:(k,s)=>{stored=s;return true},setInterval(){}};
vm.runInNewContext(source,c);
const e=c.window.TraverseeGasTracker;
assert.equal(e.durationText(8.6),'environ 9 jours');
assert.equal(e.durationText(20.4),'environ 20 jours');
assert.equal(e.durationText(.4),'moins d’un jour');
assert.equal(e.durationText(0),'0 jour');
assert(Math.abs(e.remaining({grams:100,started:'2026-10-01'},new Date('2026-10-04T00:00:00').getTime())-6.09)<.01);
const points=[{id:'a',km:100,offRouteMeters:0,status:'identified'},{id:'p',km:200,offRouteMeters:0,status:'probable'},{id:'b',km:450,offRouteMeters:0,status:'identified'}];
const d=e.assess({km:0,length:700,points,days:21});assert.equal(d.target.id,'p');assert.equal(d.next.id,'b');assert(d.gap>7);
assert.equal(e.assess({km:0,length:700,points:[points[1]],days:9}).kind,'urgent');
assert.equal(e.assess({km:690,length:700,points,days:3}).kind,'finish');
assert.equal(e.assess({km:0,length:700,points,days:3,rest:1}).kind,'urgent');

/* A cartridge can be declared before entering a position. */
get('gasFormat').value='230';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
assert.equal(JSON.parse(stored).cart.grams,230);
assert(get('gasDecision').innerHTML.includes('Cartouche enregistrée'));
/* A long-distance plan is informational first and only becomes an alert in its two-day window. */
position={km:0,updatedAt:Date.now()};events['traversee-home-position']({detail:position});
assert(!JSON.parse(stored).alert);
assert.equal(JSON.parse(stored).plan.id,'p');
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).plan.id,'p');
position={km:420,updatedAt:Date.now()};events['traversee-home-position']({detail:position});
assert.equal(JSON.parse(stored).alert.id,'b');assert(get('homeGasAlert').innerHTML.includes('Cherche une cartouche de 450 g dans 30,0 km'));
/* Passing the point or reopening the app must not silently clear a purchase alert. */
position={km:460,updatedAt:Date.now()};events['traversee-home-position']({detail:position});
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).alert.id,'b');
assert(get('gasDecision').innerHTML.includes('Tu as dépassé le magasin repéré'));
get('gasCorrect').onclick();get('gasCartForm').onsubmit({preventDefault(){}});
assert(!JSON.parse(stored).alert);
assert(get('gasDecision').innerHTML.includes('Aucun magasin possible enregistré'));

/* Starting a new cartridge clears the alert and does not create a pending cartridge. */
get('gasNewCart').onclick();get('gasFormat').value='450';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
const next=JSON.parse(stored);assert.equal(next.cart.grams,450);assert(!next.alert);assert(!next.pending);
/* The opening 100 g scenario explains distance, required format and the excluded alternative. */
c.window.TRAVERSEE_GAS_POINTS=[{id:'a',name:'GAZ 14.8',lat:1,lon:14.8,status:'identified'},{id:'p',name:'GAZ 28',lat:1,lon:27.8,status:'probable'},{id:'b',name:'GAZ 333',lat:1,lon:331.3,status:'identified'}];
c.window.gasPointLabel=p=>({a:'Magasin',p:'Weldom',b:'Decathlon'}[p.id]);
stored=JSON.stringify({schema:2,rest:30});position={km:1,updatedAt:Date.now()};
vm.runInNewContext(source,c);
get('gasFormat').value='100';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
assert.equal(JSON.parse(stored).alert.id,'p');assert(!('rest' in JSON.parse(stored)));
assert(get('gasDecision').innerHTML.includes('Cherche une cartouche de 230 g dans 26,8 km'));
assert(get('gasDecision').innerHTML.includes('Autre magasin possible dans 13,8 km : Magasin'));
assert(!get('gasDecision').innerHTML.includes('Gaz compatible à vérifier'));
assert(!get('gasDecision').innerHTML.includes('316,5 km suivants'));
assert(!get('gasTracker').innerHTML.includes('Réglages'));
assert(!get('gasTracker').innerHTML.includes('Pas de gaz ici'));
/* Legacy exclusions from the removed button must not hide the nearby sellers. */
c.window.TRAVERSEE_GAS_POINTS.push({id:'far',name:'Intersport',lat:1,lon:674.2,status:'identified'});
const cartBeforeMigration=JSON.parse(stored).cart;
stored=JSON.stringify({schema:2,cart:cartBeforeMigration,unavailable:['a','b'],alert:{id:'far',routeId:'principal'}});
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).alert.id,'p');
assert.deepEqual(JSON.parse(stored).cart,cartBeforeMigration);
assert(!('unavailable' in JSON.parse(stored)));
assert(get('gasDecision').innerHTML.includes('dans 26,8 km'));
assert(!get('gasDecision').innerHTML.includes('673,2 km'));
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).alert.id,'p');
/* A stale alert for a distant seller must also give way to an earlier useful seller. */
stored=JSON.stringify({schema:2,cart:cartBeforeMigration,alert:{id:'far',routeId:'principal'}});
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).alert.id,'p');
/* Manual corrections preserve the cartridge and recompute the purchase plan. */
position={km:100,mode:'km',updatedAt:Date.now()};
events['traversee-home-position']({detail:{...position,manualEntry:true}});
assert.deepEqual(JSON.parse(stored).cart,cartBeforeMigration);
assert.equal(JSON.parse(stored).alert.id,'b');assert.equal(get('gasCartForm').hidden,true);
get('gasFormat').value='100';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
const testCart=JSON.parse(stored).cart;
/* GPS and restored manual positions update the calculation without discarding the cartridge. */
position={km:110,mode:'gps',updatedAt:Date.now()};
events['traversee-home-position']({detail:{...position,manualEntry:false}});
assert.deepEqual(JSON.parse(stored).cart,testCart);
events['traversee-home-position']({detail:{...position,mode:'km',manualEntry:false}});
vm.runInNewContext(source,c);
assert.deepEqual(JSON.parse(stored).cart,testCart);
events['traversee-home-position']({detail:{...position,mode:'km',manualEntry:true}});
assert.deepEqual(JSON.parse(stored).cart,testCart);
position={km:1,mode:'km',updatedAt:Date.now()};events['traversee-home-position']({detail:{...position,manualEntry:true}});
assert.deepEqual(JSON.parse(stored).cart,testCart);assert.equal(JSON.parse(stored).alert.id,'p');
vm.runInNewContext(source,c);assert.deepEqual(JSON.parse(stored).cart,testCart);
/* Unknown GPX labels must not leak into the user-facing names. */
vm.runInNewContext(fs.readFileSync(path.join(base,'gas-points.js'),'utf8'),c);
for(const point of c.window.TRAVERSEE_GAS_POINTS){assert(!/^GAZ\b/i.test(point.name));assert(point.sourceUrl);assert(!/^GAZ\b/i.test(c.window.gasPointLabel(point)));}
assert.equal(e.assess({km:0,length:500,points:[{id:'campsite',km:50,offRouteMeters:0,kind:'contact',status:'probable'},{id:'shop',km:120,offRouteMeters:0,status:'probable'}],days:9}).target.id,'shop');
console.log('PASS gas: all plausible shops, contact-only excluded, persistence and correction');

/* An unnamed imported point still needs a visible destination. */
c.DATA.routeLengthKm=2034;
c.window.TRAVERSEE_GAS_POINTS=[{id:'unnamed',name:'GAZ 726.6',lat:1,lon:715,status:'identified'}];
c.window.gasPointLabel=(p,km)=>'Point de ravitaillement · km '+km;
position={km:375,updatedAt:Date.now()};stored=JSON.stringify({schema:2,cart:{grams:230,started:today}});
vm.runInNewContext(source,c);
assert(!get('gasDecision').innerHTML.includes('enseigne non renseignée'));
assert(get('gasDecision').innerHTML.includes('Voir la carte'));
assert(!get('gasCartStatus').textContent.includes('restants'));
assert(!/\d+,\d+ jours/.test(get('gasCartStatus').textContent));
console.log('PASS gas presentation: rounded days, no remaining label, unnamed destination and map link');

/* Editing the format must recompute both the recommendation and the warning. */
c.window.TRAVERSEE_GAS_POINTS=[{id:'near',name:'Nearby shop',lat:1,lon:9,status:'identified'},{id:'far',name:'Later shop',lat:1,lon:326,status:'identified'}];
c.window.gasPointLabel=p=>p.name;
position={km:0,updatedAt:Date.now()};stored=null;
vm.runInNewContext(source,c);
function correctFormat(grams){
 if(JSON.parse(stored||'{}').cart)get('gasCorrect').onclick();
 get('gasFormat').value=String(grams);get('gasStarted').value=today;
 get('gasCartForm').onsubmit({preventDefault(){}});
}
correctFormat(230);
assert(!JSON.parse(stored).alert);assert.equal(JSON.parse(stored).plan.id,'far');
const longPlan=get('gasDecision').innerHTML;
correctFormat(100);
assert.equal(JSON.parse(stored).alert.id,'near');assert(get('gasDecision').innerHTML.includes('dans 9,0 km'));
correctFormat(230);
assert(!JSON.parse(stored).alert);assert.equal(JSON.parse(stored).plan.id,'far');
assert.equal(get('gasDecision').innerHTML,longPlan);assert(get('homeGasAlert').hidden);
vm.runInNewContext(source,c);
assert(!JSON.parse(stored).alert);assert.equal(get('gasDecision').innerHTML,longPlan);
correctFormat(100);assert.equal(JSON.parse(stored).alert.id,'near');
console.log('PASS gas correction: 230 → 100 → 230 → reload → 100 recalculates advice and banner');

const mixed=(from,to,extra=0)=>Math.max(0,Math.min(to,100)-Math.min(from,100))/30+Math.max(0,to-Math.max(from,100))/15+extra/30;
const paced=e.assess({km:0,length:700,points,days:12,travelDays:mixed});
assert.equal(paced.target.id,'p');assert.equal(paced.travel,mixed(0,200));
console.log('PASS gas uses supplied terrain travel time instead of a fixed distance per day');
