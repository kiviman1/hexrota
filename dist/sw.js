/* A scoped offline shell. Authentication pages and arbitrary requests are never cached. */
'use strict';
const CACHE='hexrota-shell-v22';
const BASE=new URL('./',self.location.href);
const ASSETS=['style.css','engine.js','levels.js','tutorials.js','variants.json','variants-data.js','difficulty-rules.json','attempts.js','events.js','lives-config.json','lives-config.js','lives.js','life-providers.js','playtest.js','reward-rules.json','reward-rules.js','rewards.js','reward-adapter.js','audio.js','session-store.js','app.js','hint-worker.js','pwa.js','manifest.webmanifest','favicon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
const ALLOWED=new Set(ASSETS.map(path=>new URL(path,BASE).pathname));
const HOME=new URL('./',BASE).href;
const PRELOAD=ASSETS.map(path=>new URL(/\.(?:js|css)$/.test(path)?path+'?v=22':path,BASE).href);
function assetType(url,response){
  if(!response||response.status!==200||response.redirected||response.type==='opaqueredirect')return false;
  const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),path=url.pathname;
  if(path.endsWith('.js'))return ['application/javascript','text/javascript','application/x-javascript'].includes(type);
  if(path.endsWith('.css'))return type==='text/css';
  if(path.endsWith('.svg'))return type==='image/svg+xml';
  if(path.endsWith('.png'))return type==='image/png';
  if(path.endsWith('.json'))return type==='application/json';
  if(path.endsWith('.webmanifest'))return ['application/manifest+json','application/json'].includes(type);
  return false;
}
async function gameHtml(response){
  if(!response||response.status!==200||response.redirected||response.type==='opaqueredirect'||!(response.headers.get('content-type')||'').toLowerCase().includes('text/html'))return false;
  try{
    const text=await response.clone().text();
    return /name=["']application-name["'][^>]*content=["']Hexrota["']/.test(text)&&/id=["']home-screen["']/.test(text)&&/src=["'][^"']*app\.js(?:\?[^"']*)?["']/.test(text);
  }catch(_){return false;}
}
async function save(request,response){try{const cache=await caches.open(CACHE);await cache.put(request,response.clone());}catch(_){/* Storage limits must never interrupt online play. */}}
async function stored(request){try{return await(await caches.open(CACHE)).match(request);}catch(_){return undefined;}}
async function storeAsset(request,response){const url=new URL(request.url);if(assetType(url,response))await save(request,response);return response;}
async function warmHome(){
  try{const response=await fetch(new Request(HOME,{credentials:'same-origin',cache:'reload'}));if(await gameHtml(response))await save(HOME,response);}catch(_){}
}
self.addEventListener('install',event=>{
  event.waitUntil(Promise.all(PRELOAD.map(async url=>{try{const request=new Request(url,{credentials:'same-origin',cache:'reload'});await storeAsset(request,await fetch(request));}catch(_){}})));
  // An update waits for explicit approval instead of replacing an active game.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{try{await Promise.all((await caches.keys()).filter(name=>name.startsWith('hexrota-shell-')&&name!==CACHE).map(name=>caches.delete(name)));}catch(_){}await self.clients.claim();})());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CACHE_APP')event.waitUntil?.(warmHome());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const homePath=BASE.pathname,indexPath=new URL('index.html',BASE).pathname;
  if(request.mode==='navigate'&&(url.pathname===homePath||url.pathname===indexPath)&&!url.search){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(await gameHtml(response))await save(HOME,response);
        return response;
      }catch(_){
        const saved=await stored(HOME);
        if(saved&&await gameHtml(saved))return saved;
        return new Response('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hexrota</title><body><h1>Bağlantı gerekiyor</h1><p>Oyunu ilk kez açmak için internete bağlan. Ardından yeniden dene.</p><button onclick="location.reload()">Yeniden dene</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
    })());return;
  }
  if(!ALLOWED.has(url.pathname))return;
  if(url.search&&url.search!=='?v=22')return;
  event.respondWith((async()=>{
    try{return await storeAsset(request,await fetch(request));}
    catch(_){const saved=await stored(request);if(saved&&assetType(url,saved))return saved;throw _;}
  })());
});
