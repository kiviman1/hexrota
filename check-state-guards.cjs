/* Adversarial transition acceptance tests. Written red before Stage C.
 * Only real DOM commands and authoritative storage are observed: no private
 * application variables, test-only state bridge, or alternative game engine.
 */
'use strict';
const assert=require('node:assert/strict');
const {mount,fresh,existing,enter,wait}=require('./check-lives-ui.cjs');
const PROFILE='hexrota-profile-v2',tests=[],errors=[];
const test=(name,run)=>tests.push({name,run});
function fixture(options){const f=mount(options);f.w.addEventListener('error',event=>errors.push(event.error?.message||event.message));return f;}
const opened=f=>[...f.d.querySelectorAll('dialog[open]')].map(node=>node.id).sort();
const bytes=f=>f.w.localStorage.getItem(PROFILE);
function capture(f){return {screen:f.d.body.dataset.screen,dialogs:opened(f),canonical:bytes(f),board:f.node('#board'),history:f.w.history.length,hash:f.w.location.hash};}
function unchanged(f,before,label){
 assert.equal(f.d.body.dataset.screen,before.screen,label+' preserves the current screen');
 assert.deepEqual(opened(f),before.dialogs,label+' preserves the modal stack');
 assert.equal(bytes(f),before.canonical,label+' performs no canonical write or economic/gameplay change');
 assert.equal(f.node('#board'),before.board,label+' preserves the SVG container');
 assert.equal(f.w.history.length,before.history,label+' does not add a history entry');
 assert.equal(f.w.location.hash,before.hash,label+' does not change the URL screen');
}
function injected(f,name,value){const button=f.d.createElement('button');button.setAttribute(name,value);f.d.body.appendChild(button);try{button.click();}finally{button.remove();}}
function escape(f){f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));}

test('malformed injected navigation is rejected before any screen/modal/save/history side effect',async()=>{
 for(const target of ['__unknown_screen__','','GAME','1']){
  const f=fixture({saved:existing(2,{turns:1}).saved});try{
   await enter(f);f.click('#pause');f.click('#pause-settings');const before=capture(f);
   injected(f,'data-nav',target);unchanged(f,before,'invalid data-nav '+JSON.stringify(target));
  }finally{f.close();}
 }
});

test('raw GAME navigation cannot activate a read-only HOME preview without a committed attempt',()=>{
 const f=fixture({saved:fresh(2)});try{
  assert.equal(f.d.body.dataset.screen,'home');assert.equal(Object.keys(f.save().attempts).length,0);
  const before=capture(f);injected(f,'data-nav','game');unchanged(f,before,'raw preview-to-game navigation');
  assert.deepEqual(f.save().boards,{},'a navigation event cannot invent a playable checkpoint');
 }finally{f.close();}
});

test('hidden inventory command is rejected while unrelated Settings is open',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);f.click('#game-settings');assert.deepEqual(opened(f),['settings-dialog']);
  const before=capture(f);f.click('#open-inventory');unchanged(f,before,'Settings → Inventory');
 }finally{f.close();}
});

test('hidden Settings command is rejected while unrelated Inventory is open',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);f.click('#open-inventory');assert.deepEqual(opened(f),['inventory-dialog']);
  const before=capture(f);f.click('#game-settings');unchanged(f,before,'Inventory → Settings');
 }finally{f.close();}
});

test('a hidden stage command cannot stack a level preview over Settings',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);f.click('#game-settings');const before=capture(f);
  injected(f,'data-stage','0');unchanged(f,before,'Settings → hidden level preview');
 }finally{f.close();}
});

test('a rejected stage request leaves no pending stage usable by a later hidden start command',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);f.click('#game-settings');const canonical=bytes(f),board=f.node('#board');
  injected(f,'data-stage','0');f.click('#settings-dialog [data-close]');
  // Even if an implementation rejects OPEN_MODAL, it must not keep the earlier
  // speculative pendingStage assignment available to this stale DOM callback.
  f.click('#pregame-start');await wait(2);
  assert.equal(f.d.body.dataset.screen,'game');assert.equal(f.save().current,2,'the current campaign stage is retained');
  assert.equal(bytes(f),canonical,'the rejected preview/start cannot allocate a tutorial attempt or rewrite the profile');
  assert.deepEqual(opened(f),[]);assert.equal(f.node('#board'),board);
 }finally{f.close();}
});

test('closing a valid preview clears its stage before an invalid stage and stale start request',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);f.click('[data-nav="journey"]');f.click('[data-stage="0"]');assert.deepEqual(opened(f),['pregame-dialog']);
  escape(f);assert.deepEqual(opened(f),[]);const before=capture(f);
  injected(f,'data-stage','999');f.click('#pregame-start');unchanged(f,before,'cancelled/out-of-range preview');
 }finally{f.close();}
});

test('intentional Pause → Settings → Reset nesting and top-first cancellation remain permitted',async()=>{
 const f=fixture({saved:existing(2,{turns:1}).saved});try{
  await enter(f);const board=f.node('#board'),snapshot=JSON.stringify(f.save().boards),economy=JSON.stringify(f.save().economy),lives=f.life().life.lives;
  f.click('#pause');f.click('#pause-settings');f.click('#settings-reset');assert.deepEqual(opened(f),['pause-dialog','reset-dialog','settings-dialog']);
  escape(f);assert.deepEqual(opened(f),['pause-dialog','settings-dialog']);escape(f);assert.deepEqual(opened(f),['pause-dialog']);escape(f);assert.deepEqual(opened(f),[]);
  assert.equal(f.d.body.dataset.screen,'game');assert.equal(f.node('#board'),board);assert.equal(JSON.stringify(f.save().boards),snapshot);
  assert.equal(JSON.stringify(f.save().economy),economy);assert.equal(f.life().life.lives,lives);
 }finally{f.close();}
});

(async()=>{
 const failures=[];
 for(const {name,run}of tests){try{await run();console.log('PASS '+name);}catch(error){failures.push({name,error});console.error('FAIL '+name+'\n'+error.stack);}}
 assert.deepEqual(errors,[],'no unhandled application exception is accepted as a guard');
 console.log('State guard acceptance: '+(tests.length-failures.length)+'/'+tests.length+' passed. Tests use the production host, not a private state test API.');
 if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
