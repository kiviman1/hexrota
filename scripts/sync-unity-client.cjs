#!/usr/bin/env node
'use strict';
// Canonical source: unity/**/*.cs (runtime folders) + published JS content.
// Generated Unity copies are byte-identical; --check never writes.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),check=process.argv.includes('--check');
const folders=['Application','Catalog','Commands','Contracts','Economy','Gameplay','Hints','Lives','Rescue','RewardAdapter','Rewards'];
const assets='unity-client/Assets/';
let written=0;
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function emit(file,content){
 const absolute=path.join(root,file);
 if(check){
  if(!fs.existsSync(absolute)||read(file)!==content)throw new Error('Unity source/content is out of sync: '+file);
 }else{
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  fs.writeFileSync(absolute,content,'utf8');
 }
 written++;
}
function guid(file){
 return [0x811c9dc5,0x12345678,0x9e3779b9,0xdeadbeef].map(seed=>{
  let hash=seed>>>0;
  for(let i=0;i<file.length;i++)hash=Math.imul(hash^file.charCodeAt(i),16777619)>>>0;
  return hash.toString(16).padStart(8,'0');
 }).join('');
}
function meta(file,folder){
 const importer=folder?'DefaultImporter':file.endsWith('.cs')?'MonoImporter':file.endsWith('.json')?'TextScriptImporter':'DefaultImporter';
 return 'fileFormatVersion: 2\n'+'guid: '+guid(file)+'\n'+(folder?'folderAsset: yes\n':'')+importer+':\n  externalObjects: {}\n'+(importer==='MonoImporter'?'  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n':'')+'  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
}
const dirs=['unity-client/Assets/Hexrota','unity-client/Assets/Hexrota/Core',
 'unity-client/Assets/Hexrota/Resources','unity-client/Assets/Hexrota/Resources/Hexrota',
 'unity-client/Assets/Hexrota/Resources/Hexrota/Levels','unity-client/Assets/Hexrota/Runtime',
 'unity-client/Assets/Hexrota/Editor','unity-client/Assets/Scenes',
 ...folders.map(folder=>'unity-client/Assets/Hexrota/Core/'+folder)];
for(const dir of dirs)emit(dir+'.meta',meta(dir,true));
for(const folder of folders){
 for(const name of fs.readdirSync(path.join(root,'unity',folder)).filter(name=>name.endsWith('.cs')).sort()){
  const source='unity/'+folder+'/'+name,output='unity-client/Assets/Hexrota/Core/'+folder+'/'+name;
  emit(output,read(source));emit(output+'.meta',meta(output,false));
 }
}
const base=JSON.parse(read('data/levels-original.json')),packs=JSON.parse(read('dist/variants.json'));
if(base.schemaVersion!==1||base.rulesVersion!=='classic-v4'||packs.schemaVersion!==1||packs.rulesVersion!=='classic-v4'||base.levels.length!==10||packs.levels.length!==10)throw new Error('Unexpected published content versions');
for(const level of base.levels){
 const entry=packs.levels.find(item=>item.levelId===level.id);
 if(!entry||entry.variants.length!==4||new Set(entry.variants.map(v=>v.id)).size!==4)throw new Error('Missing certified variants for level '+level.id);
 const content={schemaVersion:1,rulesVersion:base.rulesVersion,levelDataVersion:packs.levelDataVersion,
  levelId:level.id,name:level.name,cells:level.cells.map(c=>({q:c.q,r:c.r,layers:c.layers})),
  palette:level.palette,moves:level.moves,target:level.target,targetMode:level.targetMode||'minimum',
  variants:entry.variants.map(v=>({id:v.id,initial:v.initial,seed:v.seed}))};
 const file='unity-client/Assets/Hexrota/Resources/Hexrota/Levels/level-'+level.id+'.json';
 emit(file,JSON.stringify(content,null,2)+'\n');emit(file+'.meta',meta(file,false));
}
for(const folder of ['Runtime','Editor']){
 const dir=path.join(root,'unity-client/Assets/Hexrota',folder);
 if(fs.existsSync(dir))for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.cs'))){
  const file='unity-client/Assets/Hexrota/'+folder+'/'+name;
  emit(file+'.meta',meta(file,false));
 }
}
const sceneDir=path.join(root,'unity-client/Assets/Scenes');
if(fs.existsSync(sceneDir))for(const name of fs.readdirSync(sceneDir).filter(name=>name.endsWith('.unity'))){
 const file='unity-client/Assets/Scenes/'+name;emit(file+'.meta',meta(file,false));
}
console.log('Unity sync '+(check?'verified':'generated')+': '+written+' files, '+coreCount()+' C# runtime sources, 10 levels / 40 variants');
function coreCount(){return folders.reduce((sum,folder)=>sum+fs.readdirSync(path.join(root,'unity',folder)).filter(n=>n.endsWith('.cs')).length,0);}
