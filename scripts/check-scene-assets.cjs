'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const report=JSON.parse(fs.readFileSync(path.join(root,'reports/asset-integrity.json'),'utf8'));
for(const [name,expected] of Object.entries(report.files)){
 const p=path.resolve(root,name);assert(p.startsWith(root+path.sep),'Unsafe asset path');
 const b=fs.readFileSync(p);assert.equal(b.length,expected.bytes,name+' size');
 assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected.sha256,name+' hash');
 if(name.endsWith('.webp'))assert(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP',name+' format');
}
const script=fs.readFileSync(path.join(root,'dist/assets/scenes/coop-v1/tavik-motion.js'),'utf8');
assert(!/localStorage|sessionStorage|sendBeacon|HexEconomy|HexMatch|setInterval/.test(script),'Motion must not own gameplay/storage');
const lib=require(path.join(root,'dist/assets/scenes/coop-v1/tavik-motion.js'));assert.equal(Object.keys(lib.clips).length,12);
console.log('PASS '+Object.keys(report.files).length+' source/asset hashes; 12 presentation-only motion states.');
