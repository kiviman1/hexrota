const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=__dirname+'/dist/';
const errors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(root+'test.html','utf8'),{url:'https://hexrota.example/test.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
const campaign=JSON.stringify({current:6,done:[0,1,2,3,4,5],boards:{6:{marker:'must stay untouched'}},sound:true});
w.localStorage.setItem('hexrota-match-v3',campaign);
for(const f of ['engine.js','levels.js','test.js'])w.eval(fs.readFileSync(root+f,'utf8'));
const click=id=>{const e=d.getElementById(id);assert(e,id+' exists');e.click();};
const tile=i=>d.querySelector(`[data-index="${i}"]`);
const nums=()=>[...d.querySelectorAll('.tile-number')].map(e=>+e.textContent);
const copy=object=>JSON.parse(JSON.stringify(object));
function fixture(name){
 const base=w.HEX_LEVELS[0],specials=base.cells.map(()=>null);specials[9]=name==='sprout'?'sprout':'ring';if(name==='together')specials[14]='sprout';
 const game=new w.HexMatch({...base,id:'sandbox',initialSpecials:specials,powers:['ring','sprout'],moves:Infinity,target:Infinity,solution:[]});
 if(name==='sprout'){game.layers.fill(0);for(const i of [16,18,17])game.layers[i]=1;}
 return game;
}
function assertGame(game,label){
 assert.deepEqual(nums(),Array.from(game.values),label+' values');
 assert.equal(+d.getElementById('score').textContent,game.score,label+' score');
 assert.equal(+d.getElementById('turn').textContent,game.turn,label+' turn');
 assert.equal(d.getElementById('covered').textContent,`${game.covered} / ${game.total}`,label+' ground');
 for(let i=0;i<game.total;i++){
  assert.equal(tile(i).classList.contains('power-ring'),game.specials[i]==='ring',label+' ring '+i);
  assert.equal(tile(i).classList.contains('power-sprout'),game.specials[i]==='sprout',label+' sprout '+i);
 }
 assert.equal(game.status,'playing','test never wins/loses');assert.equal(game.movesLeft,Infinity,'unlimited sandbox');
}
for(const name of ['ring','sprout','together']){
 click('scenario-'+name);const game=fixture(name);assert.equal(game.findMatches().length,0);
 assertGame(game,name+' ready');assert(tile(9).classList.contains('selected'));
 assert(d.querySelectorAll('.planned').length>=4,'ready swap has exact power preview');
 const result=game.swap(9,14);assert(result.ok);click('activate');assertGame(game,name+' after CTA');
 assert.equal(+d.getElementById('turn').textContent,1,'one CTA = one actual engine turn');
 const count=new Set(result.frames[0].activated.flatMap(e=>e.affected)).size;
 assert.equal(d.querySelectorAll('.effect-hit').length,count,'affected cells remain visible');
 assert(d.getElementById('status').textContent.includes(count+' hücreye özel etki'));
 assert(d.getElementById('effect-overlay').children.length>0,'actual effect stays inspectable');
 click('reset');assertGame(fixture(name),name+' reset');
 click('activate');click('activate');assertGame(fixture(name),name+' CTA reset');
 assert.equal(w.localStorage.getItem('hexrota-match-v3'),campaign,'campaign unchanged');
}
// Normal manual taps work without drag and do not toggle away the ready special.
click('scenario-ring');tile(9).click();tile(14).click();const manual=fixture('ring');manual.swap(9,14);assertGame(manual,'manual neighbor taps');
// Free placement makes a real special, then the primary action uses the same rules.
click('reset');click('tool-sprout');tile(4).click();assert(tile(4).classList.contains('power-sprout'));
assert.equal(d.getElementById('tool-play').getAttribute('aria-pressed'),'true','placement returns to playing');
assert.equal(d.getElementById('activate').textContent,'Filizi çalıştır');
const placed=fixture('ring');placed.specials[4]='sprout';placed.swap(4,placed.neighbors[4][0]);click('activate');assertGame(placed,'placed Filiz');
click('reset');click('tool-erase');tile(9).click();assert(!tile(9).classList.contains('has-power'));assert.equal(+d.getElementById('turn').textContent,0,'editing costs no turn');
// Drag invokes one swap and suppresses the browser's following click.
click('scenario-ring');let hit=tile(14);d.elementFromPoint=()=>hit;
function pointer(type,index,x,y){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:2,pointerType:'touch',button:0,isPrimary:true,clientX:x,clientY:y});(type==='pointerdown'?tile(index):d.getElementById('sandbox-board')).dispatchEvent(e);}
pointer('pointerdown',9,40,40);pointer('pointerup',14,70,70);tile(14).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assertGame(manual,'single drag turn');
// Captured pointerup targets the stable board: taps must not rely on native click retargeting.
click('scenario-ring');hit=tile(14);pointer('pointerdown',14,50,50);pointer('pointerup',14,60,50);tile(14).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assertGame(manual,'captured jitter tap, exactly one turn');
click('reset');click('tool-sprout');hit=tile(4);pointer('pointerdown',4,50,50);pointer('pointerup',4,50,50);tile(4).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert(tile(4).classList.contains('power-sprout'),'real pointer tap places a special');assert.equal(+d.getElementById('turn').textContent,0);
assert.equal(w.localStorage.length,1,'sandbox creates no storage');assert.equal(w.localStorage.getItem('hexrota-match-v3'),campaign);
assert.equal(errors.length,0,errors.join('\n'));dom.window.close();
console.log('Sandbox checks passed: 3 ready cases, one-click activation, persistent effect footprint, exact engine state, manual taps/drag, placement/reset, unlimited play and campaign isolation.');
