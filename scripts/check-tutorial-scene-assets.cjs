'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const manifestPath='data/tutorial-scene-assets-v1.json';
const stages=['foundation','frame','finished'];
const assetBase='dist/assets/scenes/tutorial-coop-v1/backgrounds/';
const sourceNames=['1-Photo-1.jpg','2-Photo-2.jpg','3-Photo-3.jpg'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ownKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));

// Read bounded JPEG segments rather than trusting a filename or metadata alone.
// Scan payloads permit byte stuffing and restart markers; each declared segment
// and the final EOI must still be present in the imported file.
function jpegSize(bytes){
  assert(Buffer.isBuffer(bytes)&&bytes.length>=4,'JPEG bytes are missing or truncated');
  assert(bytes[0]===0xff&&bytes[1]===0xd8,'JPEG SOI is missing');
  const sofMarkers=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2,size=null,scanned=false,ended=false;
  while(offset<bytes.length){
    assert.equal(bytes[offset++],0xff,'JPEG marker prefix is missing');
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    assert(offset<bytes.length,'JPEG marker is truncated');
    const marker=bytes[offset++];
    assert(marker!==0&&marker!==0xd8,'Unexpected JPEG marker');
    if(marker===0xd9){ended=true;break;}
    if(marker===0x01)continue;
    assert(marker<0xd0||marker>0xd7,'JPEG restart marker outside scan');
    assert(offset+2<=bytes.length,'JPEG segment length is truncated');
    const length=bytes.readUInt16BE(offset),end=offset+length;
    assert(length>=2&&end<=bytes.length,'JPEG segment extends outside the file');
    if(sofMarkers.has(marker)){
      assert(length>=11,'JPEG SOF is truncated');
      const precision=bytes[offset+2],height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5),components=bytes[offset+7];
      assert([8,12,16].includes(precision)&&height>0&&width>0,'Invalid JPEG frame dimensions or precision');
      assert(components>=1&&components<=4&&length===8+3*components,'Invalid JPEG frame components');
      assert(!size,'Unexpected second JPEG frame');
      size={width,height};
    }
    if(marker!==0xda){offset=end;continue;}
    assert(size,'JPEG scan precedes its frame');
    const components=bytes[offset+2];
    assert(components>=1&&components<=4&&length===6+2*components,'Invalid JPEG scan header');
    offset=end;
    let payload=false;
    while(offset<bytes.length){
      if(bytes[offset]!==0xff){payload=true;offset++;continue;}
      const start=offset++;
      while(offset<bytes.length&&bytes[offset]===0xff)offset++;
      assert(offset<bytes.length,'JPEG scan marker is truncated');
      const next=bytes[offset];
      if(next===0||(next>=0xd0&&next<=0xd7)){payload=true;offset++;continue;}
      offset=start;break;
    }
    assert(payload,'JPEG scan has no encoded payload');
    scanned=true;
  }
  assert(size&&scanned&&ended,'JPEG frame, scan or EOI is missing');
  assert.equal(offset,bytes.length,'Unexpected bytes after JPEG EOI');
  return size;
}

function validateManifest(manifest){
  assert(ownKeys(manifest,['schemaVersion','id','files']),'Invalid tutorial asset manifest shape');
  assert.equal(manifest.schemaVersion,1,'Unsupported tutorial asset manifest version');
  assert.equal(manifest.id,'tutorial-coop-v1','Unexpected tutorial asset pack');
  assert(Array.isArray(manifest.files)&&manifest.files.length===3,'Exactly three supplied tutorial backgrounds are required');
  for(let index=0;index<stages.length;index++){
    const file=manifest.files[index],stage=stages[index];
    assert(ownKeys(file,['stage','path','sourceName','bytes','sha256','width','height']),'Invalid tutorial asset record');
    assert.equal(file.stage,stage,'Tutorial stages must keep the supplied order');
    assert.equal(file.path,assetBase+stage+'.jpg','Only the exact reviewed tutorial asset paths are allowed');
    assert.equal(file.sourceName,sourceNames[index],'Source image identity must be preserved');
    assert(Number.isSafeInteger(file.bytes)&&file.bytes>0,'Invalid tutorial image byte count');
    assert(typeof file.sha256==='string'&&/^[a-f0-9]{64}$/.test(file.sha256),'Invalid tutorial image SHA-256');
    assert.equal(file.width,720,'Tutorial background width must remain 720');
    assert.equal(file.height,1280,'Tutorial background height must remain 1280');
  }
  return manifest;
}

function readAsset(name){
  const absolute=path.resolve(root,name);
  assert(absolute.startsWith(root+path.sep),'Unsafe tutorial asset path');
  assert(fs.realpathSync(absolute).startsWith(fs.realpathSync(root)+path.sep),'Tutorial asset cannot escape through a directory symlink');
  const stat=fs.lstatSync(absolute);
  assert(stat.isFile()&&!stat.isSymbolicLink(),'Tutorial assets must be ordinary local files');
  return fs.readFileSync(absolute);
}

function verifyAssets(manifest,read=readAsset){
  validateManifest(manifest);
  for(const file of manifest.files){
    const bytes=read(file.path);
    assert.equal(bytes.length,file.bytes,file.path+' byte count');
    assert.equal(hash(bytes),file.sha256,file.path+' SHA-256');
    assert.deepEqual(jpegSize(bytes),{width:file.width,height:file.height},file.path+' JPEG dimensions');
  }
  return manifest.files.length;
}

function regressions(manifest){
  let rejected=0;
  const rejects=run=>{assert.throws(run);rejected++;};
  const changed=alter=>{const copy=JSON.parse(JSON.stringify(manifest));alter(copy);return copy;};
  for(const alter of [
    value=>{value.schemaVersion=2;},
    value=>{value.id='other-pack';},
    value=>{value.privateSource='/tmp/private-attachment.jpg';},
    value=>{value.files.pop();},
    value=>{value.files.push(value.files[0]);},
    value=>{value.files.reverse();},
    value=>{value.files[0].path='../foundation.jpg';},
    value=>{value.files[0].path=assetBase+'unreviewed.jpg';},
    value=>{value.files[0].sourceName='2-Photo-2.jpg';},
    value=>{value.files[0].bytes=0;},
    value=>{value.files[0].sha256='not-a-hash';},
    value=>{value.files[0].width=1280;},
    value=>{value.files[0].height=720;},
    value=>{value.files[0].extra=true;}
  ])rejects(()=>validateManifest(changed(alter)));
  const first=manifest.files[0],original=readAsset(first.path);
  rejects(()=>verifyAssets(manifest,name=>{if(name!==first.path)return readAsset(name);const tampered=Buffer.from(original);tampered[20]^=1;return tampered;}));
  rejects(()=>verifyAssets(manifest,name=>name===first.path?original.subarray(0,-2):readAsset(name)));
  rejects(()=>verifyAssets(manifest,()=>{throw new Error('Missing prepared image');}));
  const fakeHeader=Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x0b,0x08,0x05,0x00,0x02,0xd0,0x01,0x01,0x11,0x00]);
  rejects(()=>jpegSize(fakeHeader));
  rejects(()=>jpegSize(Buffer.concat([fakeHeader,Buffer.from([0xff,0xd9])])));
  rejects(()=>jpegSize(Buffer.from([0xff,0xd8,0xff,0xe0,0xff,0xff,0xff,0xd9])));
  rejects(()=>jpegSize(original.subarray(0,-1)));
  rejects(()=>jpegSize(Buffer.concat([original,Buffer.from([0])])));
  rejects(()=>jpegSize(Buffer.from('not a JPEG')));
  const wrongDimensions=changed(()=>{});
  const jpeg=Buffer.from(original),sof=jpeg.indexOf(Buffer.from([0xff,0xc0]));
  assert(sof>=0,'The supplied baseline JPEG fixture must retain its frame');
  jpeg.writeUInt16BE(719,sof+7);
  wrongDimensions.files[0].sha256=hash(jpeg);
  rejects(()=>verifyAssets(wrongDimensions,name=>name===first.path?jpeg:readAsset(name)));
  return rejected;
}

if(require.main===module){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
  const files=verifyAssets(manifest),negativeCases=regressions(manifest);
  console.log('PASS '+files+' byte-preserved tutorial JPEG hashes and 720×1280 frames; '+negativeCases+' malformed/tampered/missing asset cases rejected.');
}

module.exports={jpegSize,validateManifest,verifyAssets};
