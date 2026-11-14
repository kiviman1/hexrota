/* Capability and hidden-state independence tests for observable player policies. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {HexMatch,HEX_LEVELS,asLevel}=require('./lib/level-analysis.cjs');
const Player=require('./lib/observable-player.cjs');
const pack=JSON.parse(fs.readFileSync(__dirname+'/dist/variants.json','utf8'));
const plain=value=>JSON.parse(JSON.stringify(value)),pairKey=p=>p.slice().sort((a,b)=>a-b).join(':');
const forbidden=['rngState','seed','initial','solution','solutions','alternativeSolutions','history','clone','snapshot','_random'];
function deny(object,names){for(const name of names)Object.defineProperty(object,name,{get(){throw Error('Hidden information read: '+name);},configurable:true});return object;}
const choices=new Map(Player.POLICIES.map(policy=>[policy,new Set()]));
let positions=0,comparisons=0,syntheticDecisions=0;
for(const entry of pack.levels){
 const base=HEX_LEVELS.find(l=>l.id===entry.levelId);
 for(const variant of entry.variants){
  const level=asLevel(base,variant),start=new HexMatch(level),mid=new HexMatch(level);mid.swap(...variant.solutions[0][0]);
  for(const game of [start,mid]){
   positions++;const visible=Player.visibleState(game),before=plain(visible);
   const options=Player.visibleOptions(visible);assert.deepEqual(options.map(o=>pairKey(o.pair)).sort(),game.legalMoves().map(pairKey).sort(),'visible topology recognizes every legal swap');
   for(const option of options){const outcome=game.clone().swap(...option.pair),first=outcome.frames[0];assert.deepEqual(option.matched,plain(first.matched),'visible first wave agrees with actual match indices');assert.equal(option.scoreGain,first.scoreGain,'first-wave score uses only visible matched values');assert.equal(option.layerGain,first.matched.filter(i=>game.layers[i]>0).length,'first-wave ground gain counts current non-green layers');assert.equal(option.greenGain,first.matched.filter(i=>game.layers[i]===1).length,'first-wave newly green count is exact');}
   const poisonedGame=Object.create(game);Object.defineProperty(poisonedGame,'level',{value:new Proxy(game.level,{get(target,key){if(forbidden.includes(key))throw Error('Private level metadata read: '+key);return target[key];}})});deny(poisonedGame,forbidden);
   assert.deepEqual(Player.visibleState(poisonedGame),visible,'projection never uses clone/snapshot/RNG/history/initial/solutions');
   for(const seed of [1,0xdeadbeef])for(const policy of Player.POLICIES){
    const options={policy,seed,samples:2,depth:2},expected=Player.choose(visible,options);assert(expected,'valid board gets a choice');
    assert(game.legalMoves().some(p=>pairKey(p)===pairKey(expected.pair)),'visible recognition agrees with real legal swaps');
    assert.deepEqual(Player.choose(deny({...visible},forbidden),options),expected,'poisoned hidden fields are inaccessible');
    for(const hidden of [1,0x2468ace1,0xffffffff]){
     const changed=game.clone();changed.rngState=hidden;
     changed.level={...game.level,seed:hidden,initial:game.values.map(()=>1),solution:[[999,998]],alternativeSolutions:[],solutions:[]};
     assert.deepEqual(Player.choose(Player.visibleState(changed),options),expected,'same visible information and decision seed ignore changed hidden state');comparisons++;
    }
    assert.deepEqual(visible,before,'a policy never mutates its visible DTO');
    choices.get(policy).add(pairKey(expected.pair));if(policy==='sampled')syntheticDecisions++;
   }
  }
 }
}
for(const [policy,pairs]of choices)assert(pairs.size>10,policy+' responds to meaningful board variation rather than returning a fixed action');
const state=Player.visibleState(new HexMatch(asLevel(HEX_LEVELS[0],pack.levels[0].variants[0])));
assert.equal(Player.choose({...state,movesLeft:0}),null,'terminal budget has no recommendation');
for(const policy of Player.POLICIES){
 assert.equal(Player.choose({...state,layers:state.layers.map(()=>0),score:state.target},{policy}),null,'already won visible board has no recommendation');
 assert.equal(Player.choose({...state,targetMode:'exact',score:state.target+1},{policy}),null,'exact target overshoot has no recommendation');
 assert(Player.choose({...state,layers:state.layers.map(()=>0),score:state.target-1},{policy}),'green ground still permits completing the score target');
}
assert.throws(()=>Player.choose(state,{policy:'answer_key'}),/Invalid/);
assert.throws(()=>Player.choose(state,{seed:-1}),/Invalid/);
assert.throws(()=>Player.choose(state,{policy:'sampled',samples:0}),/Invalid/);
const clone=plain(state);clone.cells[0]=clone.cells[1];assert.throws(()=>Player.choose(clone),/Invalid visible/);
console.log(`Observable information checks passed: ${positions} real start/midgame boards, ${comparisons} hidden-RNG comparisons, ${syntheticDecisions} sampled decisions, poisoned private access and immutable inputs. No human win-rate claim.`);
