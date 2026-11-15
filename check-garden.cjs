'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Garden=require('./dist/garden.js'),Economy=require('./dist/economy.js'),config=require('./dist/economy-config.js'),manager=Economy.createManager(config);
const clone=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const entry of Object.values(value))freeze(entry);}return value;}
let state=manager.createState(),renders=0,milestoneChecks=0;const outputs=[];
for(let stars=0;stars<=config.levelIds.length;stars++){
 const view=freeze(manager.view(state)),before=JSON.stringify(view),description=Garden.describe(view),svg=Garden.markup(view);
 assert.equal(description.stars,stars);assert.equal(description.maxStars,config.botanical.at(-1).stars);
 assert.deepEqual(description.unlockedIds,view.botanical.filter(entry=>entry.unlocked).map(entry=>entry.id));
 assert.equal(description.complete,view.botanical.every(entry=>entry.unlocked));assert.equal(description.tier,description.unlockedIds.at(-1)||'soil');
 assert.equal(JSON.stringify(view),before,'describing/rendering cannot mutate frozen economy view');
 for(let repeat=0;repeat<5;repeat++){assert.equal(Garden.markup(view),svg);assert.deepEqual(Garden.describe(view),description);renders++;}
 const document=new JSDOM(svg).window.document,node=document.querySelector('svg');assert(node);assert.equal(document.querySelector('parsererror'),null);assert.equal(node.getAttribute('viewBox'),'0 0 640 400');assert.equal(node.getAttribute('role'),'img');assert.equal(node.getAttribute('aria-label'),description.accessibleLabel);assert(node.querySelector('title').textContent);assert(node.querySelector('desc').textContent);
 assert(node.querySelector('[data-garden-layer="soil"]'),'starter soil always exists, including zero stars');
 for(const entry of view.botanical){assert.equal(!!node.querySelector('[data-garden-layer="'+entry.id+'"]'),entry.unlocked);milestoneChecks++;}
 assert.equal(document.querySelector('a,button,input,script,foreignObject,image,animate,animateTransform,iframe'),null,'garden contains no actions, scripts, external assets or animation');
 for(const element of document.querySelectorAll('*'))for(const attr of element.attributes){assert(!/^on/i.test(attr.name),'no event attributes');assert(!/^(data-stage|data-play|href|xlink:href)/i.test(attr.name),'no replay or network attributes');}
 assert(!/data-stage|data-play|https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg','')));
 assert.equal(description.next===null,description.complete);if(description.next)assert.equal(description.next.remaining,description.next.stars-stars);
 description.unlockedIds.push('mutation');description.milestones[0].label='mutation';assert.notEqual(Garden.describe(view).milestones[0].label,'mutation','description output is independent');
 outputs.push(svg);
 if(stars<config.levelIds.length){const result=manager.complete(state,{levelId:config.levelIds[stars],attemptId:'garden-test:'+stars,status:'won',verified:true});assert(result.applied);state=result.state;}
}
assert.equal(state.stars,10);assert.equal(state.gold,200);assert(manager.view(state).botanical.every(entry=>entry.unlocked));
assert.equal(new Set(outputs).size,outputs.length,'accessible progress text tracks each star even between visual tiers');
const good=manager.view(manager.createState()),bad=[null,[],{},true,{...good,stars:'0'},{...good,stars:-1},{...good,stars:.5},{...good,stars:11},{...good,botanical:[]},{...good,botanical:good.botanical.slice().reverse()}];
for(const [field,value]of [['id','<script>'],['stars',0],['stars','2'],['unlocked',1],['unlocked',true]]){const candidate=clone(good);candidate.botanical[0][field]=value;bad.push(candidate);}
const extra=clone(good);extra.botanical[0].extra=true;bad.push(extra);const duplicate=clone(good);duplicate.botanical[1].stars=duplicate.botanical[0].stars;bad.push(duplicate);
for(const input of bad)for(const method of ['describe','markup'])assert.throws(()=>Garden[method](input),{code:'invalid_botanical_view'});
// The renderer consumes thresholds already computed by Economy.view; it has no
// second hard-coded numeric threshold table. This synthetic view checks that seam.
const shifted={stars:4,botanical:config.botanical.map((entry,index)=>({id:entry.id,stars:entry.stars+1,unlocked:4>=entry.stars+1}))};
assert.deepEqual(Garden.describe(shifted).unlockedIds,['flowers']);assert.equal(Garden.describe(shifted).next.stars,config.botanical[1].stars+1);
const moduleSource=fs.readFileSync(path.join(__dirname,'dist/garden.js'),'utf8');
const sandbox={window:{},localStorage:new Proxy({}, {get(){throw Error('Garden accessed storage');}}),fetch(){throw Error('Garden accessed network');},Date:class {constructor(){throw Error('Garden accessed clock');}static now(){throw Error('Garden accessed clock');}},Math:new Proxy(Math,{get(target,key){if(key==='random')throw Error('Garden accessed RNG');return target[key];}})};
vm.createContext(sandbox);vm.runInContext(moduleSource,sandbox);assert.equal(sandbox.window.HexGarden.markup(good),Garden.markup(good),'browser UMD matches CommonJS with storage/network/clock/RNG forbidden');
console.log('Botanical presentation passed: '+JSON.stringify({starStates:11,deterministicRenders:renders,milestoneChecks,malformedViews:bad.length,allCleared:true,isolatedBrowser:true,externalThresholdSource:true}));
