/* Re-run the archived baseline with its original policy definitions and seeds. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {policyRate}=require('./generate-levels.cjs');
require('./dist/levels.js');
const archived=JSON.parse(fs.readFileSync('reports/baseline-balance.json','utf8'));
const levels=[];
for(const level of window.HEX_LEVELS){
 const random=policyRate(level,100,false),greedy=policyRate(level,30,true),expected=archived.levels.find(v=>v.id===level.id);
 assert.equal(random.rate,expected.randomWinRate,`Original level${level.id} random result changed`);
 assert.equal(greedy.rate,expected.greedyWinRate,`Original level${level.id} greedy result changed`);
 assert.equal(random.averageWaves,expected.averageCascadeWaves);
 assert.equal(random.forcedRefills,expected.forcedRefills);
 levels.push({levelId:level.id,random,greedy});
 console.log(`Original level${level.id}: random ${random.rate}%, archived coverage-greedy ${greedy.rate}% reproduce.`);
}
if(process.argv.includes('--write'))fs.writeFileSync('reports/legacy-policy-recheck.json',JSON.stringify({schemaVersion:1,method:'Exact original100random/30coverage-greedy trials, original policy definitions and seeds; not human rates.',levels},null,2)+'\n');
console.log('Archived baseline policy measurements reproduce for all10 immutable original levels.');
