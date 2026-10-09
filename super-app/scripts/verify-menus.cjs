const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));
// Exercise the real catalogue and pure engine without a duplicate implementation.
const source=section('const PRODUCTS={','const menuRoot=')+
 section('function clone(o){','let draftTimer=')+
 section('function addParts(n,parts){','function scrollTopAll(){')+
 section('function cyclicDistance(from,to){','function buildPlan(')+
 section('function lunchFamily(l){','function changeDay(')+
 section('function simulateWithSnackOverride(','function purchaseDiff(');
const context=vm.createContext({assert,console,structuredClone});
vm.runInContext(source+`
let alternatives=0;
for(const days of [1,2,3,4])for(const start of [0,347,997,2500]){
 d=days;unavailableProducts=[];snackOverride=null;ravitoCount=0;plan=composePlan(start);
 assert.equal(plan.length,days);assert.ok(planAllowed(plan));
 const sim=simulate(plan);
 assert.equal(sim.startWeight,Object.values(sim.purchases).reduce((n,x)=>n+x.grams,0));
 for(const x of Object.values(sim.purchases)){
  assert.ok(x.count>0&&Number.isInteger(x.count));assert.ok(x.grams>=x.need);
  assert.ok((x.count-1)*PRODUCTS[x.id].pack<x.need);
  const options=buildUnavailableAlternatives(x.id),seen=new Set();
  for(const option of options){
   assert.ok(planAllowed(option.plan));assert.ok(!option.nextSim.purchases[x.id]);
   const key=option.changes.join('§');assert.ok(!seen.has(key));seen.add(key);alternatives++;
  }
 }
 const next=findDifferentPlan(plan,(start+MENU_PROPOSAL_STEP)%DAY_OPTIONS.length);
 assert.ok(planAllowed(next.plan));assert.notEqual(planBagSignature(next.plan),planBagSignature(plan));
 for(let i=0;i<plan.length;i++){
  const cand=nextDayCandidate(plan[i].idx,new Set(),'',i);assert.ok(cand&&dayAllowed(cand,i));
  assert.notEqual(mealPlanSignature([cand]),mealPlanSignature([plan[i]]));
 }
}
// A removed ingredient must not come back in the next product substitution.
d=2;plan=composePlan(0);snackOverride=null;unavailableProducts=[];
const first=buildUnavailableAlternatives('cheese')[0];assert.ok(first);
plan=first.plan;snackOverride=first.snackOverride;unavailableProducts=['cheese'];
for(const id of Object.keys(simulate(plan).purchases))for(const option of buildUnavailableAlternatives(id)){
 assert.ok(!option.nextSim.purchases.cheese,'cheese returned when replacing '+id);
}
console.log('PASS menus: 16 plans (1–4 days), '+alternatives+' distinct alternatives, package quantities, day changes, full rotation, successive substitutions');
`,context,{timeout:60000});
