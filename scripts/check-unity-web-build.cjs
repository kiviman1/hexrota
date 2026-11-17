#!/usr/bin/env node
'use strict';
// Refuses a JS-prototype directory, stale/missing build, or placeholder artifact.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(process.argv[2]||'unity-client/Builds/WebGL');
const read=p=>fs.readFileSync(path.join(dir,p));
const marker=JSON.parse(read('hexrota-unity-build.json'));
assert.equal(marker.schemaVersion,1);assert.equal(marker.unityVersion,'6000.6.9f1');assert.equal(marker.target,'WebGL');
assert.equal(marker.scene,'Assets/Hexrota/Scenes/FirstPlayable.unity');
const files=fs.readdirSync(path.join(dir,'Build'));
const find=suffix=>{const matches=files.filter(p=>p.endsWith(suffix));assert.equal(matches.length,1,'Expected one '+suffix);return 'Build/'+matches[0];};
const wasm=read(find('.wasm'));assert(wasm.length>1024,'WASM payload missing');assert.equal(wasm.subarray(0,4).toString('hex'),'0061736d','Must be real uncompressed WebAssembly');
assert(read(find('.data')).length>1024,'Unity asset data missing');
assert(read(find('.framework.js')).length>1024,'Unity framework missing');
assert.match(read(find('.loader.js')).toString(),/createUnityInstance/);
const html=read('index.html').toString();assert.match(html,/createUnityInstance/);assert(!html.includes('{{{'),'Unresolved Unity template macros');
assert(!fs.existsSync(path.join(dir,'engine.js')),'Legacy JS engine must not be served as Unity');
assert(fs.existsSync(path.join(dir,'vercel.json')),'Preview headers missing');
console.log(JSON.stringify({status:'real-unity-artifact-verified',...marker,wasmBytes:wasm.length,files:files.length},null,2));
