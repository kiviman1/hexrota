/* The real application garden: permanent rewards are read, never replayed/spent. */
'use strict';
const assert=require('node:assert/strict');
const {mount,lifePool,plain,enter,move}=require('./check-lives-ui.cjs');
const {legacyClears}=require('./check-progression-ui.cjs');
const Garden=require('./dist/garden.js');
const config=require('./dist/economy-config.js');
const PROFILE='hexrota-profile-v2';
const S=Object.freeze({entry:'#home-screen [data-nav="garden"]',screen:'#garden-screen',visual:'#garden-visual',milestones:'#garden-milestones',stars:'#garden-stars',title:'#garden-progress-title',copy:'#garden-progress-copy',back:'#garden-screen [data-nav="home"]'});
const tests=[];const test=(name,run)=>tests.push({name,run});
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const economyView=f=>plain(f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG).view(f.save().economy));
function auditFields(raw){
 return plain({economy:raw.game.economy,energy:raw.energy,boards:raw.game.boards,attempts:raw.game.attempts||{},variantSelection:raw.game.variantSelection,current:raw.game.current,done:raw.game.done,attemptStats:raw.game.attemptStats||{},rescue:raw.game.rescue||null});
}
function pendingEvidence(count,{verified=[]}={}){
 const saved=legacyClears(count);for(let index=0;index<count;index++)if(!verified.includes(index+1))delete saved.boards[index+2];return saved;
}
function assertGarden(f){
 const view=economyView(f),description=Garden.describe(view),svg=f.node(S.visual+' svg');
 assert.equal(f.d.body.dataset.screen,'garden');assert.equal(f.node(S.screen).hidden,false);assert.equal(f.node(S.screen).inert,false);
 assert.equal(+f.node(S.stars).textContent,view.stars,'garden stars come from committed economy');
 assert.equal(svg.getAttribute('role'),'img');assert.equal(svg.getAttribute('aria-label'),description.accessibleLabel);
 assert.equal(f.node(S.title).textContent,description.title);assert.equal(f.node(S.copy).textContent,description.summary);
 assert(svg.querySelector('[data-garden-layer="soil"]'),'empty garden retains starter soil');
 const rows=[...f.node(S.milestones).querySelectorAll('[data-garden-milestone]')];assert.equal(rows.length,view.botanical.length);
 for(const milestone of view.botanical){
  const row=rows.find(node=>node.dataset.gardenMilestone===milestone.id),label=description.milestones.find(entry=>entry.id===milestone.id).label;
  assert(row,milestone.id+' has a read-only milestone row');assert.equal(row.dataset.unlocked,String(milestone.unlocked));assert(row.textContent.includes(label));assert(row.textContent.includes(String(milestone.stars)));
  assert.equal(!!svg.querySelector('[data-garden-layer="'+milestone.id+'"]'),milestone.unlocked,'actual SVG layer matches committed star threshold');
 }
 assert.equal(f.node(S.screen).querySelector('[data-stage],[data-level],[data-play],a[href*="level"],a[href*="stage"]'),null,'garden cannot replay a completed level');
 assert.equal([...f.d.querySelectorAll('[data-stage],[data-level]')].filter(node=>view.clearedLevelIds.includes(Number(node.getAttribute('data-stage')??node.getAttribute('data-level'))-1)).length,0,'cleared campaign controls do not return elsewhere');
 return {description,svg:f.node(S.visual).innerHTML,rows:f.node(S.milestones).innerHTML};
}

for(let stars=0;stars<=config.levelIds.length;stars++)test(stars+' verified legacy clears render the configured garden without spending or starting',()=>{
 let f=mount({saved:legacyClears(stars),life:lifePool(0)});try{
  assert.equal(economyView(f).stars,stars);const before=profile(f),events=plain(f.events());assert.equal(f.life().life.lives,0);
  assert.equal(f.node(S.entry).disabled,false,'garden is accessible at zero lives and before finishing the campaign');
  for(let repeat=0;repeat<3;repeat++){f.click(S.entry);assertGarden(f);f.click(S.back);}
  f.click(S.entry);const first=assertGarden(f);assert.deepEqual(auditFields(profile(f)),auditFields(before),'navigation leaves Gold, inventory, stars, lives, TEST wallet, Attempt ID series, board and RNG unchanged');assert.deepEqual(f.events(),events,'garden is not a level-start/completion event');assert.equal(f.network.length,0);
  const savedProfile=plain(profile(f));f.close();f=mount({profile:savedProfile});f.click(S.entry);const reloaded=assertGarden(f);
  assert.equal(reloaded.svg,first.svg,'same permanent stars recreate exactly the same SVG after reload');assert.equal(reloaded.rows,first.rows,'milestone rendering survives reload');assert.deepEqual(auditFields(profile(f)),auditFields(savedProfile),'reload cannot generate botanical Gold, stars, gifts or attempts');
 }finally{f.close();}
});

test('opening the garden around a live real swap preserves the exact in-flight attempt',async()=>{
 const f=mount({saved:legacyClears(6),life:lifePool(3)});try{
  await enter(f);await move(f,plain(f.game().level.solution[0]));f.click('#game-home');const before=profile(f),events=plain(f.events());
  assert(before.game.boards[before.game.current].history.length>0,'there is an actual played board/RNG to protect');
  f.click(S.entry);assertGarden(f);f.click(S.back);f.click(S.entry);assertGarden(f);
  assert.deepEqual(auditFields(profile(f)),auditFields(before));assert.deepEqual(f.events(),events);assert.equal(f.network.length,0);
 }finally{f.close();}
});

test('fully cleared campaign offers the garden and no old playable level',()=>{
 const f=mount({saved:legacyClears(10),life:lifePool(0)});try{
  const before=profile(f);assert.match(f.node('#home-play-label').textContent,/Bahçeni gör/i);f.click('#home-play');const rendered=assertGarden(f);
  assert.equal(rendered.description.complete,true);assert.equal(rendered.description.next,null);assert.match(f.node(S.screen).textContent,/Yeni bölümler yakında/i);
  assert.equal([...f.d.querySelectorAll('[data-stage],[data-level]')].filter(node=>Number(node.getAttribute('data-stage')??node.getAttribute('data-level'))>=2).length,0);
  assert.deepEqual(auditFields(profile(f)),auditFields(before));assert(!f.node('#pregame-dialog').open);
 }finally{f.close();}
});

for(const [count,verified]of [[10,[]],[3,[1,3]]])test('pending legacy review draws only '+verified.length+' claimed stars, not '+count+' closed levels',()=>{
 let f=mount({saved:pendingEvidence(count,{verified}),life:lifePool(0)});try{
  const before=profile(f),view=economyView(f);assert.equal(view.stars,verified.length);assert.equal(view.clearedLevelIds.length,count);assert.equal(view.pendingReviewLevelIds.length,count-verified.length);
  assert.equal(f.node('#progression-notice').hidden,false);f.click(S.entry);const first=assertGarden(f);assert.equal(first.description.stars,verified.length);assert.deepEqual(auditFields(profile(f)),auditFields(before));
  const savedProfile=plain(profile(f));f.close();f=mount({profile:savedProfile});f.click(S.entry);assert.equal(assertGarden(f).svg,first.svg);assert.deepEqual(auditFields(profile(f)),auditFields(savedProfile));
 }finally{f.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}console.log('Garden UI passed: '+tests.length+' actual application groups, all eleven star states, saved/reloaded progression, zero-life access, live-board invariants and pending legacy review.');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={S,auditFields,pendingEvidence,assertGarden};
