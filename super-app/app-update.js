/* Offer a prepared app update; save local work before the user-triggered reload. */
(()=>{
 'use strict';
 if(!('serviceWorker' in navigator))return;
 const pageVersion=TraverseeOfflineCore.VERSION,sw=navigator.serviceWorker;
 const button=document.createElement('button');button.type='button';button.id='appUpdateButton';button.hidden=true;
 button.textContent='↻ Mise à jour disponible';button.setAttribute('aria-live','polite');
 const style=document.createElement('style');style.textContent='#appUpdateButton{position:absolute;top:calc(108px + env(safe-area-inset-top));left:16px;z-index:1100;max-width:calc(100% - 88px);min-height:44px;padding:10px 15px;border:1px solid #21123820;border-radius:18px;background:#211238;color:#fff4af;box-shadow:0 4px 16px #21123825;font:700 13px Arial,sans-serif;text-align:left;cursor:pointer}#appUpdateButton[hidden]{display:none!important}#appUpdateButton:disabled{opacity:.7;cursor:wait}';
 document.head.append(style);document.getElementById('homeView').append(button);
 let registration=null,target=null,applying=false,lastCheck=0,checking=null;
 const watched=new WeakSet(),watchedWorkers=new WeakSet();
 function versionOf(worker){
  if(!worker||worker.state==='redundant')return Promise.resolve(null);
  return new Promise(resolve=>{
   const channel=new MessageChannel();let done=false;
   const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value)};
   const timer=setTimeout(()=>finish(null),4000);
   channel.port1.onmessage=event=>finish(typeof event.data?.version==='string'&&event.data.ready===true?event.data.version:null);
   try{worker.postMessage({type:'GET_APP_VERSION'},[channel.port2])}catch(_){finish(null)}
  });
 }
 async function inspect(){
  if(!registration)return;
  for(const worker of new Set([sw.controller,registration.active,registration.waiting])){
   const version=await versionOf(worker);
   if(version&&version!==pageVersion&&worker.state!=='redundant'){
    target={worker,version};button.hidden=false;
    if(!applying)button.textContent='↻ Mise à jour disponible';
   }
  }
 }
 function watchWorker(worker){
  if(!worker||watchedWorkers.has(worker))return;watchedWorkers.add(worker);
  worker.addEventListener('statechange',()=>{if(['installed','activated'].includes(worker.state))inspect().catch(()=>{})});
 }
 function watchRegistration(r){
  if(!r)return;registration=r;
  if(!watched.has(r)){watched.add(r);r.addEventListener('updatefound',()=>watchWorker(r.installing))}
  watchWorker(r.installing);inspect().catch(()=>{});
 }
 async function check(network=false){
  if(checking)return checking;
  checking=(async()=>{
   if(!registration)watchRegistration(await sw.getRegistration());
   if(!registration)return;
   if(network&&navigator.onLine&&Date.now()-lastCheck>60000){lastCheck=Date.now();try{await registration.update()}catch(_){}}
   await inspect();
  })().finally(()=>{checking=null});return checking;
 }
 function waitForVersion(version){
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);sw.removeEventListener('controllerchange',probe);error?reject(error):resolve()};
   const probe=async()=>{if(await versionOf(sw.controller)===version)finish()};
   const timer=setTimeout(()=>finish(Error('Nouvelle version pas encore prête')),12000);
   sw.addEventListener('controllerchange',probe);probe();
  });
 }
 button.onclick=async()=>{
  if(applying||!target)return;
  if(window.TraverseeOffline?.isBusy?.()){button.textContent='Téléchargement en cours · réessaie ensuite';return}
  applying=true;button.disabled=true;button.textContent='Enregistrement…';
  try{
   if(await window.TraverseeBivouacFlush?.()===false)throw Error('Sauvegarde Bivouac impossible');
   await window.TraverseeBackups?.flush();
   const next=target;button.textContent='Mise à jour…';
   if(registration?.waiting===next.worker)next.worker.postMessage({type:'SKIP_WAITING'});
   await waitForVersion(next.version);
   location.reload();
  }catch(_){button.textContent='Mise à jour impossible · réessayer'}
  finally{applying=false;button.disabled=false}
 };
 sw.addEventListener('controllerchange',()=>inspect().catch(()=>{}));
 window.addEventListener('traversee-sw-ready',event=>watchRegistration(event.detail));
 window.addEventListener('online',()=>check(true).catch(()=>{}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(true).catch(()=>{})});
 sw.ready.then(watchRegistration).catch(()=>{});check(true).catch(()=>{});
 window.TraverseeAppUpdate={check:()=>check(true)};
})();
