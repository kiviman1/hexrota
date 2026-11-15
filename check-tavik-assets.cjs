'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const spec=require('./data/tavik-approved.json');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const image=fs.readFileSync(path.join(__dirname,'dist',spec.assetPath));
assert.equal(spec.status,'user-approved');assert.equal(spec.characterId,'tavik');assert.equal(spec.displayName,'Tavik');
assert.equal(spec.source.sha256,'11fa0f48269f01066109d2cd903f506308851bb292bbfff55d96d54c5ed16e1c');
assert.deepEqual(spec.sourceCropLeftTopRightBottom,[652,43,799,281]);
assert.equal(image.length,spec.bytes);assert.equal(image.length,7904);
assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
assert.equal(crypto.createHash('sha256').update(image).digest('hex'),spec.assetSha256);
for(const file of ['dist/index.html','dist/ui-kit.html']){const html=read(file);assert(html.includes('./'+spec.assetPath),file+' uses the approved asset');assert(html.includes('Tavik'),file+' names the approved character');}
const sw=read('dist/sw.js');assert(sw.includes("'"+spec.assetPath+"'"),'approved art is explicitly preloaded');
const sandbox={URL,self:{location:{href:'https://hexrota.test/sw.js'},addEventListener(){}}};vm.runInNewContext(sw,sandbox);
const url=new URL('https://hexrota.test/'+spec.assetPath),res=type=>({status:200,redirected:false,type:'basic',headers:{get:()=>type}});
assert.equal(sandbox.assetType(url,res('image/webp')),true);assert.equal(sandbox.assetType(url,res('text/html')),false);assert.equal(sandbox.assetType(url,res('application/octet-stream')),false);assert.equal(sandbox.assetType(url,{...res('image/webp'),redirected:true}),false);
assert(read('dist/ui-kit.html').includes('Henüz kampanyaya bağlı değil'));
console.log('PASS approved Tavik identity, unchanged cropped pixels, local integration and strict offline asset MIME');
