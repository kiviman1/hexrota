'use strict';
// Canonical JSON owns all pilot parameters; generated targets contain no policy logic.
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname,config=JSON.parse(fs.readFileSync(path.join(root,'data/economy-config-9-5.json'),'utf8'));
require('./dist/economy.js').validateConfig(config);
const js='/* Generated from data/economy-config-9-5.json; run node sync-economy-config.cjs. */\n(function(root){\n const value='+JSON.stringify(config)+';\n root.HEX_ECONOMY_CONFIG=value;if(typeof module===\'object\'&&module.exports)module.exports=value;\n})(typeof window!==\'undefined\'?window:globalThis);\n';
function wire(value){if(value===null)return'null';if(Array.isArray(value))return'W.Arr('+value.map(wire).join(', ')+')';if(typeof value==='object')return'W.Obj('+Object.entries(value).flatMap(([key,entry])=>[JSON.stringify(key),wire(entry)]).join(', ')+')';return JSON.stringify(value);}
const cs='// Generated from data/economy-config-9-5.json; run node sync-economy-config.cjs.\nusing System.Collections.Generic;\nusing W = Hexrota.Contracts.Wire;\nnamespace Hexrota.Economy\n{\n    public static class EconomyDefaults\n    {\n        public static Dictionary<string, object> Create() { return '+wire(config)+'; }\n    }\n}\n';
for(const [relative,source] of [['dist/economy-config.js',js],['unity/Economy/EconomyDefaults.cs',cs]]){
 const target=path.join(root,relative);if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==source)throw Error(relative+' is stale; run node sync-economy-config.cjs');}else fs.writeFileSync(target,source);
}
if(process.argv.includes('--check'))console.log('Canonical economy configuration and generated JS/C# targets match.');
