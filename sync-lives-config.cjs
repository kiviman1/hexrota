/* Canonical life settings -> dependency-free browser data. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const api=require('./dist/lives.js');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/lives-config.json'),'utf8'));
api.validateConfig(config);
const target=path.join(__dirname,'dist/lives-config.js');
const expected='/* Generated from lives-config.json. UTC life rules and development-only test prices. */\nwindow.HEX_LIVES_CONFIG = '+JSON.stringify(config)+';\n';
if(process.argv.includes('--check')){
 if(fs.readFileSync(target,'utf8')!==expected)throw Error('Life settings wrapper is stale; run npm run lives:sync.');
 console.log('Life settings match canonical JSON.');
}else{fs.writeFileSync(target,expected);console.log('Life settings wrapper generated.');}
