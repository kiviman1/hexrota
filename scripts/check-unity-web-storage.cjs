#!/usr/bin/env node
'use strict';
// Execute the real .jslib functions with only Emscripten's string/memory boundary mocked.
// This is not a Unity/IL2CPP or physical Safari execution.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const values=new Map(),heap=new Map();let nextPointer=1,fail=false,checks=0;
const context={LibraryManager:{library:{}},window:{hexrotaProfileLock:true},
  UTF8ToString:value=>typeof value==='number'?heap.get(value):value,
  stringToNewUTF8:value=>{const pointer=nextPointer++;heap.set(pointer,value);return pointer;},
  localStorage:{getItem:key=>{if(fail)throw Error('denied');return values.has(key)?values.get(key):null;},
    setItem:(key,value)=>{if(fail)throw Error('quota');values.set(key,value);}},
  mergeInto:(target,source)=>Object.assign(target,source)};
vm.runInNewContext(fs.readFileSync('unity-client/Assets/Plugins/WebGL/HexrotaStorage.jslib','utf8'),context);
const lib=context.LibraryManager.library,key='hexrota-profile-v2',scope='hexrota-unity-9.11/'+key;
const profile=revision=>JSON.stringify({schemaVersion:2,revision,game:{boards:{}},energy:{life:{}}});
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('missing profile is distinct from present JSON null',()=>{
 assert.equal(lib.HexrotaStorageContains(key),0);assert.equal(heap.get(lib.HexrotaStorageRead(key)),'');
 values.set(scope,'null');assert.equal(lib.HexrotaStorageContains(key),1);assert.equal(heap.get(lib.HexrotaStorageRead(key)),'null');values.delete(scope);
});
test('new canonical game and energy commit together',()=>{assert.equal(lib.HexrotaStorageCas(key,0,profile(1)),1);assert.equal(values.get(scope),profile(1));});
test('stale revision cannot overwrite canonical save',()=>{assert.equal(lib.HexrotaStorageCas(key,0,profile(1)),0);assert.equal(values.get(scope),profile(1));});
test('next revision advances exactly once',()=>{assert.equal(lib.HexrotaStorageCas(key,1,profile(2)),1);assert.equal(lib.HexrotaStorageCas(key,1,profile(2)),0);});
test('malformed existing profile fails closed and remains byte identical',()=>{
 for(const raw of ['', '{bad', 'null', '{}', '{"schemaVersion":2,"revision":-1}', '{"schemaVersion":2,"revision":1.5}']){
  values.set(scope,raw);assert.equal(lib.HexrotaStorageCas(key,0,profile(1)),-1);assert.equal(values.get(scope),raw);
 }
 values.set(scope,profile(2));
});
test('invalid candidate cannot commit or skip a revision',()=>{
 for(const raw of ['{bad','null','{}',profile(4),profile(1),profile(9007199254740992)]){
  assert.equal(lib.HexrotaStorageCas(key,2,raw),-1);assert.equal(values.get(scope),profile(2));
 }
});
test('lock is required for every read and write operation',()=>{
 context.window.hexrotaProfileLock=false;
 assert.equal(lib.HexrotaStorageContains(key),-1);assert.equal(lib.HexrotaStorageRead(key),0);
 assert.equal(lib.HexrotaStorageWrite(key,'{}'),-1);assert.equal(lib.HexrotaStorageCas(key,2,profile(3)),-1);
 assert.equal(values.get(scope),profile(2));context.window.hexrotaProfileLock=true;
});
test('quota or privacy failure is never acknowledged as durable',()=>{
 fail=true;assert.equal(lib.HexrotaStorageContains(key),-1);assert.equal(lib.HexrotaStorageRead(key),0);
 assert.equal(lib.HexrotaStorageWrite(key,'{}'),-1);assert.equal(lib.HexrotaStorageCas(key,2,profile(3)),-1);fail=false;
 assert.equal(values.get(scope),profile(2));
});
test('web prototype profile remains isolated',()=>{
 values.set(key,'untouched prototype');assert.equal(lib.HexrotaStorageCas(key,2,profile(3)),1);
 assert.equal(values.get(key),'untouched prototype');assert.equal(values.get(scope),profile(3));
});
test('UTF8 text is preserved for platform decoder',()=>{
 const json=JSON.stringify({text:'Tavik: Yeşil bahçe 🌱'});assert.equal(lib.HexrotaStorageWrite('hexrota-events-v1',json),1);
 assert.equal(heap.get(lib.HexrotaStorageRead('hexrota-events-v1')),json);
});
console.log('Unity Web storage bridge: '+checks+' host groups passed (not Unity execution).');
