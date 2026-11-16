/* The real pure state core plus a DOM adapter host. Native focus and pixels are
 * separately verified by browser tests; these shims expose queued close races. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const Core=require('./dist/app-state.js'),Effects=require('./dist/state-effects.js');
const tests=[],mounted=[];const test=(name,run)=>tests.push({name,run});
function fixture({queued=true,onClose,runAction}={}){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/dist/index.html','utf8'),{url:'https://state-effects.example/#home',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const queue=[],native=[],closed=[],errors=[],guard={gameAvailable:true,engineStatus:'playing',blocked:false,recovery:false};
 let failShow=false,failClose=false;
 w.HTMLDialogElement.prototype.showModal=function(){if(failShow)throw new Error('test showModal failure');this.setAttribute('open','');native.push('open:'+this.id);this.querySelector('[autofocus],button')?.focus();};
 w.HTMLDialogElement.prototype.close=function(){if(failClose)throw new Error('test close failure');if(!this.open)return;this.removeAttribute('open');native.push('close:'+this.id);const event=()=>this.dispatchEvent(new w.Event('close'));if(queued)queue.push(event);else event();};
 const state=Core.create(),adapter=Effects.create({document:d,window:w,state,getFacts:()=>guard,runAction,onError:failure=>errors.push(failure),onClose:value=>{closed.push(value);onClose?.(value);}});
 const f={dom,w,d,state,adapter,guard,queue,native,closed,errors,showFailure:value=>failShow=value,closeFailure:value=>failClose=value,
  node:id=>d.getElementById(id),flush(){while(queue.length)queue.shift()();},navigate(screen,options={historyChange:false}){const change=state.dispatch({type:'NAVIGATE',screen},guard);if(change.accepted)assert.equal(adapter.renderScreen(screen,options).accepted,true);return change;},
  dispose(){adapter.destroy();state.destroy();dom.window.close();}};mounted.push(f);return f;
}
const ids=f=>Core.modalIds(f.state.snapshot());

test('accepted screens update existing DOM and history without loading or rebuilding a board',()=>{
 const f=fixture();try{
  const board=f.node('board'),history=f.w.history.length;
  assert.equal(f.adapter.renderScreen('home',{replace:true}).accepted,true);assert.equal(f.w.history.length,history);
  assert.equal(f.navigate('journey',{historyChange:true}).accepted,true);assert.equal(f.w.history.length,history+1);assert.equal(f.w.location.hash,'#journey');
  assert.equal(f.adapter.renderScreen('journey').accepted,true);assert.equal(f.w.history.length,history+1,'same screen cannot push duplicate history');
  f.navigate('records',{historyChange:true,replace:true});assert.equal(f.w.history.length,history+1);assert.equal(f.w.location.hash,'#records');
  const before=f.d.body.outerHTML,location=f.w.location.href;
  assert.equal(f.adapter.renderScreen('settings').accepted,false);assert.equal(f.d.body.outerHTML,before);assert.equal(f.w.location.href,location);
  f.navigate('game');for(const name of Core.SCREENS){assert.equal(f.node(name+'-screen').hidden,name!=='game');assert.equal(f.node(name+'-screen').inert,name!=='game');}
  assert.equal(f.node('board'),board);assert.equal(f.node('settings-screen'),null);
 }finally{f.dispose();}
});

test('guards reject invalid modal nesting and default closes only the top modal',()=>{
 const f=fixture();try{
  f.navigate('game');assert(f.adapter.canOpen('pause-dialog'));assert(f.adapter.open('pause-dialog').accepted);
  assert(f.adapter.open('settings-dialog').accepted);const before=f.state.snapshot();
  assert.equal(f.adapter.canOpen('inventory-dialog'),false);assert.equal(f.adapter.open('inventory-dialog').accepted,false);
  assert.equal(f.adapter.close('pause-dialog').reason,'not_top_modal');assert.equal(f.state.snapshot(),before);
  assert.equal(f.adapter.topDialog(),f.node('settings-dialog'));assert.equal(f.adapter.open('settings-dialog').changed,false);assert.equal(ids(f).length,2);
  assert.equal(f.adapter.close('pause-dialog',{internal:true}).accepted,true);assert.deepEqual(ids(f),['settings-dialog']);assert(f.node('settings-dialog').open);assert(!f.node('pause-dialog').open);
  assert(f.node('settings-dialog').contains(f.d.activeElement),'closing an underlying modal must not steal the top modal focus');
 }finally{f.dispose();}
});

test('modal close callbacks are once per instance and restore a live parent opener',()=>{
 const f=fixture();try{
  f.navigate('game');f.node('pause').focus();assert(f.adapter.open('pause-dialog').accepted);
  f.node('pause-settings').focus();assert(f.adapter.open('settings-dialog').accepted);
  const instance=f.state.snapshot().overlays.modals.at(-1).instance;
  assert(f.adapter.close('settings-dialog').accepted);assert.equal(f.d.activeElement,f.node('pause-settings'));assert.deepEqual(f.closed.map(x=>x.instance),[instance]);
  f.flush();assert.deepEqual(f.closed.map(x=>x.instance),[instance],'queued native close is only an acknowledgment');
  assert(f.adapter.close('pause-dialog').accepted);assert.equal(f.d.activeElement,f.node('pause'));f.flush();assert.equal(f.closed.length,2);
 }finally{f.dispose();}
});

test('old programmatic close cannot clear or close a newer opening of the same dialog',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');const old=f.state.snapshot().overlays.modals[0];
  f.adapter.close('pause-dialog');f.adapter.open('pause-dialog');const current=f.state.snapshot().overlays.modals[0];assert.notEqual(current.instance,old.instance);
  assert.equal(f.closed.length,1);f.flush();assert(f.node('pause-dialog').open);assert.equal(f.state.snapshot().overlays.modals[0],current);assert.equal(f.closed.length,1);
  f.adapter.close('pause-dialog');f.flush();assert.equal(f.closed.length,2);assert.equal(f.closed[1].instance,current.instance);
 }finally{f.dispose();}
});

test('native close then immediate reopen supersedes obsolete cleanup before its event arrives',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');const old=f.state.snapshot().overlays.modals[0];
  f.node('pause-dialog').close();assert.equal(f.closed.length,0);assert(f.adapter.open('pause-dialog').accepted);
  const current=f.state.snapshot().overlays.modals[0];assert.notEqual(current.instance,old.instance);f.flush();
  assert(f.node('pause-dialog').open);assert.equal(f.state.snapshot().overlays.modals[0],current);assert.equal(f.closed.length,0,'an old close cannot clear the new pending request');
  f.node('pause-dialog').close();f.flush();assert.deepEqual(ids(f),[]);assert.equal(f.closed.length,1);assert.equal(f.closed[0].instance,current.instance);
 }finally{f.dispose();}
});

test('an internal close cannot orphan a required confirmation but may remove a legal ancestor',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');f.adapter.open('settings-dialog');f.adapter.open('full-reset-dialog');
  const before=f.state.snapshot(),native=f.native.slice();assert.equal(f.adapter.close('settings-dialog',{internal:true}).reason,'modal_topology');
  assert.equal(f.state.snapshot(),before);assert.deepEqual(f.native,native);assert(f.node('settings-dialog').open&&f.node('full-reset-dialog').open);
  assert(f.adapter.close('pause-dialog',{internal:true}).accepted);assert.deepEqual(ids(f),['settings-dialog','full-reset-dialog']);assert.equal(f.adapter.topDialog(),f.node('full-reset-dialog'));
 }finally{f.dispose();}
});

test('native required-parent close is repaired in original order without domain cleanup',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');f.adapter.open('settings-dialog');f.adapter.open('full-reset-dialog');
  const before=f.state.snapshot(),active=f.d.activeElement;f.node('settings-dialog').close();f.flush();
  assert.equal(f.state.snapshot(),before,'a rejected state transition keeps exact instances');assert.deepEqual(ids(f),['pause-dialog','settings-dialog','full-reset-dialog']);
  assert(f.node('settings-dialog').open&&f.node('full-reset-dialog').open);assert.equal(f.adapter.topDialog(),f.node('full-reset-dialog'));assert.equal(f.d.activeElement,active);
  assert.equal(f.closed.length,0,'native repair is not a provider/reset cancel command');assert.equal(f.errors.length,0);
 }finally{f.dispose();}
});

test('reopening a natively closed ancestor before its event repairs the same opening',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');f.adapter.open('settings-dialog');f.adapter.open('reset-dialog');
  const before=f.state.snapshot();f.node('settings-dialog').close();assert.equal(f.adapter.open('settings-dialog').reason,'native_restored');f.flush();
  assert.equal(f.state.snapshot(),before);assert(f.node('settings-dialog').open&&f.node('reset-dialog').open);assert.equal(f.adapter.topDialog(),f.node('reset-dialog'));assert.equal(f.closed.length,0);
 }finally{f.dispose();}
});

test('closeAll is top-first and navigation does not leave focus inside a hidden screen',()=>{
 const f=fixture();try{
  f.navigate('game');f.node('pause').focus();f.adapter.open('pause-dialog');f.adapter.open('settings-dialog');f.adapter.open('reset-dialog');
  f.native.length=0;assert(f.adapter.closeAll().accepted);assert.deepEqual(f.native,['close:reset-dialog','close:settings-dialog','close:pause-dialog']);assert.deepEqual(ids(f),[]);
  f.node('pause').focus();f.navigate('home');assert(f.node('home-screen').contains(f.d.activeElement),'hidden game controls must not retain focus after navigation');
  f.flush();assert.deepEqual(ids(f),[]);assert.equal(f.d.body.classList.contains('modal-open'),false);
 }finally{f.dispose();}
});

test('direct accepted state events also execute their declared modal effects once',()=>{
 const f=fixture();try{
  f.state.dispatch({type:'OPEN_MODAL',id:'settings-dialog'},f.guard);assert(f.node('settings-dialog').open);assert.equal(f.adapter.topDialog(),f.node('settings-dialog'));
  f.state.dispatch({type:'OPEN_MODAL',id:'install-dialog'},f.guard);assert(f.node('install-dialog').open);
  const install=f.state.snapshot().overlays.modals.at(-1);f.state.dispatch({type:'CLOSE_MODAL',...install},f.guard);assert(!f.node('install-dialog').open);assert(f.node('settings-dialog').open);
  f.flush();assert.equal(f.closed.length,1);
 }finally{f.dispose();}
});

test('native geometry fallback blocks commands without adopting an unrestricted modal',()=>{
 const f=fixture();try{
  f.node('win-dialog').showModal();const before=f.state.snapshot();assert.equal(f.adapter.topDialog(),f.node('win-dialog'));
  assert.equal(f.adapter.canOpen('settings-dialog'),false);assert.equal(f.adapter.open('settings-dialog').reason,'unmanaged_modal');assert.equal(f.state.snapshot(),before);
  assert(f.adapter.close('win-dialog').accepted);f.flush();assert.equal(f.adapter.topDialog(),null);assert.equal(f.closed.length,0,'external probes have no owned domain-cleanup callback');
 }finally{f.dispose();}
});

test('showModal failure rolls back only that instance and does not poison a later native close',()=>{
 const f=fixture();try{
  f.showFailure(true);assert.equal(f.adapter.open('settings-dialog').reason,'effect_failed');assert.deepEqual(ids(f),[]);assert(!f.node('settings-dialog').open);assert.equal(f.closed.length,0);
  f.showFailure(false);assert(f.adapter.open('settings-dialog').accepted);f.node('settings-dialog').close();f.flush();assert.deepEqual(ids(f),[]);assert.equal(f.closed.length,1);assert.equal(f.errors[0].type,'modal.open');
 }finally{f.dispose();}
});

test('native close failure keeps a blocking modal and cleanup waits for a successful retry',()=>{
 const f=fixture();try{
  f.navigate('game');f.adapter.open('pause-dialog');f.closeFailure(true);assert.equal(f.adapter.close('pause-dialog').reason,'effect_failed');
  assert(f.node('pause-dialog').open);assert.equal(f.adapter.topDialog(),f.node('pause-dialog'));assert.deepEqual(ids(f),['pause-dialog']);assert.equal(f.closed.length,0);
  f.closeFailure(false);assert(f.adapter.close('pause-dialog').accepted);f.flush();assert.equal(f.closed.length,1);assert.equal(f.adapter.topDialog(),null);
 }finally{f.dispose();}
});

test('cleanup callbacks retain the host action barrier and may reenter through the queued core',()=>{
 let allowed=true,calls=0,f;
 f=fixture({runAction:callback=>{if(allowed){calls++;return callback();}},onClose:closed=>{if(closed.id==='pause-dialog')f.adapter.open('settings-dialog');}});try{
  f.navigate('game');f.adapter.open('pause-dialog');f.adapter.close('pause-dialog');assert.equal(calls,1);assert.deepEqual(ids(f),['settings-dialog']);assert(f.node('settings-dialog').open);f.flush();
  allowed=false;f.adapter.close('settings-dialog');f.flush();assert.equal(calls,1,'the irreversible full-reset host barrier suppresses callbacks');
 }finally{f.dispose();}
});

test('adapter effects do not access durable storage and destroy unsubscribes every owned listener',()=>{
 const f=fixture();try{
  f.w.Storage.prototype.getItem=()=>{throw new Error('forbidden storage read');};f.w.Storage.prototype.setItem=()=>{throw new Error('forbidden storage write');};
  f.adapter.open('settings-dialog');const notified=f.closed.length;f.adapter.destroy();f.adapter.destroy();
  f.node('settings-dialog').close();f.flush();assert.equal(f.closed.length,notified);
  f.state.dispatch({type:'CLOSE_ALL'},f.guard);f.state.dispatch({type:'OPEN_MODAL',id:'help-dialog'},f.guard);assert.equal(f.node('help-dialog').open,false,'destroyed subscriptions cannot recreate DOM');
  assert.equal(f.adapter.open('help-dialog').reason,'disposed');assert.equal(f.adapter.renderScreen('home').reason,'disposed');
 }finally{f.dispose();}
});

(async()=>{let failed=0;for(const {name,run}of tests)try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}finally{for(const f of mounted.splice(0))f.dispose();}if(failed)process.exitCode=1;else console.log('State DOM effects passed: '+tests.length+' groups; real pure core, queued-native-event/focus shims only; no physical-device claim.');})().catch(error=>{console.error(error);process.exitCode=1;});
