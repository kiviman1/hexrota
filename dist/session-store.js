/* Canonical profile persistence. The host owns the single-writer lock; this
 * adapter validates every read/commit boundary and only updates memory after a
 * successful authoritative write. Mirror writes are repairable, not commits. */
(function(root){
 'use strict';
 const KEY='hexrota-profile-v2',GAME='hexrota-match-v5',ENERGY='hexrota-lives-v1',LOCK='hexrota-profile-writer-v2';
 // Deliberate full-profile deletion for local prototype testing. Keep this list
 // explicit: another application's storage and the live writer lock are not ours.
 const RESET_KEYS=Object.freeze(['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-v1','hexrota-events-v1','hexrota-playtest-v1']);
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isMap=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function validateEnvelope(value){
  if(!isMap(value)||value.schemaVersion!==2||!Number.isSafeInteger(value.revision)||value.revision<1||!isMap(value.game)||!isMap(value.energy))throw new Error('invalid_profile');
 }
 function createStore(storage,{writable=true}={}){
  let revision=0,durable=null;
  const parse=key=>{const raw=storage.getItem(key);return raw===null?null:JSON.parse(raw);};
  const canonicalRaw=storage.getItem(KEY);
  if(canonicalRaw!==null){
   const existing=JSON.parse(canonicalRaw);validateEnvelope(existing);
   revision=existing.revision;durable=copy(existing);
  }else{
   const game=parse(GAME),energy=parse(ENERGY);
   if(game&&energy)durable={schemaVersion:2,revision:0,game:copy(game),energy:copy(energy)};
  }
  function current(){return copy(durable);}
  function contains(key){return !!durable&&(key===GAME||key===ENERGY)||storage.getItem(key)!==null;}
  function read(key){
   if(durable&&key===GAME)return copy(durable.game);
   if(durable&&key===ENERGY)return copy(durable.energy);
   return parse(key);
  }
  function commit(game,energy){
   if(!writable)throw new Error('read_only');
   if(revision>=Number.MAX_SAFE_INTEGER)throw new Error('revision_exhausted');
   if(!isMap(game)||!isMap(energy))throw new Error('invalid_profile');
   const latestRaw=storage.getItem(KEY);let latestRevision=0;
   if(latestRaw!==null){
    const latest=JSON.parse(latestRaw);validateEnvelope(latest);latestRevision=latest.revision;
   }
   if(latestRevision!==revision)throw new Error('stale_profile');
   const next={schemaVersion:2,revision:revision+1,game:copy(game),energy:copy(energy)};
   validateEnvelope(next);
   // Serialize before writing: bad input cannot partly replace durable state.
   const encoded=JSON.stringify(next);storage.setItem(KEY,encoded);
   revision=next.revision;durable=next;
   // Never undo a successful canonical transaction because a mirror failed.
   for(const [key,value]of [[GAME,game],[ENERGY,energy]])try{storage.setItem(key,JSON.stringify(value));}catch(_){}
   return current();
  }
  function resetForTesting(game,energy){
   // The host supplies fresh, validated game/life defaults. Preserve the existing
   // CAS and atomic game+energy boundary; never remove the authoritative key.
   const profile=commit(game,energy);
   // No stale callback in this document may resurrect the pre-reset game while
   // the host reloads. The Web Lock itself is released on pagehide as before.
   writable=false;
   const cleanupFailures=[];
   for(const key of RESET_KEYS)try{storage.removeItem(key);}catch(_){cleanupFailures.push(key);}
   // Mirror writes are optional, but report repair failures for this explicit
   // data-deletion action instead of suggesting every stored copy was removed.
   for(const [key,value]of [[GAME,profile.game],[ENERGY,profile.energy]])try{
    if(storage.getItem(key)!==JSON.stringify(value))cleanupFailures.push(key);
   }catch(_){cleanupFailures.push(key);}
   return {profile,cleanupFailures};
  }
  return {read,contains,current,commit,resetForTesting,get revision(){return revision;},revoke(){writable=false;}};
 }
 function boot(start){
  const w=root,flow=w.HexCampaignFlow?.enabled===true,storage=flow?w.HexCampaignFlow.storage(w.localStorage):w.localStorage;
  if(w.HexSessionTestMode?.isolated===true){start(createStore(storage));return;}
  const blocked=(message,retry=true)=>{
   let panel=w.document.getElementById('session-lock-panel');
   if(!panel){panel=w.document.createElement('section');panel.id='session-lock-panel';panel.setAttribute('role','alert');panel.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:20px;padding:28px;text-align:center;background:#f5f5e9;color:#214f38;font:600 18px system-ui';w.document.body.append(panel);}
   panel.replaceChildren();const text=w.document.createElement('p');text.textContent=message;panel.append(text);
   if(retry){const button=w.document.createElement('button');button.type='button';button.textContent='Tekrar dene';button.style.cssText='padding:16px;border-radius:16px;font:inherit';button.onclick=()=>w.location.reload();panel.append(button);}
  };
  if(!w.navigator.locks?.request){blocked('Bu tarayıcı güvenli kayıt kilidini desteklemiyor. Güncel bir tarayıcıda aç. Mevcut kayıtların korunuyor.',false);return;}
  w.navigator.locks.request(flow?w.HexCampaignFlow.prefix+LOCK:LOCK,{ifAvailable:true},async lock=>{
   if(!lock){blocked('Oyun başka bir sekmede açık. Kaydını korumak için bu sekme bekliyor. Diğer sekmeyi kapatıp tekrar dene.');return;}
   let store;
   try{store=createStore(storage);start(store);}catch(_){store?.revoke();blocked('Kayıt güvenle açılamadı. İlerlemen değiştirilmedi. Sayfayı yenileyip tekrar dene.');return;}
   await new Promise(resolve=>w.addEventListener('pagehide',()=>{store.revoke();resolve();},{once:true}));
  }).catch(()=>blocked('Kayıt kilidi alınamadı. Mevcut kayıtların korundu. Tekrar dene.'));
  w.addEventListener('pageshow',event=>{if(event.persisted)w.location.reload();});
 }
 const api={createStore,boot,key:KEY};root.HexSessionStore=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
