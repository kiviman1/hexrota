/* Lightweight dependency/syntax guardrails; not a claim of full static analysis. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pure=['story-engine.js','idle-hints.js','move-presentation.js','board-input.js','app-state.js','state-selectors.js'];
for(const file of pure){const source=read('dist/'+file);assert(!/\b(document|localStorage|sessionStorage|fetch|XMLHttpRequest|HexMatch|HexEconomy|HexLives)\b/.test(source),file+' must stay free of app/engine/platform dependencies');}
for(const file of ['story-presentation.js','material-view.js','idle-hint-view.js','game-save.js','board-view.js','score-presentation.js','state-effects.js'])assert(!/\b(localStorage|sessionStorage|fetch|XMLHttpRequest|HexMatch|HexEconomy|HexLives)\b/.test(read('dist/'+file)),file+' cannot take over gameplay or persistence');
const html=read('dist/index.html'),sw=read('dist/sw.js'),version=sw.match(/hexrota-shell-v(\d+)/)[1];
const scripts=[...html.matchAll(/<script src="\.\/([^"?]+)\?v=(\d+)" defer><\/script>/g)].map(m=>({file:m[1],version:m[2]}));
assert.equal(new Set(scripts.map(s=>s.file)).size,scripts.length,'runtime scripts must load once');
for(const file of ['story-content.js','story-engine.js','story-events.js','story-alpha.js','story-profile.js','story-presentation.js','material-alpha-levels.js','material-alpha.js','material-view.js','idle-hints.js','idle-hint-view.js','game-save.js','board-view.js','board-input.js','score-presentation.js','move-presentation.js','app-state.js','state-selectors.js','state-effects.js']){
 const index=scripts.findIndex(s=>s.file===file);assert(index>=0&&index<scripts.findIndex(s=>s.file==='app.js'),file+' must load before the app');assert(sw.includes("'"+file+"'"),file+' must be included in offline assets');
}
for(const script of scripts){assert.equal(script.version,version,script.file+' cache generation mismatch');assert(fs.existsSync(path.join(root,'dist',script.file)));}
let parsed=0;for(const name of fs.readdirSync(path.join(root,'dist')).filter(n=>n.endsWith('.js'))){new vm.Script(read('dist/'+name),{filename:name});parsed++;}
for(const file of ['Story','StoryAdapter','Gameplay','Lives','Economy','Commands','Rescue','Hints','Catalog','Rewards','RewardAdapter','Contracts']){
 for(const name of fs.readdirSync(path.join(root,'unity',file)).filter(n=>n.endsWith('.cs'))){assert(!/using UnityEngine|using System\.IO|using System\.Net|\bPlayerPrefs\b/.test(read('unity/'+file+'/'+name)),file+'/'+name+' must remain portable');}
}
assert(read('unity/Application/GameSessionController.cs').includes('public sealed partial class GameSessionController'));
for(const section of ['Assistance','Rescue'])assert(read('unity/Application/GameSessionController.'+section+'.cs').includes('public sealed partial class GameSessionController'));
console.log('Architecture boundaries, '+parsed+' runtime syntax files, explicit script order and offline assets verified.');
