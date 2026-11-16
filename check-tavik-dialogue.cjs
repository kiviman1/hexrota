/* Tavik's dialogue has no authority over actual gameplay or progress. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(__dirname+'/dist/tavik-dialogue.js','utf8');
assert(!/\b(HexMatch|HexEconomy|HexLives|localStorage|sessionStorage|fetch|sendBeacon|Math\.random)\b/.test(source));
async function test(){
 const dom=new JSDOM('<!doctype html><body><section id="coach"><div class="coach-copy">Öğren</div></section><svg id="board"><g data-index="0"/></svg></body>',{url:'https://hexrota.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.eval(source);const coach=w.document.getElementById('coach'),board=w.document.getElementById('board'),before=board.outerHTML;
 const x=w.HexTavikDialogue.create({document:w.document,window:w,coach,reducedMotion:()=>false});
 assert.equal(x.snapshot().visible,false);
 x.update({visible:true,levelId:'learn-1',step:0});assert.equal(x.snapshot().visible,true);
 assert.equal(coach.dataset.tavikDialogue,'true');assert(x.snapshot().pose.includes('/call.webp'));
 x.update({visible:true,levelId:'learn-1',step:1,feedback:true});assert.equal(coach.querySelector('.hx-tavik-dialogue').dataset.mood,'happy');
 x.update({visible:false,levelId:'other'});assert.equal(x.snapshot().visible,false);
 x.destroy();assert.equal(coach.querySelector('.hx-tavik-dialogue'),null);assert.equal(board.outerHTML,before);dom.window.close();
 const slow=new JSDOM('<!doctype html><body><div id="coach"></div></body>',{url:'https://hexrota.test/',runScripts:'outside-only'});
 slow.window.eval(source);const y=slow.window.HexTavikDialogue.create({document:slow.window.document,window:slow.window,coach:slow.window.document.getElementById('coach'),reducedMotion:()=>true});
 y.update({visible:true,levelId:'learn-2',step:0});assert.equal(y.snapshot().speaking,false);y.destroy();slow.window.close();
 console.log('PASS Tavik tutorial portrait: animation, reaction, reduced motion, cleanup and immutable board');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
