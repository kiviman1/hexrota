// Rasterize the mobile UI symbols from their original SVG paths for native uGUI.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const writeDir = path.join(root, 'unity-client/Assets/Hexrota/Resources/PhoneArt');
const icons = [...read('dist/index.html').matchAll(/<symbol id="i-([^"]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)]
  .map(([,name,box,body]) => ({name,box,body}));
const hand = read('dist/board-view.js').match(/class="tutorial-guide-hand"[^>]*><path d="([^"]+)"/);
if (icons.length === 0 || !hand) throw new Error('Mobile icon sources missing');
icons.push({name:'guide-hand',box:'-8 -12 32 32',body:'<path fill="#fff6da" stroke="#234a37" stroke-width="1.4" d="'+hand[1]+'"/>'});
if (icons.length > 32) throw new Error('Increase atlas capacity');
const tiles = icons.map(({box,body},i) => `<svg x="${i%8*128+4}" y="${Math.floor(i/8)*128+4}" width="120" height="120" viewBox="${box}" fill="none" stroke="white" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`).join('');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512" width="1024" height="512">'+tiles+'</svg>';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-phone-icons-'));
try {
  const file = path.join(tmp,'render.html');
  fs.writeFileSync(file,'<canvas width="1024" height="512"></canvas><pre></pre><script>const img=new Image();img.onload=()=>{const c=document.querySelector("canvas");c.getContext("2d").drawImage(img,0,0);document.querySelector("pre").textContent=c.toDataURL("image/png")};img.src="data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')+'"</script>');
  const chrome = process.env.CHROME_PATH || require('playwright').chromium.executablePath();
  const out = spawnSync(chrome,['--headless=new','--disable-background-networking','--no-first-run','--user-data-dir='+path.join(tmp,'profile'),'--virtual-time-budget=2000','--dump-dom',pathToFileURL(file).href],{encoding:'utf8',maxBuffer:12e6,windowsHide:true});
  const png = (out.stdout || '').match(/<pre>data:image\/png;base64,([^<]+)<\/pre>/);
  if (out.status !== 0 || !png) throw new Error('Chromium did not produce the icon atlas: '+(out.error || out.status));
  fs.mkdirSync(writeDir,{recursive:true});
  fs.writeFileSync(path.join(writeDir,'Icons.png'),Buffer.from(png[1],'base64'));
  fs.writeFileSync(path.join(writeDir,'IconNames.txt'),icons.map(i=>i.name).join('\n')+'\n');
} finally { fs.rmSync(tmp,{recursive:true,force:true,maxRetries:4,retryDelay:100}); }
