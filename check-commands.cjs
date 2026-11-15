'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildSuite,plain}=require('./lib/command-scenarios.cjs'),suite=buildSuite(),{runtime,expected}=suite,{Game,Engine}=runtime;
const counts={validSwaps:0,brushes:0,keyChanges:0,keyWithoutImmediateMatch:0,keyWithMatch:0,keyCascades:0,rescues:0,duplicates:0,rejections:0,previews:0,resumes:0};
for(let c=0;c<suite.fixture.cases.length;c++){
 const entry=suite.fixture.cases[c],output=expected[c];
 if(output.error){assert(entry.name.startsWith('missing-')||entry.name.startsWith('forged-')||entry.name==='unknown-checkpoint-field',entry.name+' expected constructor rejection');continue;}
 let before=output.initial;
 for(let i=0;i<entry.steps.length;i++){
  const step=entry.steps[i],actual=output.steps[i],result=actual.result,after=actual.after,old=before.snapshot,next=after.snapshot;
  if(step.op==='apply'){
   if(!result.ok){assert.deepEqual(after,before,entry.name+' rejected command is atomic');counts.rejections++;}
   else if(result.duplicate){assert.deepEqual(after,before,entry.name+' repeated command changes nothing');counts.duplicates++;}
   else{
    assert.equal(next.commands.length,old.commands.length+1);assert.equal(next.turn,next.history.length);
    assert.equal(next.movesLeft,suite.fixture.levels[entry.level].moves+next.bonusMoves-next.turn,'new checkpoint accounting');
    assert.equal(next.score-old.score,result.scoreGain);
    if(step.command.type==='swap'){assert.equal(next.turn,old.turn+1);assert.equal(next.movesLeft,old.movesLeft-1);counts.validSwaps++;}
    else if(step.command.type==='green_brush'){
     for(const key of ['values','rngState','movesLeft','score','turn','history'])assert.deepEqual(next[key],old[key],'brush preserves '+key);
     const layers=old.layers.slice();layers[step.command.index]--;assert.deepEqual(next.layers,layers);assert.equal(result.layersRemoved,1);assert.equal(result.scoreGain,0);assert.deepEqual(result.frames,[]);counts.brushes++;
    }else if(step.command.type==='color_key'){
     assert.equal(next.movesLeft,old.movesLeft);assert.equal(next.turn,old.turn);assert.deepEqual(next.history,old.history);
     assert.equal(result.scoreGain,result.frames.reduce((sum,frame)=>sum+frame.scoreGain,0));
     for(const frame of result.frames){assert.deepEqual(frame.matched.slice().sort((a,b)=>a-b),frame.matched);assert.equal(frame.scoreGain,frame.matched.reduce((sum,index)=>sum+frame.before[index],0));}
     counts.keyChanges++;if(result.frames.length){counts.keyWithMatch++;if(result.frames.length>1)counts.keyCascades++;}else{assert.equal(result.scoreGain,0);counts.keyWithoutImmediateMatch++;}
    }else if(step.command.type==='grant_moves'){
     for(const key of ['values','layers','rngState','score','turn','history','attemptId','levelId'])assert.deepEqual(next[key],old[key],'rescue preserves '+key);
     assert.equal(before.status,'lost');assert.equal(next.movesLeft,old.movesLeft+5);assert.equal(next.usage.rescue,1);assert.equal(next.bonusMoves,5);counts.rescues++;
    }
   }
  }else if(step.op==='preview'){assert.deepEqual(after,before);counts.previews++;}
  else if(step.op==='resume'){assert.deepEqual(after,before,entry.name+' restore/rejected restore preserves complete state');counts.resumes++;}
  before=after;
 }
 if(entry.name.startsWith('certified-'))assert.equal(before.status,'won','all 80 normal routes remain wins');
}
assert.equal(suite.fixture.counts.certifiedRoutes,80);for(const key of ['brushes','keyWithMatch','keyWithoutImmediateMatch','keyCascades','rescues','duplicates','rejections'])assert(counts[key]>0,key+' covered');
const sample=suite.fixture.levels['L1-v1'],attemptId='mutation-test',game=new Game(sample,{attemptId});
const command={id:'brush',type:'green_brush',index:0},before=plain(game.snapshot()),result=game.apply(command),valid=plain(game.snapshot());
result.usage.greenBrush=99;result.frames.push('mutated');const snap=game.snapshot();snap.commands.push({});snap.layers[0]=99;
assert.deepEqual(plain(game.snapshot()),valid,'result and snapshot outputs do not share internal state');
assert.throws(()=>game.classicSnapshot(),'assisted state never masquerades as v4');assert.throws(()=>new Engine(sample,plain(game.snapshot())),'classic strict reader does not accept the new contract');
assert.throws(()=>new Game(sample,{attemptId,limits:null}),'explicit invalid JS limits reject');
const restored=new Game(sample,{attemptId},plain(game.snapshot()));assert.deepEqual(plain(restored.apply(command)),{...plain(game.apply(command)),duplicate:true},'idempotence survives command replay');
const hintBefore=plain(game.snapshot()),hint=game.hint({maxNodes:32,maxDepth:2,beamWidth:8});assert.deepEqual(plain(game.snapshot()),hintBefore,'assisted hint does not mutate state/RNG');if(hint)assert.notEqual(hint.source,'proven_route','authored swap-only routes never label assisted board proven');
const brushWin=expected[suite.fixture.cases.findIndex(row=>row.name==='brush-wins-without-points')];assert.equal(brushWin.steps[0].after.status,'won');assert.equal(brushWin.steps[0].after.snapshot.score,0);
const keyWin=expected[suite.fixture.cases.findIndex(row=>row.name==='key-wins-with-real-match')];assert.equal(keyWin.steps[1].after.status,'won');assert(keyWin.steps[1].result.scoreGain>=3);
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/command-vectors.json'),'utf8'));assert.deepEqual(suite.fixture,frozen,'frozen complete-output SHA256 detects command drift');
const protectedFiles=['dist/engine.js','unity/Gameplay/HexMatch.cs','unity/Gameplay/GameplayTypes.cs','unity/Gameplay/BoardTopology.cs'];
for(const file of protectedFiles){const fingerprint=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex');assert.equal(fingerprint,require('./fixtures/command-core-hashes.json')[file],file+' classic source remains unchanged');}
console.log('Command mechanics passed: '+JSON.stringify({...suite.fixture.counts,...counts,cases:expected.length,outputMutationChecks:2,assistedHintChecks:1,classicSourceHashes:protectedFiles.length}));
