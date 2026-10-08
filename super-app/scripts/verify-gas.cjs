const vm=require('vm'),fs=require('fs'),assert=require('assert'),path=require('path');
const base=path.join(__dirname,'..'),source=fs.readFileSync(path.join(base,'gas-tracker.js'),'utf8');
const el=()=>({hidden:false,value:'',textContent:'',innerHTML:'',classList:{toggle(){}},click(){}}),elements=new Map(),events={};
const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};let stored=null,position=null;
const today=new Date().toLocaleDateString('en-CA');
const c={Date,Math,Number,String,Set,JSON,document:{getElementById:get,visibilityState:'visible',addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f,TRAVERSEE_GAS_POINTS:[{id:'a',name:'GAZ 100',lat:1,lon:100,status:'identified'},{id:'p',name:'GAZ 200',lat:1,lon:200,status:'probable'},{id:'b',name:'GAZ 450',lat:1,lon:450,status:'identified'}],gasPointLabel:(p)=>p.id==='a'?'Bricomarché':p.name,TraverseeHome:{getPosition:()=>position}},DATA:{routeId:'principal',routeLengthKm:850},projectGps:(lat,lon)=>({km:lon,distanceMeters:100}),escapeHtml:s=>s,parseJSON:s=>s?JSON.parse(s):null,safeStorageGet:()=>stored,safeStorageSet:(k,s)=>{stored=s;return true},setInterval(){}};
vm.runInNewContext(source,c);
const e=c.window.TraverseeGasTracker;
assert(Math.abs(e.remaining({grams:100,started:'2026-10-01'},new Date('2026-10-04T00:00:00').getTime())-6.09)<.01);
const points=[{id:'a',km:100,offRouteMeters:0,status:'identified'},{id:'p',km:200,offRouteMeters:0,status:'probable'},{id:'b',km:450,offRouteMeters:0,status:'identified'}];
const d=e.assess({km:0,length:700,points,days:21});assert.equal(d.target.id,'a');assert.equal(d.next.id,'b');assert(d.gap>7);
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
assert.equal(JSON.parse(stored).plan.id,'a');
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).plan.id,'a');
position={km:420,updatedAt:Date.now()};events['traversee-home-position']({detail:position});
assert.equal(JSON.parse(stored).alert.id,'b');assert(get('homeGasAlert').innerHTML.includes('Achète une cartouche de 450 g dans 30,0 km'));
/* Passing the point or reopening the app must not silently clear a purchase alert. */
position={km:460,updatedAt:Date.now()};events['traversee-home-position']({detail:position});
vm.runInNewContext(source,c);
assert.equal(JSON.parse(stored).alert.id,'b');
assert(get('gasDecision').innerHTML.includes('Tu as dépassé le magasin prévu'));
get('gasCorrect').onclick();get('gasCartForm').onsubmit({preventDefault(){}});
assert.equal(JSON.parse(stored).alert.id,'b');

/* Starting a new cartridge clears the alert and does not create a pending cartridge. */
get('gasNewCart').onclick();get('gasFormat').value='450';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
const next=JSON.parse(stored);assert.equal(next.cart.grams,450);assert(!next.alert);assert(!next.pending);
/* The opening 100 g scenario explains distance, required format and the excluded alternative. */
c.window.TRAVERSEE_GAS_POINTS=[{id:'a',name:'GAZ 14.8',lat:1,lon:14.8,status:'identified'},{id:'p',name:'GAZ 28',lat:1,lon:27.8,status:'probable'},{id:'b',name:'GAZ 333',lat:1,lon:331.3,status:'identified'}];
c.window.gasPointLabel=p=>({a:'Magasin',p:'Weldom',b:'Decathlon'}[p.id]);
stored=JSON.stringify({schema:2,rest:30});position={km:1,updatedAt:Date.now()};
vm.runInNewContext(source,c);
get('gasFormat').value='100';get('gasStarted').value=today;get('gasCartForm').onsubmit({preventDefault(){}});
assert.equal(JSON.parse(stored).alert.id,'a');assert(!('rest' in JSON.parse(stored)));
assert(get('gasDecision').innerHTML.includes('Achète une cartouche de 230 g dans 13,8 km'));
assert(get('gasDecision').innerHTML.includes('Autre possibilité dans 26,8 km : Weldom'));
assert(get('gasDecision').innerHTML.includes('Gaz compatible à vérifier'));
assert(get('gasDecision').innerHTML.includes('316,5 km suivants'));
assert(!get('gasTracker').innerHTML.includes('Réglages'));
assert(!get('gasTracker').innerHTML.includes('Pas de gaz ici'));
/* Unknown GPX labels must not leak into the user-facing names. */
vm.runInNewContext(fs.readFileSync(path.join(base,'gas-points.js'),'utf8'),c);
for(const point of c.window.TRAVERSEE_GAS_POINTS)assert(!/^GAZ\b/i.test(c.window.gasPointLabel(point)));
console.log('PASS gas: autonomy, probable exclusion, margin, no-position declaration, saved plan, persistent alert, correction, new cartridge, human names');
