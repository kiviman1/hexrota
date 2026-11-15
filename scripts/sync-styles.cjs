/* Preserve one CSS payload and its deliberate cascade order. Edit src/styles,
 * then regenerate; --check rejects drift without overwriting either side. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=require('../src/styles/manifest.json');
assert.equal(manifest.output,'dist/style.css');assert(Array.isArray(manifest.order)&&manifest.order.length);
assert.equal(new Set(manifest.order).size,manifest.order.length,'duplicate stylesheet');
for(const file of manifest.order)assert(/^src\/styles\/[\w.-]+\.css$/.test(file),'invalid source path');
const generated=manifest.order.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path.join(root,manifest.output),'utf8'),generated,'CSS source drift: run npm run styles:sync');
else fs.writeFileSync(path.join(root,manifest.output),generated);
console.log('Styles: '+manifest.order.length+' owned source sections; exact cascade and one payload verified.');
