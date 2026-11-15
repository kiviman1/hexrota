/* Test fixtures load the actual attempt modules while preserving explicit legacy cases. */
'use strict';
const assert=require('node:assert/strict');
const key='hexrota-match-v5',lifeKey='hexrota-lives-v1',catalogs=new WeakMap();
// Regression/balance fixtures explicitly opt out of energy waits. Production defaults stay on.
function prepareLifeBypass(window,read){
 window.HexSessionTestMode={isolated:true};if(!window.HexSessionStore)window.eval(read('session-store.js'));
 // App integration fixtures use the same production economy modules as index.html; the life TEST wallet stays separate.
 for(const [file,globalName]of [['economy-config.js','HEX_ECONOMY_CONFIG'],['economy.js','HexEconomy'],['commands.js','HexCommands']])if(!window[globalName])window.eval(read(file));
 const dependencies=[['lives-config.js','HEX_LIVES_CONFIG'],['lives.js','HexLives'],['life-providers.js','HexLifePrototype']];
 for(const [file,globalName]of dependencies)if(!window[globalName])window.eval(read(file));
 assert(window.HexLives&&window.HEX_LIVES_CONFIG&&window.HexLifePrototype,'production life modules are loaded');
 if(window.localStorage.getItem(lifeKey)===null){
  const manager=window.HexLives.createManager(window.HEX_LIVES_CONFIG,{clock:()=>window.Date.now()});
  const life=manager.setDeveloperBypass(manager.createState(),true).state;
  const aggregate=window.HexLifePrototype.createState(life,{providerNamespace:'qa',gold:300,adAvailable:true});
  window.localStorage.setItem(lifeKey,JSON.stringify(aggregate));
 }
}

function loadGame(window,files,read,{originalBoards=[]}={}){
 const modules=[];
 for(const file of files){
  if(file==='app.js')for(const dependency of ['variants-data.js','attempts.js','events.js'])if(!modules.includes(dependency))modules.push(dependency);
  modules.push(file);
 }
 for(const file of modules){
  if(file==='app.js')prepareLifeBypass(window,read);
  if(file==='app.js'&&originalBoards.length){
   const saved=JSON.parse(window.localStorage.getItem(key)||'null')||{current:0,done:[],boards:{},sound:false};
   saved.boards=saved.boards||{};
   for(const stage of originalBoards)if(!saved.boards[stage])saved.boards[stage]=new window.HexMatch(window.HEX_LEVELS[stage-window.HEX_TUTORIALS.length]).snapshot();
   window.localStorage.setItem(key,JSON.stringify(saved));
  }
  window.eval(read(file));
 }
}
function catalog(window){
 if(!catalogs.has(window))catalogs.set(window,window.HexAttempts.createCatalog(window.HEX_LEVELS,window.HEX_VARIANTS,window.HexMatch));
 return catalogs.get(window);
}
function savedLevel(window,stage){
 const saved=JSON.parse(window.localStorage.getItem(key)),index=stage??saved.current,count=window.HEX_TUTORIALS.length;
 if(index<count)return window.HEX_TUTORIALS[index];
 const base=window.HEX_LEVELS[index-count],metadata=saved.attempts?.[index];
 return metadata?catalog(window).resolveLevel(base.id,metadata.variantId,metadata.levelDataVersion):base;
}
function savedGame(window,stage){
 const saved=JSON.parse(window.localStorage.getItem(key)),index=stage??saved.current;
 const snapshot=saved.boards[index],level=savedLevel(window,index);
 if(window.HexCommands?.isAssistedSnapshot(snapshot)){
  const config=window.HEX_ECONOMY_CONFIG,limits={greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt};
  return new window.HexAssistedGame(level,{attemptId:saved.attempts[index].attemptId,limits},snapshot);
 }
 return new window.HexMatch(level,snapshot);
}
function confirmRestart(window){
 const dialog=window.document.getElementById('restart-dialog');
 if(dialog?.open){const confirm=window.document.getElementById('restart-confirm');assert(confirm,'restart has a concrete confirmation');confirm.click();}
}
module.exports={loadGame,savedLevel,savedGame,confirmRestart,prepareLifeBypass};
