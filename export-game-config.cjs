/* Development-only JSON exports for a future native data importer. JS sources stay intact. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,context={window:{}};vm.createContext(context);
for(const file of ['levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const exportsToWrite=[
 {file:'levels-original.json',kind:'campaign',levelDataVersion:'original-v1',levels:context.window.HEX_LEVELS},
 {file:'tutorials-fixed.json',kind:'tutorial',levelDataVersion:'tutorials-v1',levels:context.window.HEX_TUTORIALS}
];
for(const entry of exportsToWrite){
 assert(Array.isArray(entry.levels)&&entry.levels.length>0,'Configuration export contains levels');
 assert(entry.levels.every(level=>level.rulesVersion==='classic-v4'),'Export does not silently change mechanics');
 const document={schemaVersion:1,kind:entry.kind,levelDataVersion:entry.levelDataVersion,rulesVersion:'classic-v4',levels:entry.levels};
 const output=JSON.stringify(document,null,2)+'\n',target=path.join(root,'data',entry.file);
 if(process.argv.includes('--check'))assert(fs.readFileSync(target,'utf8')===output,entry.file+' is stale; regenerate and review the JSON export');
 else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,output);}
}
console.log('Original campaign and fixed tutorial JSON exports '+(process.argv.includes('--check')?'verified':'written')+' without modifying their JavaScript sources.');
