const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),part=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));
// Real message handler must reject both foreign origins and foreign windows.
let handler,saves=0;const win={addEventListener:(name,fn)=>handler=fn},frame={};
const c={window:win,location:{origin:'https://test.app'},document:{getElementById:()=>({contentWindow:frame})},saveDraftRavito:()=>saves++};
vm.runInNewContext(part('window.addEventListener("message", e => {','</script>'),c);
for(const [origin,source] of [['https://evil.app',win],['https://test.app',{}],['https://test.app',frame]])handler({origin,source,data:{type:'ravito-menu-draft-save',draft:{}}});assert.equal(saves,0);
handler({origin:'https://test.app',source:win,data:{type:'ravito-menu-draft-save',draft:{}}});assert.equal(saves,1);
console.log('PASS internal messages: foreign origins/windows and iframe state writes rejected');
// Exercise actual recovery code with asynchronous IndexedDB transactions.
const databases=new Map();function later(f){setTimeout(f,0)}
function req(value){const r={};later(()=>{r.result=structuredClone(value);r.onsuccess?.()});return r}
function storeApi(map,tx){return {get:k=>req(map.get(k)),getAll:()=>req([...map.values()]),getAllKeys:()=>req([...map.keys()]),put(v,k){map.set(k,structuredClone(v));later(()=>tx.oncomplete?.())},delete(k){map.delete(k);later(()=>tx.oncomplete?.())}}}
const indexedDB={open(name){const r={};later(()=>{let stores=databases.get(name);const fresh=!stores;if(fresh){stores=new Map();databases.set(name,stores)}const d={objectStoreNames:{contains:k=>stores.has(k)},createObjectStore:k=>stores.set(k,new Map()),transaction(k){const tx={objectStore:()=>storeApi(stores.get(k),tx)};return tx},close(){}};r.result=d;if(fresh)r.onupgradeneeded?.();r.onsuccess?.()});return r}};
const data=new Map(),localStorage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
const elements=new Map(),el=()=>({append(){},replaceChildren(){},querySelector:()=>el(),showModal(){},close(){},addEventListener(){},dataset:{}}),get=k=>{if(!elements.has(k))elements.set(k,el());return elements.get(k)};let reloads=0;
const env={indexedDB,localStorage,Date,JSON,Number,String,Object,Array,Promise,Error,setTimeout,clearTimeout,window:{addEventListener(){},dispatchEvent(){}},document:{createElement:el,getElementById:get,body:el(),addEventListener(){}},location:{reload:()=>reloads++},Event:class{}};
env.showAppNotice=()=>{};env.safeStorageGet=k=>localStorage.getItem(k);env.safeStorageSet=(k,v)=>{if(v===null)data.delete(k);else data.set(k,v);env.window.TraverseeBackups?.schedule();return true};
vm.runInNewContext(fs.readFileSync(path.join(base,'backups.js'),'utf8'),env);
(async()=>{
 const api=env.window.TraverseeBackups;
 localStorage.setItem('ravito-draft-v2',JSON.stringify({meal:'before'}));localStorage.setItem('traversee-gas-state-v1',JSON.stringify({cart:{grams:230}}));localStorage.setItem('unrelated','keep');
 await api.flush();const initial=(await api.list())[0];assert(initial);assert(!('unrelated' in initial.storage));
 localStorage.setItem('ravito-draft-v2',JSON.stringify({meal:'after'}));await api.flush();assert((await api.list()).length>=2);
 const projects=databases.get('bivouac-scout').get('projects');projects.set('current',{version:2,gpx:'<gpx/>',zones:[30,30],mode:'three'});await api.flush();assert((await api.list())[0].project.gpx);
 await assert.rejects(api.restore({version:1,at:1,storage:{'foreign':'bad'}}));
 await api.restore(initial);assert.equal(reloads,1);assert.equal(JSON.parse(localStorage.getItem('ravito-draft-v2')).meal,'before');assert.equal(localStorage.getItem('ravito-draft-v2-backup'),localStorage.getItem('ravito-draft-v2'));assert(!projects.has('current'));assert.equal(localStorage.getItem('unrelated'),'keep');await api.flush();
 assert((await api.list()).some(s=>s.project?.gpx),'State before restore remains recoverable');
 console.log('PASS local recovery: independent snapshots, cartridge/meals/project, restore, redundant copy, invalid-key rejection and undo recovery');
})().catch(e=>{console.error(e);process.exit(1)});
// Aerial imagery must fall back while navigator.onLine is still true.
const biv=fs.readFileSync(path.join(base,'bivouac/index.html'),'utf8');
const setBase=biv.slice(biv.indexOf('function setBase(side,n,'),biv.indexOf('function addPanes(',biv.indexOf('function setBase(side,n,')));
const layers=[],preferences=[],mockMap={removeLayer(){}};
const fallbackEnv={navigator:{onLine:true},S:{map:mockMap,mapIgn:mockMap},baseDefs:{sat:{url:'satellite',opts:{}},ign:{url:'aerial',opts:{}},planign:{url:'pinned-plan',opts:{}}},L:{tileLayer(url,options){const layer={url,options,events:{},on(n,f){this.events[n]=f;return this},addTo(){return this},bringToBack(){}};layers.push(layer);return layer}},q:()=>({value:'',textContent:''}),safeLsSet:(k,v)=>preferences.push([k,v]),syncMapPicker(){},showBivNotice(){}};
vm.runInNewContext(setBase+"setBase('left','sat');",fallbackEnv);layers[0].events.tileerror();assert.equal(layers.at(-1).url,'pinned-plan');assert.equal(layers.at(-1).options.maxNativeZoom,15);assert.equal(preferences.at(-1)[1],'sat');assert.equal(layers.length,2);layers[0].events.tileerror();assert.equal(layers.length,2,'stale layer error must not replace current base');
console.log('PASS degraded network: aerial fallback to downloaded IGN without offline event or preference loss');
