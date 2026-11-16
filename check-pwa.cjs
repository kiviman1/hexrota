/* PWA behavior against real markup and a scoped service-worker runtime. */
'use strict';
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'dist');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const shellVersion=read('sw.js').match(/const CACHE='hexrota-shell-v(\d+)'/)?.[1];
assert(shellVersion,'the shell has an explicit cache version');
const shellCache='hexrota-shell-v'+shellVersion,versioned=file=>file+'?v='+shellVersion;
const tests=[];
const test=(name,run)=>tests.push({name,run});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const settle=async()=>{await tick();await tick();};
const unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error));

function mount(options={}){
 const errors=[],reloads=[],vc=new VirtualConsole();
 vc.on('jsdomError',error=>{if(/Not implemented: navigation/.test(error.message))reloads.push(error);else errors.push(error);});
 const dom=new JSDOM(read('index.html'),{url:options.url||'https://game.test/demo/?session=secret#game',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:!!options.standalone,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 Object.defineProperty(w.navigator,'standalone',{configurable:true,value:!!options.standalone});
 if(options.ua)Object.defineProperty(w.navigator,'userAgent',{configurable:true,value:options.ua});
 if(options.touch)Object.defineProperty(w.navigator,'maxTouchPoints',{configurable:true,value:options.touch});
 if(options.share)Object.defineProperty(w.navigator,'share',{configurable:true,value:options.share});
 if(options.clipboard)Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:options.clipboard}});
 if(options.fullscreen){
  Object.defineProperty(d,'fullscreenElement',{configurable:true,writable:true,value:null});
  d.documentElement.requestFullscreen=async()=>{options.fullscreen.enter++;if(options.fullscreen.fail)throw new Error('Fullscreen denied');d.fullscreenElement=d.documentElement;d.dispatchEvent(new w.Event('fullscreenchange'));};
  d.exitFullscreen=async()=>{options.fullscreen.exit++;d.fullscreenElement=null;d.dispatchEvent(new w.Event('fullscreenchange'));};
 }
 let serviceWorker,registration;
 const messages=[],registerCalls=[];
 if(options.sw){
  serviceWorker=new w.EventTarget();registration=new w.EventTarget();
  registration.waiting=options.waiting?{postMessage:message=>messages.push(message)}:null;
  registration.active={postMessage:message=>messages.push(message)};
  serviceWorker.register=async(...args)=>{registerCalls.push(args);if(options.swFailure)throw new Error('Unavailable');return registration;};
  serviceWorker.ready=Promise.resolve(registration);
  Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:serviceWorker});
 }
 if(options.app){
  w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
  class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}click(){}stop(){}dispose(){}}
  w.HexAudio=AudioStub;
  loadGame(w,['engine.js','levels.js','tutorials.js','app.js'],read);
 }
 w.eval(read('pwa.js'));
 return {dom,w,d,errors,reloads,messages,registerCalls,registration,serviceWorker,node:id=>{const node=d.getElementById(id);assert(node,id+' exists');return node;},click(id){this.node(id).click();},close(){dom.window.close();assert.deepEqual(errors,[],'no uncaught browser errors');}};
}

function pngSize(file){const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.subarray(12,16).toString(),'IHDR');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];}
test('manifest and home-screen icons describe an installable scoped app',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 for(const field of ['id','scope','start_url'])assert.equal(manifest[field],'./');
 assert.equal(manifest.name,'Hexrota');assert.equal(manifest.short_name,'Hexrota');assert.equal(manifest.lang,'tr');assert.equal(manifest.display,'standalone');
 assert.equal(manifest.theme_color,'#183d32');assert.equal(manifest.background_color,'#f5f4ec');
 for(const icon of manifest.icons){assert.equal(icon.type,'image/png');assert(!/^(?:https?:|\/\/)/.test(icon.src),'icons stay local');assert.equal(pngSize(path.resolve(root,icon.src)).join('x'),icon.sizes);}
 assert(manifest.icons.some(icon=>icon.sizes==='192x192'));
 assert(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
 const html=read('index.html'),document=new JSDOM(html).window.document;
 assert.equal(document.querySelector('link[rel="manifest"]').getAttribute('href'),'./manifest.webmanifest');
 const apple=document.querySelector('link[rel="apple-touch-icon"]');assert(apple);assert.deepEqual(pngSize(path.resolve(root,apple.getAttribute('href'))),[180,180]);
 assert(document.querySelector('meta[name="application-name"][content="Hexrota"]'));
 assert(document.querySelector(`script[src="./${versioned('pwa.js')}"]`));
});

test('the integrated shell preloads every markup and hint-worker dependency at one version',async()=>{
 const dom=new JSDOM(read('index.html')),document=dom.window.document;
 const scripts=[...document.querySelectorAll('script[src]')].map(node=>node.getAttribute('src'));
 const dependencies=[...scripts,...[...document.querySelectorAll('link[rel="stylesheet"][href]')].map(node=>node.getAttribute('href'))];
 const workerUrl=read('app.js').match(/new Worker\(['"]([^'"]+)['"]\)/)?.[1];assert(workerUrl,'the application creates the separate hint worker');dependencies.push(workerUrl);
 const imports=[...read('hint-worker.js').matchAll(/importScripts\(['"]([^'"]+)['"]\)/g)].map(match=>match[1]);assert(imports.length,'the hint worker imports its engine');dependencies.push(...imports);
 const local=raw=>new URL(raw,'https://game.test/demo/');
 for(const raw of dependencies){const url=local(raw);assert.equal(url.origin,'https://game.test');assert.equal(url.search,'?v='+shellVersion,raw+' uses the same integrated version');assert(fs.existsSync(path.join(root,url.pathname.slice('/demo/'.length))),raw+' is a deployed asset');}
 for(const module of ['session-store.js','playtest.js']){const index=scripts.findIndex(raw=>local(raw).pathname.endsWith('/'+module)),app=scripts.findIndex(raw=>local(raw).pathname.endsWith('/app.js'));assert(index>=0&&index<app,module+' loads before app initialization');}
 const sw=worker();sw.setNetwork(async request=>{const url=new URL(request.url),file=url.pathname.slice('/demo/'.length);if(!/\.(?:js|css)$/.test(file))return response('not used by this dependency check','text/plain',404);return response(read(file),file.endsWith('.css')?'text/css':'application/javascript');});
 await sw.emit('install');sw.setNetwork(async()=>{throw new Error('Offline');});
 for(const raw of new Set(dependencies)){const url=local(raw),file=url.pathname.slice('/demo/'.length),result=await sw.fetch(raw);assert.equal(result.handled,true,raw+' is inside the offline allowlist');assert.equal(await result.response.text(),read(file),raw+' has the exact integrated cached bytes');}
 dom.window.close();
});

test('native installation runs only after a click and can be dismissed',async()=>{
 const f=mount();try{
  let prompts=0;const event=new f.w.Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{prompts++;};event.userChoice=Promise.resolve({outcome:'dismissed'});
  f.w.dispatchEvent(event);assert(event.defaultPrevented);assert.equal(prompts,0);assert(!f.node('install-app').hidden);
  f.click('install-app');await settle();assert.equal(prompts,1);assert(!f.node('install-app').hidden);assert(/iptal/.test(f.node('pwa-status').textContent));
  f.click('install-app');assert(f.node('install-dialog').open,'consumed native prompt falls back to instructions');
  f.node('install-dialog').close();const accepted=new f.w.Event('beforeinstallprompt',{cancelable:true});accepted.prompt=async()=>{prompts++;};accepted.userChoice=Promise.resolve({outcome:'accepted'});f.w.dispatchEvent(accepted);
  f.click('install-app');await settle();assert.equal(prompts,2);assert(f.node('install-app').hidden);
 }finally{f.close();}
});

test('manual instructions work on iPhone and touch-enabled iPad desktop user agents',()=>{
 for(const options of [{ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',touch:5}]){
  const f=mount(options);try{f.click('install-app');assert(f.node('install-dialog').open);assert(/Safari/.test(f.node('install-instructions').textContent));assert(/Ana Ekrana Ekle/.test(f.node('install-instructions').textContent));}finally{f.close();}
 }
});

test('actual app keeps Settings underneath Install and Escape closes only the top dialog',()=>{
 const f=mount({app:true});try{
  f.click('settings');assert(f.node('settings-dialog').open);f.click('install-app');assert(f.node('install-dialog').open);assert(f.node('settings-dialog').open);
  f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(!f.node('install-dialog').open);assert(f.node('settings-dialog').open);
  f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(!f.node('settings-dialog').open);
 }finally{f.close();}
});

test('standalone hides installation/fullscreen, while browser fullscreen really enters and exits',async()=>{
 const hidden=mount({standalone:true,fullscreen:{enter:0,exit:0}});try{assert(hidden.node('install-app').hidden);assert(hidden.node('fullscreen-game').hidden);}finally{hidden.close();}
 const unsupported=mount();try{assert(unsupported.node('fullscreen-game').hidden);}finally{unsupported.close();}
 const calls={enter:0,exit:0},f=mount({fullscreen:calls});try{
  assert(!f.node('fullscreen-game').hidden);f.click('fullscreen-game');await settle();assert.equal(calls.enter,1);assert.equal(f.node('fullscreen-game').getAttribute('aria-pressed'),'true');
  f.click('fullscreen-game');await settle();assert.equal(calls.exit,1);assert.equal(f.node('fullscreen-game').getAttribute('aria-pressed'),'false');
  calls.fail=true;f.click('fullscreen-game');await settle();assert(/açamadı/.test(f.node('pwa-status').textContent));
 }finally{f.close();}
});

test('share sends a clean canonical URL, cancellation is quiet, and failed APIs expose a selectable link',async()=>{
 const shared=[],copied=[],expected='https://game.test/demo/index.html';
 let f=mount({url:expected+'?session=private&token=hidden#level-2',share:async data=>shared.push(data)});
 try{f.click('share-game');await settle();assert.equal(shared.length,1);assert.equal(shared[0].url,expected);assert.equal(shared[0].title,'Hexrota');}finally{f.close();}
 f=mount({share:async()=>{throw Object.assign(new Error('Canceled'),{name:'AbortError'});},clipboard:async text=>copied.push(text)});
 try{f.click('share-game');await settle();assert.equal(copied.length,0);assert.equal(f.node('pwa-status').textContent,'');assert(f.node('share-url').hidden);}finally{f.close();}
 f=mount({share:async()=>{throw new Error('Share denied');},clipboard:async text=>copied.push(text)});
 try{f.click('share-game');await settle();assert.deepEqual(copied,['https://game.test/demo/']);assert(/kopyalandı/.test(f.node('pwa-status').textContent));}finally{f.close();}
 f=mount({clipboard:async()=>{throw new Error('Clipboard denied');}});
 try{f.node('settings-dialog').showModal();f.click('share-game');await settle();const field=f.node('share-url');assert(!field.hidden);assert(field.readOnly);assert.equal(field.value,'https://game.test/demo/');assert.equal(f.d.activeElement,field);assert.equal(field.selectionStart,0);assert.equal(field.selectionEnd,field.value.length);}finally{f.close();}
});

test('service-worker updates wait for explicit approval and never reload an active game automatically',async()=>{
 const f=mount({sw:true,waiting:true});try{
  await settle();assert.equal(f.registerCalls.length,1);assert.equal(f.registerCalls[0][0],'./sw.js');assert.equal(f.registerCalls[0][1].scope,'./');assert(!f.node('app-update').hidden);
  f.serviceWorker.dispatchEvent(new f.w.Event('controllerchange'));await settle();assert.equal(f.reloads.length,0);
  assert(!f.messages.some(message=>message.type==='SKIP_WAITING'));f.click('app-update');assert(f.node('app-update').disabled);assert.equal(f.messages.filter(message=>message.type==='SKIP_WAITING').length,1);
  f.serviceWorker.dispatchEvent(new f.w.Event('controllerchange'));await settle();assert.equal(f.reloads.length,1,'only approved update reloads');
 }finally{f.close();}
 const offline=mount({sw:true,swFailure:true});try{await settle();assert(!offline.node('share-game').disabled,'worker registration failure keeps online controls usable');}finally{offline.close();}
});

const gameBody=`<!doctype html><html><meta name="application-name" content="Hexrota"><section id="home-screen"></section><script src="./${versioned('app.js')}"></script></html>`;
const response=(body,type='text/html',status=200)=>new Response(body,{status,headers:{'Content-Type':type}});
function worker(options={}){
 const listeners=new Map(),stores=new Map(),requests=[],messages={skip:0,claim:0};let network=async()=>{throw new TypeError('Offline');};
 const key=value=>typeof value==='string'?new URL(value,'https://game.test/demo/').href:value.url;
 const cacheStorage={
  async open(name){if(options.openFails)throw new Error('Storage unavailable');if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {async put(request,res){if(options.putFails)throw new Error('Quota exceeded');data.set(key(request),res.clone());},async match(request){if(options.matchFails)throw new Error('Cache unavailable');return data.get(key(request))?.clone();}};},
  async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
 };
 const self={location:{href:'https://game.test/demo/sw.js'},registration:{scope:'https://game.test/demo/'},clients:{async claim(){messages.claim++;}},skipWaiting(){messages.skip++;},addEventListener(type,handler){listeners.set(type,handler);}};
 const context={self,caches:cacheStorage,URL,Request,Response,Headers,Promise,console,fetch:async request=>{requests.push(key(request));return network(request);}};
 vm.createContext(context);vm.runInContext(read('sw.js'),context);
 async function emit(type,data={}){const pending=[];let answer;const event={...data,waitUntil(value){pending.push(Promise.resolve(value));},respondWith(value){answer=Promise.resolve(value);}};listeners.get(type)?.(event);await Promise.all(pending);return answer?{handled:true,response:await answer}:{handled:false};}
 const assets=JSON.parse(vm.runInContext('JSON.stringify({core:ASSETS,optional:OPTIONAL_SCENE_ASSETS,warm:WARM_SCENE_ASSETS,preload:PRELOAD})',context));
 return {stores,requests,messages,cacheStorage,assets,setNetwork(value){network=value;},emit,async fetch(url,opts={}){return emit('fetch',{request:{url:new URL(url,'https://game.test/demo/').href,method:opts.method||'GET',mode:opts.navigate?'navigate':'cors',headers:new Headers()}});},async seed(url,res,name=shellCache){await(await cacheStorage.open(name)).put(url,res);}};
}

test('offline navigation serves only previously validated game HTML',async()=>{
 const sw=worker();sw.setNetwork(async()=>response(gameBody));const online=await sw.fetch('./',{navigate:true});assert.equal(await online.response.text(),gameBody);
 sw.setNetwork(async()=>{throw new Error('Offline');});const cached=await sw.fetch('index.html',{navigate:true});assert.equal(cached.response.status,200);assert.equal(await cached.response.text(),gameBody);
 for(const body of ['<html><title>Sign in</title><form>Log in to continue</form></html>','<meta name="application-name" content="Hexrota"><div>not the game</div>']){
  const fresh=worker();fresh.setNetwork(async()=>response(body));assert.equal((await fresh.fetch('./',{navigate:true})).response.status,200);
  fresh.setNetwork(async()=>{throw new Error('Offline');});assert.equal((await fresh.fetch('./',{navigate:true})).response.status,503,'login or incomplete HTML never becomes an offline game');
 }
 const redirected=worker();redirected.setNetwork(async()=>{const res=response(gameBody);Object.defineProperty(res,'redirected',{value:true});return res;});await redirected.fetch('./',{navigate:true});redirected.setNetwork(async()=>{throw new Error('Offline');});assert.equal((await redirected.fetch('./',{navigate:true})).response.status,503);
 const poisoned=worker();await poisoned.seed('https://game.test/demo/',response('<h1>Login</h1>'));assert.equal((await poisoned.fetch('./',{navigate:true})).response.status,503,'cached HTML is validated again before serving');
});

test('worker scope excludes API, authentication, foreign, mutation and query navigation requests',async()=>{
 const sw=worker();sw.setNetwork(async()=>response('should not fetch'));
 for(const [url,options] of [['https://other.test/demo/'+versioned('app.js'),{}],['https://game.test/elsewhere/'+versioned('app.js'),{}],['api/progress',{}],['login',{navigate:true}],['./?token=secret',{navigate:true}],['app.js?v=21',{}],[versioned('app.js')+'&session=private',{}],[versioned('app.js'),{method:'POST'}]]){
  const result=await sw.fetch(url,options);assert.equal(result.handled,false,url+' is left to the browser');
 }
 assert.equal(sw.requests.length,0);assert.equal(sw.stores.size,0);
});

test('versioned asset cache requires correct content types and preserves exact query keys',async()=>{
 const expectedScript=`window.testVersion=${shellVersion};`,sw=worker();sw.setNetwork(async()=>response(expectedScript,'application/javascript'));await sw.fetch(versioned('app.js'));
 sw.setNetwork(async()=>{throw new Error('Offline');});assert.equal(await(await sw.fetch(versioned('app.js'))).response.text(),expectedScript);
 assert.equal((await sw.fetch('app.js?v=18')).handled,false);await assert.rejects(sw.fetch('app.js'),/Offline/,'unversioned requests cannot reuse versioned bytes');
 const auth=worker();auth.setNetwork(async()=>response('<h1>Login</h1>','text/html'));const res=await auth.fetch(versioned('app.js'));assert.equal(await res.response.text(),'<h1>Login</h1>','online auth response is not disguised as a cache hit');
 auth.setNetwork(async()=>{throw new Error('Offline');});await assert.rejects(auth.fetch(versioned('app.js')),/Offline/,'login HTML under a script URL is never cached');
 const redirect=worker();redirect.setNetwork(async()=>{const res=response('evil','application/javascript');Object.defineProperty(res,'redirected',{value:true});return res;});await redirect.fetch(versioned('app.js'));assert.equal([...redirect.stores.values()].reduce((count,data)=>count+data.size,0),0);
});

test('cache quota and unavailable storage cannot discard successful online responses',async()=>{
 for(const options of [{putFails:true},{openFails:true}]){
  const sw=worker(options);sw.setNetwork(async request=>new URL(request.url).pathname.endsWith('.js')?response('const playable=true;','text/javascript'):response(gameBody));
  const asset=await sw.fetch(versioned('app.js'));assert.equal(asset.response.status,200);assert.equal(await asset.response.text(),'const playable=true;');
  assert.equal(await(await sw.fetch('./',{navigate:true})).response.text(),gameBody);
  sw.setNetwork(async()=>{throw new Error('Offline');});assert.equal((await sw.fetch('./',{navigate:true})).response.status,503);
 }
 const reads=worker({matchFails:true});assert.equal((await reads.fetch('./',{navigate:true})).response.status,503,'cache read failure has a friendly offline document');
});

test('install preloads only safe scoped assets, activation preserves other apps, update is explicit',async()=>{
 const sw=worker();sw.setNetwork(async request=>{
  const url=new URL(request.url);
  if(url.pathname.endsWith('.js'))return response('<h1>Sign in</h1>','text/html');
  if(url.pathname.endsWith('.css'))return response('body{}','text/css');
  return response('missing','text/plain',404);
 });
 await sw.emit('install');assert.equal(sw.messages.skip,0);assert(sw.requests.length>0);assert(sw.requests.every(url=>url.startsWith('https://game.test/demo/')));
 for(const [name,data] of sw.stores)for(const [url,res] of data){assert(url.endsWith(versioned('style.css')));assert.equal(res.headers.get('Content-Type'),'text/css');}
 await sw.seed('old',response('old'),'hexrota-shell-v1');await sw.seed('other',response('other'),'another-app-v1');await sw.emit('activate');assert(!sw.stores.has('hexrota-shell-v1'));assert(sw.stores.has('another-app-v1'));assert(sw.stores.has(shellCache));assert.equal(sw.messages.claim,1);assert.equal(sw.messages.skip,0);
 await sw.emit('message',{data:{type:'SKIP_WAITING'}});assert.equal(sw.messages.skip,1);
 const warm=worker();warm.setNetwork(async()=>response(gameBody));await warm.emit('message',{data:{type:'CACHE_APP'}});warm.setNetwork(async()=>{throw new Error('Offline');});assert.equal(await(await warm.fetch('./',{navigate:true})).response.text(),gameBody,'explicit shell warming validates and stores the real game');
});


const sceneRoot='assets/scenes/coop-v1/',sceneImage=file=>sceneRoot+file;
const sceneWarm=[sceneImage('backgrounds/clearing-mobile.webp'),sceneImage('tavik/idle.webp')];
const expectedSceneImages=[
 ...['clearing','frame','roof','finished'].flatMap(id=>['-mobile',''].map(suffix=>sceneImage('backgrounds/'+id+suffix+'.webp'))),
 ...['idle','hop','point','inspect','worried','celebrate','walk-pose','run-pose','carry','build','proud','think','call','rest'].map(id=>sceneImage('tavik/'+id+'.webp'))
];
function preparedSceneResponse(file){return response(fs.readFileSync(path.join(root,file)),'image/webp');}
async function assertSceneUnavailable(sw,file,message){
 const result=await sw.fetch(file);assert(result.handled);assert.equal(result.response.status,503,message);
 assert.equal(result.response.headers.get('cache-control'),'no-store');assert.match(result.response.headers.get('content-type'),/^text\/plain/);
 assert.equal(await result.response.text(),'Scene image unavailable offline');
 for(const data of sw.stores.values())for(const res of data.values())assert.notEqual(res.status,503,'optional failure responses are never cached');
}
function sceneNetwork(request){
 const file=new URL(request.url).pathname.slice('/demo/'.length);
 if(file.endsWith('.webp')&&file.startsWith(sceneRoot))return preparedSceneResponse(file);
 if(file.endsWith('.js'))return response('/* cached gameplay/presentation bootstrap */','application/javascript');
 if(file.endsWith('.css'))return response('body{}','text/css');
 if(file.endsWith('.json'))return response('{}','application/json');
 return response('missing','text/plain',404);
}
test('scene pack is demand-cacheable with only a bounded mobile background and idle warmup',async()=>{
 const sw=worker();assert.equal(sw.assets.optional.length,22);assert.deepEqual(sw.assets.optional.slice().sort(),expectedSceneImages.slice().sort());
 assert.deepEqual(sw.assets.warm,sceneWarm,'only the small clearing and idle are warmed');
 assert.equal(new Set([...sw.assets.core,...sw.assets.optional]).size,sw.assets.core.length+sw.assets.optional.length,'core and optional lists do not duplicate assets');
 const warmBytes=sw.assets.warm.reduce((sum,file)=>sum+fs.statSync(path.join(root,file)).size,0);
 assert.equal(warmBytes,133004,'prepared warmup bytes are measured from the real supplied assets');assert(warmBytes<135000,'scene art adds less than135KB to install warmup');
 for(const file of sw.assets.optional)assert(fs.existsSync(path.join(root,file)),file+' is provided');
 for(const file of ['scene-config.js','scene-config.json','scene-presentation.js',sceneRoot+'tavik-motion.js'])assert(sw.assets.core.includes(file),file+' is an offline runtime dependency');
 for(const url of sw.assets.preload){const file=new URL(url).pathname.slice('/demo/'.length);assert(!file.startsWith('art/')&&!file.endsWith('scene-assets-preview.html')&&!file.endsWith('tavik-motion.css')&&!(file.startsWith(sceneRoot)&&file.endsWith('.png')),'source PNGs, duplicate motion stylesheet and independent demo never enter startup');}
 sw.setNetwork(sceneNetwork);await sw.emit('install');
 const fetchedArt=sw.requests.map(url=>new URL(url).pathname.slice('/demo/'.length)).filter(file=>file.startsWith(sceneRoot)&&file.endsWith('.webp'));
 assert.deepEqual(fetchedArt,sceneWarm,'other backgrounds and poses are not fetched on install');
 sw.setNetwork(async()=>{throw new Error('Offline');});
 for(const file of sceneWarm){const result=await sw.fetch(file);assert(result.handled);assert.equal(result.response.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await result.response.arrayBuffer()),fs.readFileSync(path.join(root,file)),file+' is available offline after warmup');}
 await assertSceneUnavailable(sw,sceneImage('backgrounds/roof.webp'),'an unseen later background explicitly fails without falsely claiming cached art');
});

test('later prepared backgrounds and poses cache lazily with exact typed offline bytes',async()=>{
 const sw=worker();sw.setNetwork(sceneNetwork);await sw.emit('install');
 for(const file of expectedSceneImages.filter(file=>!sceneWarm.includes(file))){const result=await sw.fetch(file);assert(result.handled,file+' is explicitly allowed');assert.equal(result.response.headers.get('content-type'),'image/webp');}
 sw.setNetwork(async()=>{throw new Error('Offline');});
 for(const file of expectedSceneImages){const result=await sw.fetch(file);assert(result.handled);assert.deepEqual(Buffer.from(await result.response.arrayBuffer()),fs.readFileSync(path.join(root,file)),file+' preserves the actual prepared art bytes offline');}
 assert.equal((await sw.fetch('scene-assets-preview.html',{navigate:true})).handled,false,'the independent demonstration is not an offline game route');
 for(const file of ['art/coop-scene-v1/source/idle.png',sceneImage('tavik/idle.png'),sceneImage('tavik/friend.webp'),sceneImage('backgrounds/unlisted.webp'),sceneRoot+'tavik-motion.css',sceneRoot+'manifest.json'])assert.equal((await sw.fetch(file)).handled,false,file+' is outside the reviewed runtime allowlist');
});

test('optional scene art rejects auth HTML, redirects, poisoned caches and unapproved URL variants',async()=>{
 const file=sceneImage('tavik/point.webp');
 for(const invalid of [()=>response('<h1>Log in</h1>','text/html'),()=>response('not decoded image','application/octet-stream'),()=>response('missing','image/webp',404),()=>{const res=preparedSceneResponse(file);Object.defineProperty(res,'redirected',{value:true});return res;}]){
  const sw=worker();sw.setNetwork(async()=>invalid());await sw.fetch(file);sw.setNetwork(async()=>{throw new Error('Offline');});await assertSceneUnavailable(sw,file,'invalid art must never become an offline image');
 }
 const sw=worker();sw.setNetwork(sceneNetwork);await sw.fetch(file);sw.setNetwork(async()=>response('<h1>Authentication</h1>','text/html'));assert.equal(await(await sw.fetch(file)).response.text(),'<h1>Authentication</h1>','online failures remain visible to the image loader/fallback');
 sw.setNetwork(async()=>{throw new Error('Offline');});assert.deepEqual(Buffer.from(await(await sw.fetch(file)).response.arrayBuffer()),fs.readFileSync(path.join(root,file)),'a failed online auth response does not replace a previously valid cached image');
 const poisoned=worker();await poisoned.seed(file,response('<h1>Login</h1>','text/html'));await assertSceneUnavailable(poisoned,file,'cached MIME is validated again');
 const scoped=worker();scoped.setNetwork(async()=>{throw new Error('must not fetch');});
 for(const [url,options]of [[file+'?token=private',{}],[file+'?v='+shellVersion+'&token=private',{}],[file+'?v=1',{}],['https://other.test/demo/'+file,{}],['https://game.test/other/'+file,{}],[file,{method:'POST'}]])assert.equal((await scoped.fetch(url,options)).handled,false,url+' is not intercepted');
 assert.equal(scoped.requests.length,0,'excluded optional URLs never cause worker network reads');
});

test('missing or quota-failed optional scene art cannot fail installation or successful online play',async()=>{
 for(const kind of ['offline','auth','404']){
  const sw=worker();sw.setNetwork(async request=>{const file=new URL(request.url).pathname.slice('/demo/'.length);if(sceneWarm.includes(file)){if(kind==='offline')throw new Error('Optional image unavailable');return kind==='auth'?response('<h1>Log in</h1>','text/html'):response('missing','image/webp',404);}return sceneNetwork(request);});
  await sw.emit('install');assert.equal(sw.messages.skip,0,'optional art failure never auto-replaces a live game');
  sw.setNetwork(async()=>{throw new Error('Offline');});assert.equal(await(await sw.fetch(versioned('engine.js'))).response.text(),'/* cached gameplay/presentation bootstrap */','the core shell is still installed when optional art fails');
  for(const file of sceneWarm)await assertSceneUnavailable(sw,file,'missing scene art is left to the module static fallback');
 }
 for(const options of [{putFails:true},{openFails:true}]){
  const sw=worker(options);sw.setNetwork(sceneNetwork);const file=sceneImage('backgrounds/finished-mobile.webp'),result=await sw.fetch(file);assert.equal(result.response.status,200);assert.deepEqual(Buffer.from(await result.response.arrayBuffer()),fs.readFileSync(path.join(root,file)),'unavailable cache cannot discard a successful prepared image');
 }
});

(async()=>{
 let failed=0;
 for(const {name,run} of tests){try{await run();console.log('✓ '+name);}catch(error){failed++;console.error('✗ '+name+'\n'+error.stack);}}
 await settle();if(unhandled.length){failed++;console.error('Unhandled promises:',unhandled);}
 if(failed)process.exitCode=1;else console.log('PWA checks passed: manifest/icons, installation, real modal flow, sharing, fullscreen, approved updates and safe offline caching.');
})().catch(error=>{console.error(error);process.exitCode=1;});
