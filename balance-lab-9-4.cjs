/* Deterministic offline comparison report. Does not write published game data. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./lib/balance-lab-analysis.cjs');
const REPORT=path.join(__dirname,'reports/balance-lab-9-4.json');
async function run(args=process.argv.slice(2)){
 const allowed=arg=>['--write','--check','--quiet'].includes(arg)||arg.startsWith('--scenario=');
 if(!args.includes('--write')&&!args.includes('--check')&&!args.some(arg=>arg.startsWith('--scenario=')))args=[...args,'--write'];
 if(args.some(arg=>!allowed(arg))||args.includes('--write')===args.includes('--check'))throw Error('Use exactly one of --write or --check, optionally --quiet or --scenario=<id>');
 const subset=args.filter(arg=>arg.startsWith('--scenario=')).map(arg=>arg.slice('--scenario='.length));
 if(subset.length&&args.includes('--write'))throw Error('A subset cannot overwrite the complete Balance Lab report');
 const scenarios=Lab.loadScenarios(),requested=scenarios.filter(scenario=>subset.includes(scenario.scenarioId));
 // A debug subset still carries its same-variant baseline; it can never publish
 // a candidate-only aggregate with a different comparison cohort.
 const selected=subset.length?scenarios.filter(scenario=>subset.includes(scenario.scenarioId)||scenario.experimentId==='baseline'&&requested.some(item=>item.levelId===scenario.levelId&&item.variantId===scenario.variantId)):scenarios;
 if(subset.some(id=>!scenarios.some(scenario=>scenario.scenarioId===id)))throw Error('Unknown lab scenario selection');
 if(!selected.length)throw Error('No Balance Lab scenarios selected');
 const workers=process.env.HEXROTA_LAB_WORKERS===undefined?4:Number(process.env.HEXROTA_LAB_WORKERS),rows=await Lab.measureAll(selected,{workers,quiet:args.includes('--quiet')}),report=Lab.buildReport(selected,rows,{partial:subset.length>0});
 const text=JSON.stringify(report,null,2)+'\n';
 if(subset.length){console.log(text);return report;}
 if(args.includes('--write')){fs.mkdirSync(path.dirname(REPORT),{recursive:true});fs.writeFileSync(REPORT,text);console.log('Balance Lab report written; published game files unchanged.');}
 else if(fs.readFileSync(REPORT,'utf8')!==text)throw Error('Balance Lab report differs; inspect source changes then run npm run balance:lab');
 else console.log('Balance Lab report exactly reproduces.');
 console.log(JSON.stringify({scenarios:report.method.scenarioCount,games:report.method.simulatedGames,policies:Lab.POLICIES,trialsPerPolicy:Lab.SETTINGS.trials,originalRoutes:report.certification.originalWinningRoutes,candidateRoutes:report.certification.candidateWinningRoutes,originalAuditMetricComparisons:report.certification.existingAuditMetricComparisons,sourceHash:report.sourceHash}));return report;
}
if(process.argv.includes('--worker')){
 if(process.argv.slice(2).join(' ')!=='--worker'||typeof process.send!=='function')throw Error('Lab worker is internal only');
 process.on('message',scenario=>{try{process.send({result:Lab.measureScenario(scenario)});}catch(error){process.send({error:error.stack||error.message});}});
}else if(require.main===module)run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={run,REPORT};
