/* Replay checked-in cross-language goldens without invoking their generator. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const {HexMatch,HexAttempts,HEX_LEVELS,HEX_TUTORIALS,HEX_VARIANTS}=context.window;
for(const [file,kind,version,levels]of [['levels-original.json','campaign','original-v1',HEX_LEVELS],['tutorials-fixed.json','tutorial','tutorials-v1',HEX_TUTORIALS]]){
 const data=JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));
 assert.equal(data.schemaVersion,1);assert.equal(data.kind,kind);assert.equal(data.levelDataVersion,version);assert.equal(data.rulesVersion,'classic-v4');
 assert.deepEqual(data.levels,plain(levels),file+' preserves every original configuration field and ID type');
}
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures/gameplay-vectors.json'),'utf8'));
assert.equal(fixture.schemaVersion,1);assert.equal(fixture.rulesVersion,'classic-v4');assert.equal(fixture.variantDataVersion,HEX_VARIANTS.levelDataVersion);
const catalog=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch);
function observed(game){return {snapshot:plain(game.snapshot()),status:game.status,covered:game.covered,remainingLayers:game.remainingLayers};}
function same(game,expected,message){assert.deepEqual(observed(game),expected,message);}
function checkHint(game,vector,message){
 const before=observed(game),actual=game.hint(vector.options);
 assert.deepEqual(plain(actual),vector.expected,message+' exact node-limited hint');same(game,before,message+' hint never changes gameplay state or RNG');
 if(actual){
  assert(game.legalMoves().some(pair=>pair.slice().sort((a,b)=>a-b).join(',')===actual.pair.slice().sort((a,b)=>a-b).join(',')),message+' hint is legal');
  assert.equal(actual.guaranteed,actual.source!=='heuristic',message+' confidence is honest');
  if(actual.guaranteed){const trial=game.clone();for(const pair of actual.continuation)assert(trial.swap(...pair).ok);assert.equal(trial.status,'won',message+' guaranteed continuation really wins');}
 }
}
function injected(level,state){
 const game=new HexMatch(level),snapshot=state.snapshot;
 for(const field of ['values','layers','score','movesLeft','turn','rngState','history'])game[field]=plain(snapshot[field]);
 return game;
}
let checkedMoves=0,checkedResumes=0;
for(const entry of fixture.cases){
 if(entry.kind==='rng'){
  const game=new HexMatch({cells:[{q:0,r:0,layers:1}],initial:[1],palette:[1,2],seed:entry.seed,moves:1,target:1});
  assert.equal(game.rngState,entry.initialState,entry.id+' initial unsigned state');
  for(const expected of entry.expected)assert.equal(game._random(),expected,entry.id+' uint32 stream');
 }else if(entry.kind==='matches'){
  assert.deepEqual(plain(new HexMatch(entry.level).findMatches(entry.values)),entry.expected,entry.id+' axis detection');
 }else if(entry.kind==='route'){
  let game=new HexMatch(entry.level);same(game,entry.initial,entry.id+' initial');checkHint(game,entry.hint,entry.id+' initial');
  if(entry.attempt){
   const start=catalog.start(entry.source.levelId,entry.attempt.selectorInput);
   assert.deepEqual(plain(start.metadata),entry.attempt.metadata,entry.id+' selected attempt identity');
   assert.equal(start.selectionSeed,entry.attempt.selectionSeed,entry.id+' independent selection RNG');
   for(const field of ['id','rulesVersion','cells','initial','palette','seed','moves','target','variantId','levelDataVersion'])assert.deepEqual(plain(start.level[field]),entry.level[field],entry.id+' resolved configuration '+field);
  }
  for(const invalid of entry.invalidSwaps){
   const before=observed(game),result=game.swap(...invalid.pair);
   assert.equal(result.ok,false,entry.id+' invalid swap');assert.equal(result.reason,invalid.reason);
   same(game,before,entry.id+' invalid swap preserves all state including RNG');
  }
  for(const [index,step]of entry.steps.entries()){
   assert.deepEqual(plain(game.swap(...step.pair)),step.result,entry.id+' move '+(index+1)+' exact waves/refill/gravity');
   same(game,step.after,entry.id+' move '+(index+1)+' exact state');checkHint(game,step.hint,entry.id+' move '+(index+1));checkedMoves++;
   if(index+1===entry.resumeAfterTurn){
    const snapshot=plain(game.snapshot());
    if(step.attemptCheckpoint){
     assert.deepEqual(plain(catalog.checkpoint(entry.attempt.metadata,game)),step.attemptCheckpoint,entry.id+' checkpoint envelope');
     const loaded=catalog.restore(entry.source.levelId,step.attemptCheckpoint);
     assert.deepEqual(plain(loaded.metadata),entry.attempt.metadata,entry.id+' restored identity');
     same(loaded.game,step.after,entry.id+' restored envelope');
     const split=catalog.restore(entry.source.levelId,snapshot,entry.attempt.metadata);same(split.game,step.after,entry.id+' v5 split storage');
     game=loaded.game;
    }else{
     game=new HexMatch(entry.level,snapshot);
     if(entry.source.kind==='legacy'){
      const loaded=catalog.restore(entry.source.levelId,snapshot);
      assert.equal(loaded.metadata.variantId,'legacy-original');assert.equal(loaded.metadata.levelDataVersion,'original-v1');
      same(loaded.game,step.after,entry.id+' raw pre-variant save');
     }
    }
    same(game,step.after,entry.id+' restored board');checkedResumes++;
    for(const field of ['score','rngState','values','layers']){
     const tampered=plain(snapshot);
     if(field==='score')tampered.score++;
     if(field==='rngState')tampered.rngState=((tampered.rngState+1)>>>0)||1;
     if(field==='values')tampered.values[0]=entry.level.palette.find(value=>value!==tampered.values[0]);
     if(field==='layers')tampered.layers[0]=tampered.layers[0]===0?1:tampered.layers[0]-1;
     assert.throws(()=>new HexMatch(entry.level,tampered),entry.id+' rejects forged '+field);
    }
   }
  }
  if(entry.source.scope==='complete')assert.equal(game.status,'won',entry.id+' complete route wins');
  if(entry.terminalSwap){assert.deepEqual(plain(game.swap(...entry.terminalSwap.pair)),entry.terminalSwap.result);same(game,entry.terminalSwap.after,entry.id+' terminal is immutable');}
 }else{
  const game=injected(entry.level,entry.state);let result;
  if(entry.kind==='status')result=game.status;
  else if(entry.kind==='state-swap')result=game.swap(...entry.pair);
  else if(entry.kind==='gravity')result=game._gravity(entry.removed);
  else if(entry.kind==='refill')result=game._fillVacancies();
  else if(entry.kind==='reshuffle'){
   assert.equal(game.findMatches().length,0);assert.equal(game.legalMoves().length,0);
   result=game._ensurePlayable();
   assert.deepEqual(plain(game.layers),entry.state.snapshot.layers);assert.equal(game.score,entry.state.snapshot.score);
   assert.equal(game.movesLeft,entry.state.snapshot.movesLeft);assert.equal(game.turn,entry.state.snapshot.turn);
   assert.deepEqual(plain(game.legalMoves()),entry.legalMoves);assert.equal(game.findMatches().length,0);
  }else assert.fail('Unknown golden kind '+entry.kind);
  assert.deepEqual(plain(result),entry.result,entry.id+' component result');same(game,entry.after,entry.id+' component state');
  if(entry.kind==='state-swap'){assert.equal(game.movesLeft,0);assert.equal(game.status,'won','goal completion wins on the last move');}
 }
}
for(const vector of fixture.selectionCases){
 const result=catalog.start(vector.levelId,vector.input);
 assert.deepEqual({metadata:plain(result.metadata),selectionSeed:result.selectionSeed},vector.expected,'deterministic selector L'+vector.levelId+' attempt '+vector.input.attemptSerial);
 assert.notEqual(result.metadata.variantId,vector.input.previousVariantId,'successive starts avoid the same variant');
}
for(const vector of fixture.rejectionCases){
 const before=JSON.stringify(vector.checkpoint);
 assert.throws(()=>catalog.restore(vector.levelId,vector.checkpoint,vector.metadata),error=>{
  if(vector.expectedErrorCode!==null)assert.equal(error.code,vector.expectedErrorCode,vector.id+' typed rejection');
  return true;
 },vector.id+' is rejected');
 assert.equal(JSON.stringify(vector.checkpoint),before,vector.id+' rejection does not rewrite a saved record');
}
assert.equal(fixture.coverage.variantPrefixes,HEX_VARIANTS.levels.reduce((count,level)=>count+level.variants.length,0));
assert.equal(fixture.cases.filter(entry=>entry.source?.kind==='tutorial').length,2);
assert.equal(fixture.cases.filter(entry=>entry.source?.kind==='legacy').length,10);
assert(fixture.cases.some(entry=>entry.kind==='reshuffle'));
assert(fixture.cases.some(entry=>entry.kind==='refill'&&entry.result.some(tile=>tile.forced)));
assert(fixture.cases.some(entry=>entry.kind==='route'&&entry.steps.some(step=>step.result.frames.length>=2)));
assert(fixture.cases.some(entry=>entry.kind==='route'&&entry.steps.some(step=>step.hint.expected?.source==='search_win')),'node-limited solver actually proves a short win');
assert(fixture.cases.some(entry=>entry.kind==='route'&&entry.hint.expected?.source==='heuristic'),'unproven search is represented honestly');
console.log('Gameplay goldens passed: '+fixture.cases.length+' cases, '+checkedMoves+' valid moves, '+checkedResumes+' replay resumes, '+fixture.selectionCases.length+' deterministic selections, '+fixture.rejectionCases.length+' rejected attempts. C# gameplay execution is not implemented by this check.');
