/* Regression evidence for the maintenance refactor. Goldens were captured from
 * 7deb686's original closures before extraction, not from these new modules. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {createStore}=require('./dist/session-store.js');
const Save=require('./dist/game-save.js'),View=require('./dist/board-view.js'),Input=require('./dist/board-input.js');
const {mount}=require('./check-lives-ui.cjs');
const PK='hexrota-profile-v2',GK='hexrota-match-v5',LK='hexrota-lives-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
function memory(initial={}){const values=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));let writes=0;return {values,get writes(){return writes;},getItem:k=>values.has(k)?values.get(k):null,setItem(k,v){writes++;values.set(k,String(v));}};}
let groups=0,assertions=0;function test(name,run){run();groups++;console.log('PASS '+name);}
const r={window:{},performance};vm.createContext(r);for(const f of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),r);
const {HEX_LEVELS,HEX_TUTORIALS,HEX_VARIANTS,HexMatch,HexAttempts}=r.window;
const levels=[...HEX_TUTORIALS,...HEX_LEVELS],tutorials=HEX_TUTORIALS;
const envelope=revision=>({schemaVersion:2,revision,game:{current:2},energy:{life:{lives:5}}});
test('revision exhaustion rejects before changing durable memory or storage',()=>{
 const s=memory({[PK]:envelope(Number.MAX_SAFE_INTEGER)}),store=createStore(s),before=store.current();
 assert.throws(()=>store.commit({},{}),/revision_exhausted/);assert.deepEqual(store.current(),before);assert.equal(s.writes,0);
});
test('commit validates both game/energy before writing an unloadable envelope',()=>{
 for(const bad of [null,undefined,[],false,0,'bad'])for(const side of [0,1]){
  const s=memory(),store=createStore(s),args=[{},{}];args[side]=bad;
  assert.throws(()=>store.commit(...args),/invalid_profile/);assert.equal(store.revision,0);assert.equal(store.current(),null);assert.equal(s.writes,0);assertions++;
 }
});
test('same-revision canonical corruption is not silently overwritten',()=>{
 for(const bad of [null,false,[],{...envelope(1),schemaVersion:99},{...envelope(1),game:null},{...envelope(1),energy:[]}]){
  const s=memory({[PK]:envelope(1)}),store=createStore(s),before=store.current();s.values.set(PK,JSON.stringify(bad));
  assert.throws(()=>store.commit({},{}),/invalid_profile/);assert.equal(s.getItem(PK),JSON.stringify(bad));assert.deepEqual(store.current(),before);assert.equal(s.writes,0);assertions++;
 }
});
test('present null inserted into an empty slot cannot masquerade as absence',()=>{
 const s=memory(),store=createStore(s);s.values.set(PK,'null');
 assert.throws(()=>store.commit({},{}),/invalid_profile/);assert.equal(s.getItem(PK),'null');assert.equal(s.writes,0);
});
test('contains distinguishes canonical mirrors, absent keys, and present null',()=>{
 const s=memory({[PK]:envelope(1),optional:null}),store=createStore(s);
 assert(store.contains(GK));assert(store.contains(LK));assert(store.contains('optional'));assert(!store.contains('absent'));
 const empty=createStore(memory());assert(!empty.contains(GK));
});
test('strict progression loading rejects present null, malformed or falsy new/legacy records',()=>{
 for(const key of [GK,...Save.LEGACY_KEYS])for(const bad of [null,false,0,[], 'corrupt']){
  const s=memory({[key]:bad}),store=createStore(s);
  assert.throws(()=>Save.load({read:store.read,contains:store.contains,levels,tutorials}),/invalid_game_save/);assert.equal(s.writes,0);assertions++;
 }
 const s=memory({[GK]:null,'hexrota-match-v4':{done:[0],boards:{}}}),store=createStore(s);
 assert.throws(()=>Save.load({read:store.read,contains:store.contains,levels,tutorials}),/invalid_game_save/);
 const broken=memory();broken.values.set(GK,'{not-json');
 assert.throws(()=>createStore(broken));assert.equal(broken.writes,0);
});
test('actual application boot refuses a present null game rather than writing defaults',()=>{
 assert.throws(()=>mount({saved:null}),/invalid/);
});
test('save normalization remains immutable and supports old indexed containers',()=>{
 const old={current:2,done:[1,0,1,999],preferences:{volume:2,motion:'unknown'},boards:[null,null,clone(new HexMatch(HEX_LEVELS[0]).snapshot())],attempts:{},records:{}};
 const before=clone(old),normalized=Save.normalize(old,levels,tutorials);
 assert.deepEqual(old,before);assert.deepEqual(normalized.done,[1,0]);assert.equal(normalized.preferences.volume,1);assert.equal(normalized.preferences.motion,'auto');assert(normalized.boards[2]);
 normalized.boards[2].values[0]=999;assert.deepEqual(old,before);
 const a=Save.defaults(),b=Save.defaults();a.preferences.music=true;assert.equal(b.preferences.music,false);
 const s=memory(),store=createStore(s);assert.deepEqual(Save.load({read:store.read,contains:store.contains,levels,tutorials}).saved,b);assert.equal(s.writes,0);
});
test('all 52 authored boards preserve exact pre-refactor SVG, geometry and reciprocal paths',()=>{
 const catalog=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch),fixture=require('./fixtures/presentation-maintenance.json');
 const boards=[...HEX_TUTORIALS.map((level,i)=>({id:'tutorial-'+i,level,tutorial:true})),...HEX_LEVELS.map(level=>({id:'original-'+level.id,level,tutorial:false})),...HEX_LEVELS.flatMap(l=>catalog.list(l.id).map(v=>({id:'variant-'+l.id+'-'+v,level:catalog.resolveLevel(l.id,v,catalog.currentVersion),tutorial:false})))];
 const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');assert.equal(boards.length,52);
 for(const [i,b]of boards.entries()){
  const old=fixture.boards[i],engine=new HexMatch(b.level),state=engine.snapshot(),layout=View.geometry(b.level,b.tutorial),unchanged=JSON.stringify({level:b.level,state});assert.equal(old.id,b.id);assert.equal(hash(layout),old.geometry);assertions++;
  const options=[{}, {selected:b.level.solution[0][0],hinted:b.level.solution[0],focusIndex:2}, {busy:true,matching:[0,1],falling:[2,3]}, {feedback:true}, {guided:b.tutorial?b.level.steps[0]:null}];
  for(const [j,o]of options.entries()){const markup=View.markup(b.level,state,layout,{...o,status:engine.status,selectedNeighbors:o.selected!=null?engine.neighbors[o.selected]:[]});assert.equal(hash(markup),old.views[j].hash,b.id+' '+old.views[j].name);assertions++;}
  assert.equal(JSON.stringify({level:b.level,state}),unchanged,'pure presentation did not mutate game inputs');engine.swap(...b.level.solution[0]);assert.equal(hash(View.markup(b.level,engine.snapshot(),layout,{status:engine.status})),old.views[5].hash);assertions++;
  for(const path of old.paths){assert.equal(hash(View.swapPaths(layout,...path.pair)),path.hash);assertions++;}
 }
});
test('pure swipe classifier preserves six axes, jitter, contradictory paths and bounds',()=>{
 const level=HEX_LEVELS[0],engine=new HexMatch(level),layout=View.geometry(level),source=engine.neighbors.findIndex(n=>n.length===6),p=layout.positions[source],viewport={width:1000,height:1000};
 const make=()=>({local:{x:p.x,y:p.y},x:500,y:500,maxDistance:0,target:null,conflicted:false,invalid:false,neighbors:engine.neighbors[source].map(index=>{const q=layout.positions[index],dx=q.x-p.x,dy=q.y-p.y;return{index,dx,dy,distance:Math.hypot(dx,dy),screenDistance:Math.hypot(dx,dy)};})});
 for(const n of make().neighbors){const g=make();Input.sample(g,{clientX:500+n.dx*.5,clientY:500+n.dy*.5},{x:p.x+n.dx*.5,y:p.y+n.dy*.5},viewport);assert.equal(g.target,n.index);Input.sample(g,{clientX:500,clientY:500},p,viewport);assert.equal(g.target,n.index);assert(!g.conflicted);assertions++;}
 const g=make();Input.sample(g,{clientX:502,clientY:503},{x:p.x+2,y:p.y+3},viewport);assert.equal(g.target,null);
 for(const n of g.neighbors.slice(0,2))Input.sample(g,{clientX:500+n.dx,clientY:500+n.dy},{x:p.x+n.dx,y:p.y+n.dy},viewport);assert(g.conflicted);
 const off=make();Input.sample(off,{clientX:-1,clientY:3},p,viewport);assert(off.invalid);
 for(let i=0;i<layout.positions.length;i++)assert.equal(Input.hitTest(layout.positions[i],layout,{a:1,b:0,c:0,d:1}),i);
});
console.log(JSON.stringify({groups,additionalAssertions:assertions,baseline:'7deb686e1f4cd79aedd9763522c381ff145d216d',physicalDevicesTested:false}));
