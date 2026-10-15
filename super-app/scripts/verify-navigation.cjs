// Exercise the real view handlers and offline water search before GPS is set.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),home=fs.readFileSync(path.join(base,'home.js'),'utf8');
class Element{
 constructor(id,parent=null){this.id=id;this.parent=parent;this.listeners=[];this.attrs={};this.innerHTML='';this.dataset={};this.classList={toggle(){},add(){},remove(){}}}
 addEventListener(name,fn,capture=false){this.listeners.push({name,fn,capture})}
 setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]||null}
 closest(selector){if(selector==='[data-open-tool]'&&this.dataset.openTool)return this;return null}
 querySelector(){return null}
 click(trusted=false){const event={target:this,isTrusted:trusted,stopped:false,stopImmediatePropagation(){this.stopped=true}};
  for(const l of this.parent?.listeners||[])if(l.name==='click'&&l.capture){l.fn(event);if(event.stopped)return}
  for(const l of this.listeners)if(l.name==='click'&&!l.capture){l.fn(event);if(event.stopped)return}
  for(const l of this.parent?.listeners||[])if(l.name==='click'&&!l.capture){l.fn(event);if(event.stopped)return}
 }
}
const els=new Map(),line=new Element('homeBottomBar'),bubble=new Element('homePoiBubble'),events={},waterSearches=[];
function get(id){if(!els.has(id))els.set(id,new Element(id));return els.get(id)}
for(const [id,category] of Object.entries({openWaterBtn:'water',openStoreBtn:'store',openGasBtn:'gas',openResetBtn:'reset',openBivouacBtn:'bivouac'})){const el=get(id);el.parent=line;el.dataset.category=category;el.closest=selector=>selector==='[data-category]'?el:null}
const views=Object.fromEntries(['home','water','store','gas','reset','bivouac'].map(x=>[x,new Element(x)]));let active='home';
for(const [name,view] of Object.entries(views))view.classList.toggle=(cls,value)=>{if(cls==='active'&&value)active=name};
const state={position:null,selectedPoi:null,map:null},context={window:{addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:e=>events[e.type]?.(e),scrollTo(){},TraverseeHome:{showPoint(){},getPosition:()=>state.position}},document:{getElementById:get},localStorage:{getItem:k=>k==='traversee-trip-v1'?'alpes-mancelles':null},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},appViews:views,DATA:null,Math,Number,String,Date,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>fn(),line,bubble,state,q:get,lastShown:null,projectGps(){},stageFromKm:()=>1,atKm:()=>({lat:48.282005383864,lon:.021170144344899}),setNextCardOpen(){},closeBubble(){state.selectedPoi=null},closeGps(){},refreshBivouac(){},show(){},escapeHtml:s=>s,render(){},input:get('gasKmInput')};
vm.createContext(context);
for(const name of ['route-data.js','trip-alpes.js','route-engine.js'])vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context);
context.DATA=context.window.TraverseeRoutes.data;
get('bivouacHost').dataset.src='./bivouac/index.html';
const nativeViews=html.slice(html.indexOf('function openAppView(name){'),html.indexOf('let lastSentSavedId=null;'));
vm.runInContext(nativeViews,context);
// Bind the actual remaining two navigation handlers.
vm.runInNewContext(html.match(/document.getElementById\('openGasBtn'\)\.addEventListener\('click',[\s\S]*?\n  \}\);/)[0],{...context,openAppView:context.openAppView,render(){}});
vm.runInContext(fs.readFileSync(path.join(base,'reset.js'),'utf8').match(/q\('openResetBtn'\)\.addEventListener\('click',.*\);/)[0],context);
// A future navigation interception must be exercised, not silently ignored.
const intercept=home.match(/  line.addEventListener\('click',event=>\{[\s\S]*?\n  \},true\);/);if(intercept)vm.runInContext(intercept[0],context);
vm.runInContext(home.slice(home.indexOf("  window.addEventListener('traversee-view'"),home.indexOf("  document.addEventListener('visibilitychange'")),context);
vm.runInContext(home.slice(home.indexOf("  bubble.addEventListener('click'"),home.indexOf("  root.addEventListener('click'")),context);
const actualWater=html.match(/<script id="water-search">([\s\S]*?)<\/script>/)[1];
// Use the same geometry functions as the application for the actual data search.
const geometrySource=html.slice(html.indexOf('function havKm('),html.indexOf('function stageFromKm('));
context.R=6371008.8;context.rad=d=>d*Math.PI/180;
vm.runInContext(geometrySource,context);
vm.runInContext(actualWater,context);
const realSearch=context.window.TraverseeWater.search;
context.window.TraverseeWater.search=(...args)=>{const promise=realSearch(...args);waterSearches.push({args,promise});return promise};
let gasOpens=0;context.window.TraverseeGas={render:()=>gasOpens++};
(async()=>{
 for(const [id,view] of Object.entries({openWaterBtn:'water',openStoreBtn:'store',openGasBtn:'gas',openResetBtn:'reset',openBivouacBtn:'bivouac'})){
  active='home';get(id).click(true);assert.equal(active,view,'One tap must open '+view);
 }
 assert.equal(get('bivouacHost').getAttribute('src'),'./bivouac/index.html');
 await Promise.all(waterSearches.map(s=>s.promise));assert(get('waterList').innerHTML.includes('rue Paul Doumer'));
 assert(waterSearches[0].args[1].includes('Depuis le départ'));assert.equal(state.position,null,'A search must not fabricate GPS position');
 const selected=context.window.ALPES_MANCELLES.pois.water.find(p=>p.name.includes('Gesnes'));
 state.selectedPoi={point:selected};state.selected='water';
 const button=new Element('more',bubble);button.dataset.openTool='openWaterBtn';active='home';button.click(true);
 assert.equal(active,'water');await waterSearches.at(-1).promise;
 assert.equal(waterSearches.at(-1).args[2],selected.km);assert(get('waterList').innerHTML.includes('Gesnes-le-Gandelin'));assert.equal(state.position,null);
 state.position={km:12,lat:48.24,lon:0};get('openWaterBtn').click(true);await waterSearches.at(-1).promise;assert.equal(waterSearches.at(-1).args[2],12);assert.equal(waterSearches.at(-1).args[1],'');
 assert(gasOpens>0);console.log('PASS: five modules open in one tap; water renders without GPS; point action loads nearby water; real GPS takes priority; no fabricated position');
})().catch(e=>{console.error(e);process.exitCode=1});
