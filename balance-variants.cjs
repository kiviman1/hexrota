/* Reproduce policy measurements for every certified variant. No network or UI. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {HEX_LEVELS,POLICIES,analyse,round,asLevel}=require('./lib/level-analysis.cjs');
const {validateCatalog,validateCurve,preservePublishedIdentity,acceptance,options}=require('./generate-variants.cjs');
const catalog=JSON.parse(fs.readFileSync('dist/variants.json','utf8'));
const report=JSON.parse(fs.readFileSync('balance-report.json','utf8'));
validateCatalog(catalog);
const measured=[];
for(const entry of catalog.levels){
 const base=HEX_LEVELS.find(l=>l.id===entry.levelId),published=report.levels.find(l=>l.levelId===entry.levelId),accepted=[];
 for(const variant of entry.variants){
  const analysis=analyse(asLevel(base,variant),options(report.method.trialsPerPolicy));
  const expected=published.variants.find(v=>v.id===variant.id);
  assert.deepEqual(analysis.policies,expected.policies,`Level${base.id}/${variant.id} policy metrics are stale`);
  assert.equal(analysis.easeScore,variant.difficultyMetrics.easeScore);
  assert.equal(analysis.difficultyIndex,variant.difficultyMetrics.difficultyIndex);
  for(const policy of POLICIES)assert.equal(analysis.policies[policy].winRate,variant.difficultyMetrics.policyWinRates[policy],`Level${base.id}/${variant.id} compact policy summary is stale`);
  assert.equal(analysis.planningAdvantage,variant.difficultyMetrics.planningAdvantage);
  assert.deepEqual(acceptance(base,entry.difficulty,analysis,variant.solutions,accepted),[],`Level${base.id}/${variant.id} fails configured similarity gates`);
  accepted.push({analysis,solutions:variant.solutions});
  measured.push({levelId:base.id,id:variant.id,ease:analysis.easeScore});
 }
 const average=round(accepted.reduce((n,v)=>n+v.analysis.easeScore,0)/accepted.length);assert.equal(average,published.averageEaseScore);
 for(const policy of POLICIES)assert.equal(round(accepted.reduce((n,v)=>n+v.analysis.policies[policy].winRate,0)/accepted.length),published.averagePolicyWinRates[policy]);
 console.log(`Level ${base.id}: ${entry.variants.length} variants × 4 policies × ${report.method.trialsPerPolicy} attempts reproduce; mean difficulty ${round(100-average)}.`);
}
for(const expected of report.baseline){
 const base=HEX_LEVELS.find(level=>level.id===expected.levelId),analysis=analyse(base,options(report.method.trialsPerPolicy));
 assert.deepEqual(analysis.policies,expected.policies,`Original level${base.id} modern policy measurements are stale`);
 assert.equal(analysis.easeScore,expected.easeScore);
}
assert.deepEqual(validateCurve(report.levels),report.curveChecks,'reported curve checks reproduce');
preservePublishedIdentity('dist/variants.json',catalog);
const changed=JSON.parse(JSON.stringify(catalog));changed.levels[0].variants[0].seed=(changed.levels[0].variants[0].seed+1)>>>0||1;
assert.throws(()=>preservePublishedIdentity('dist/variants.json',changed),/immutable/,'published attempt identity cannot be silently replaced');
const newVersion={...catalog,levelDataVersion:'unregistered-next-version'};
assert.throws(()=>preservePublishedIdentity('dist/variants.json',newVersion),/Archive/,'changing data versions requires a preserved archive');
console.log(`${measured.length} variants, ${measured.length*4*report.method.trialsPerPolicy} reproducible bot attempts and configured sawtooth ordering pass. These are bot-policy results, not human win rates.`);
