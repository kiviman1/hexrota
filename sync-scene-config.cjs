'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,config=JSON.parse(fs.readFileSync(path.join(root,'data/scene-config-v1.json'),'utf8'));
require('./dist/scene-presentation.js').validateConfig(config);
const json=JSON.stringify(config,null,2)+'\n';
const js='/* Generated from data/scene-config-v1.json; run node sync-scene-config.cjs. */\n(function(root){\n const value='+JSON.stringify(config)+';\n root.HEX_SCENE_CONFIG=value;if(typeof module===\'object\'&&module.exports)module.exports=value;\n})(typeof window!==\'undefined\'?window:globalThis);\n';
for(const [file,source]of [['dist/scene-config.json',json],['dist/scene-config.js',js]]){
 const target=path.join(root,file);if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==source)throw new Error(file+' is stale; run node sync-scene-config.cjs');}else fs.writeFileSync(target,source);
}
console.log('Scene configuration matches the tutorial-only three-stage presentation contract.');
