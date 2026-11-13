import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','tutorials.js'])vm.runInContext(fs.readFileSync(new URL('dist/'+file,import.meta.url),'utf8'),context);
const {HexMatch,HEX_TUTORIALS}=context.window;
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(HEX_TUTORIALS.length,2);
for(const [index,level] of HEX_TUTORIALS.entries()){
  assert.equal(level.id,`learn-${index+1}`);assert.equal(level.kind,'tutorial');
  assert.equal(level.rulesVersion,'classic-v4');assert(level.cells.length<=9,'small boards remain readable');
  assert.equal(level.cells.length,level.initial.length);assert.equal(level.solution.length,level.steps.length);
  assert.equal(level.moves,level.solution.length+2,'two forgiving moves beyond the guided route');
  assert.equal(new Set(level.cells.map(c=>`${c.q},${c.r}`)).size,level.cells.length);
  assert(level.title&&level.objective&&level.subtitle);
  assert(!('powers' in level));assert(!('initialSpecials' in level));
  const game=new HexMatch(level),hitWaves=level.cells.map(()=>0);
  assert.equal(game.findMatches().length,0,'no automatic opening matches');assert(game.legalMoves().length>=1);
  const seen=new Set([0]),queue=[0];while(queue.length){const i=queue.shift();for(const j of game.neighbors[i])if(!seen.has(j)){seen.add(j);queue.push(j);}}
  assert.equal(seen.size,level.cells.length,'all tutorial tiles connect');
  let naturalCascade=false;
  for(const [stepIndex,step] of level.steps.entries()){
    assert.deepEqual(plain(step.pair),plain(level.solution[stepIndex]));
    assert(game.adjacent(...step.pair),'each guided gesture exchanges neighbors');
    assert(step.text.length>0&&step.text.length<180);assert(step.afterText.length>0&&step.afterText.length<180);
    assert(['swap','ground','goal','chain'].includes(step.focus));
    const before=game.snapshot(),result=game.swap(...step.pair);
    assert(result.ok,'every instructed swap works');assert.equal(game.movesLeft,before.movesLeft-1);
    assert.equal(result.reshuffled,false,'teaching never depends on an unexplained board shuffle');
    assert.equal(game.findMatches().length,0,'each instructed turn settles');
    assert.equal(game.score,step.expected.score);assert.equal(game.covered,step.expected.covered);
    assert.equal(result.frames.length,step.expected.waves);
    assert.deepEqual(plain(result.frames[0].matched),plain(step.matchIndices));
    for(const [waveIndex,frame] of result.frames.entries()){
      assert.equal(new Set(frame.matched).size,frame.matched.length);
      for(const cell of frame.matched)hitWaves[cell]++;
      if(waveIndex>0&&game.findMatches(result.frames[waveIndex-1].compacted).length>0)naturalCascade=true;
    }
    assert.equal(game.status,stepIndex===level.steps.length-1?'won':'playing');
    assert.deepEqual(plain(new HexMatch(level,game.snapshot()).snapshot()),plain(game.snapshot()),'guided progress can be restored');
  }
  assert.equal(game.covered,level.cells.length);assert(game.score>=level.target);
  assert.equal(game.status,'won');
  if(index===0){
    assert(level.cells.every(c=>c.layers===1));
    assert(level.steps.every(s=>s.expected.waves===1),'first lesson isolates swapping and ground');
  }else{
    const double=level.cells.map((c,i)=>c.layers===2?i:-1).filter(i=>i>=0);
    assert.equal(double.length,2);assert(double.every(i=>hitWaves[i]>=2),'two-layer floors are hit in separate waves');
    assert(naturalCascade,'the second lesson includes a genuine survivor gravity chain');
    assert(level.steps.at(-2).expected.score>=level.target,'score is reached before the floor');
    assert(level.steps.at(-2).expected.covered<level.cells.length,'both win conditions are taught independently');
  }
  console.log(`✓ Tutorial ${index+1}: ${level.cells.length} tiles, ${level.solution.length} guided swaps, target ${level.target}, final ${game.score}; no reshuffles.`);
}
console.log('Two playable tutorials pass guided steps, exact feedback, two-layer floors, natural cascade, both goals and checkpoint validation.');
