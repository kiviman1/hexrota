/* State migration characterization: a synthetic persisted pagehide must retire
 * result UI callbacks after settling the already committed move. This exercises
 * the real JS app in an isolated DOM; it does not claim native BFCache/iPhone. */
'use strict';
const assert=require('node:assert/strict');
const {mount,enter,plain,wait}=require('./check-lives-ui.cjs');
const {beforeWin}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2';

async function suspendedTerminalPresentation(){
 const saved=beforeWin(1);saved.preferences.motion='full';
 const f=mount({saved});
 try{
  f.w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  f.w.Element.prototype.animate=function(){return {cancel(){},addEventListener(){},removeEventListener(){}};};
  await enter(f);
  const pair=plain(f.game().level.solution.at(-1));
  for(const index of pair)f.click(`#board [data-index="${index}"]`);
  assert.equal(f.game().status,'won','the real final swap is authoritative before presentation ends');
  assert.equal(f.node('#board').getAttribute('aria-busy'),'true','the final move has a live presentation');
  assert.equal(f.node('#win-dialog').open,false,'the result is still deferred');
  assert.equal(f.d.hidden,false,'this probe deliberately separates pagehide from visibilitychange');
  const committed=JSON.parse(f.w.localStorage.getItem(PROFILE)),events=plain(f.events());
  assert.equal(committed.game.economy.gold,20);
  assert.equal(committed.game.economy.stars,1);
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide',{persisted:true}));
  await wait(180); // Covers the existing deferred-result deadline, without resuming the document.
  const after=JSON.parse(f.w.localStorage.getItem(PROFILE));
  assert.deepEqual(after.game,committed.game,'suspension preserves the exact committed game, RNG, reward ledger and attempt');
  assert.deepEqual(after.energy,committed.energy,'suspension cannot settle another life or change the wallet');
  assert.deepEqual(plain(f.events()),events,'suspension cannot emit another result event');
  assert.equal(f.node('#board').getAttribute('aria-busy'),'false','suspension cannot leave input permanently resolving');
  assert.equal(f.d.querySelectorAll('.swap-pair').length,0,'temporary moving stones are cleaned');
  assert.equal(f.node('#win-dialog').open,false,'a retired pagehide operation cannot reopen the victory dialog');
  assert.equal(f.node('#lose-dialog').open,false,'suspension cannot invent a loss dialog');
 }finally{f.close();}
}

if(require.main===module)suspendedTerminalPresentation().then(()=>console.log('PASS state lifecycle: synthetic suspension settles the committed final move without stale result UI or duplicate rewards.')).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={suspendedTerminalPresentation};
