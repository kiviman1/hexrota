/* Host persistence adapter. Gameplay snapshots remain unchanged. */
(function(root){
 'use strict';
 const KEY='hexrota-profile-v2',GAME='hexrota-match-v5',ENERGY='hexrota-lives-v1',LOCK='hexrota-profile-writer-v2';
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function createStore(storage,{writable=true}={}){
  let revision=0,durable=null;
  const parse=key=>{const raw=storage.getItem(key);return raw===null?null:JSON.parse(raw);};
  const canonicalRaw=storage.getItem(KEY),existing=canonicalRaw===null?null:JSON.parse(canonicalRaw);
  if(canonicalRaw!==null&&(!existing||typeof existing!=='object'||Array.isArray(existing)))throw new Error('invalid_profile');
  if(!existing){const game=parse(GAME),energy=parse(ENERGY);if(game&&energy)durable={schemaVersion:2,revision:0,game:copy(game),energy:copy(energy)};}
  if(existing){if(existing.schemaVersion!==2||!Number.isSafeInteger(existing.revision)||existing.revision<1||!existing.game||typeof existing.game!=='object'||Array.isArray(existing.game)||!existing.energy||typeof existing.energy!=='object'||Array.isArray(existing.energy))throw new Error('invalid_profile');revision=existing.revision;durable=copy(existing);}
  function current(){return copy(durable);}
  function read(key){return durable?(key===GAME?copy(durable.game):key===ENERGY?copy(durable.energy):parse(key)):parse(key);}
  function commit(game,energy){
   if(!writable)throw new Error('read_only');
   const latest=parse(KEY);if((latest?.revision||0)!==revision)throw new Error('stale_profile');
   const next={schemaVersion:2,revision:revision+1,game:copy(game),energy:copy(energy)};
   const encoded=JSON.stringify(next);storage.setItem(KEY,encoded);revision=next.revision;durable=next;
   // Compatibility mirrors are repairable. A failed mirror must never undo a
   // successful authoritative transaction or produce a second life debit.
   for(const [key,value]of [[GAME,game],[ENERGY,energy]])try{storage.setItem(key,JSON.stringify(value));}catch(_){}
   return current();
  }
  return {read,current,commit,get revision(){return revision;},revoke(){writable=false;}};
 }
 function boot(start){
  const w=root;
  if(w.HexSessionTestMode?.isolated===true){start(createStore(w.localStorage));return;}
  const blocked=(message,retry=true)=>{
   let panel=w.document.getElementById('session-lock-panel');
   if(!panel){panel=w.document.createElement('section');panel.id='session-lock-panel';panel.setAttribute('role','alert');panel.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:20px;padding:28px;text-align:center;background:#f5f5e9;color:#214f38;font:600 18px system-ui';w.document.body.append(panel);}
   panel.replaceChildren();const text=w.document.createElement('p');text.textContent=message;panel.append(text);
   if(retry){const button=w.document.createElement('button');button.type='button';button.textContent='Tekrar dene';button.style.cssText='padding:16px;border-radius:16px;font:inherit';button.onclick=()=>w.location.reload();panel.append(button);}
  };
  if(!w.navigator.locks?.request){blocked('Bu tarayıcı güvenli kayıt kilidini desteklemiyor. Güncel bir tarayıcıda aç. Mevcut kayıtların korunuyor.',false);return;}
  w.navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
   if(!lock){blocked('Oyun başka bir sekmede açık. Kaydını korumak için bu sekme bekliyor. Diğer sekmeyi kapatıp tekrar dene.');return;}
   let store;
   try{store=createStore(w.localStorage);start(store);}catch(_){store?.revoke();blocked('Kayıt güvenle açılamadı. İlerlemen değiştirilmedi. Sayfayı yenileyip tekrar dene.');return;}
   await new Promise(resolve=>w.addEventListener('pagehide',()=>{store.revoke();resolve();},{once:true}));
  }).catch(()=>blocked('Kayıt kilidi alınamadı. Mevcut kayıtların korundu. Tekrar dene.'));
  w.addEventListener('pageshow',event=>{if(event.persisted)w.location.reload();});
 }
 const api={createStore,boot,key:KEY};root.HexSessionStore=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
