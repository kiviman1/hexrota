const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=__dirname+'/dist/';
const errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function mount(state){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 if(state)w.localStorage.setItem('hexrota-v1',state);
 for(const f of ['levels.js','engine.js','app.js'])w.eval(fs.readFileSync(root+f,'utf8'));
 return dom;
}
function click(w,selector){const n=w.document.querySelector(selector);assert(n,selector+' exists');n.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));}
function enter(w,i){click(w,`#board [data-index="${i}"]`);}
(async()=>{
 const dom=mount(),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.level-button').length,10);
 assert.equal(d.querySelectorAll('.level-button:disabled').length,9);
 click(w,'#hint');assert.equal(d.querySelectorAll('.hinted').length,1);
 const first=w.HEX_LEVELS[0].solution[0];
 enter(w,first);assert.equal(+d.getElementById('sum').textContent,2);
 enter(w,first);assert.equal(+d.getElementById('sum').textContent,2,'used cell rejected');
 click(w,'#undo');assert.equal(+d.getElementById('sum').textContent,0);
 click(w,'#help');assert(d.getElementById('help-dialog').open);click(w,'#help-dialog [data-close]');assert(!d.getElementById('help-dialog').open);
 // Pointerdown supports mouse/touch. Blur must terminate an in-progress drag.
 const down=new w.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(down,{button:0,pointerType:'touch',pointerId:1});
 d.querySelector(`#board [data-index="${first}"]`).dispatchEvent(down);
 assert.equal(+d.getElementById('sum').textContent,2);
 w.dispatchEvent(new w.Event('blur'));click(w,'#reset');assert.equal(+d.getElementById('sum').textContent,0);
 // All ten levels through the rendered UI, including automatic unlock and Next.
 for(let n=0;n<10;n++){
  const l=w.HEX_LEVELS[n];assert.equal(d.getElementById('level-name').textContent,l.name);
  for(const i of l.solution)enter(w,i);
  assert.equal(+d.getElementById('sum').textContent,l.target,'target '+n);
  assert.equal(d.querySelectorAll('.hex-tile.visited').length,l.cells.length,'coverage '+n);
  await wait(580);
  assert(d.getElementById('win-dialog').open,'victory '+n);
  assert.equal(d.getElementById('win-total').textContent,String(l.target));
  assert.equal(d.getElementById('completed').textContent,`${n+1} / 10`);
  if(n<9)click(w,'#next');
 }
 const state=w.localStorage.getItem('hexrota-v1');assert.equal(JSON.parse(state).done.length,10);
 const restore=mount(state),rd=restore.window.document;
 assert.equal(rd.getElementById('completed').textContent,'10 / 10');
 assert.equal(rd.querySelectorAll('.level-button:disabled').length,0);
 assert.equal(rd.getElementById('sum').textContent,'125');
 assert.equal(rd.getElementById('continue').hidden,false);
 click(restore.window,'#continue');assert(rd.getElementById('win-dialog').open);
 click(restore.window,'#review');assert(!rd.getElementById('win-dialog').open);
 click(restore.window,'#reset');assert.equal(rd.getElementById('sum').textContent,'0');
 assert.equal(errors.length,0,errors.join('\n'));
 dom.window.close();restore.window.close();
 console.log('UI DOM checks passed: 10 levels, exact scores, coverage, unlock, victory/Next, hint, help, pointer input, undo/reset and persistence.');
})().catch(e=>{console.error(e);process.exit(1)});
