'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {buildSuite}=require('./lib/command-scenarios.cjs'),suite=buildSuite(),file=path.join(__dirname,'fixtures/command-vectors.json'),json=JSON.stringify(suite.fixture)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),json,'frozen command fixtures and every complete output digest');else fs.writeFileSync(file,json);
console.log('Command vectors '+(process.argv.includes('--check')?'checked':'written')+': '+JSON.stringify({...suite.fixture.counts,comparisons:suite.requests.length,sha256:suite.fixture.expectedSha256}));
