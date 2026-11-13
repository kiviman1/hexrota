/* Install, share and fullscreen support; all actions remain optional. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const installButton=$('install-app'),shareButton=$('share-game'),fullscreenButton=$('fullscreen-game'),updateButton=$('app-update');
  const status=$('pwa-status');
  let installPrompt=null,registration=null,updateRequested=false;
  const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
  const applicationUrl=()=>new URL(location.pathname,location.origin).href;
  function say(message){if(status)status.textContent=message;}
  function showInstall(){
    const instructions=$('install-instructions');
    const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
    if(instructions)instructions.textContent=appleMobile?'Safari’de Paylaş düğmesine, ardından Ana Ekrana Ekle’ye dokun. Uygulama simgesinden tam ekran açabilirsin.':'Tarayıcının menüsünden Uygulamayı yükle veya Ana ekrana ekle seçeneğini kullan. Seçenek görünmüyorsa oyunu bağlantıyla oynamaya devam edebilirsin.';
    const event=new CustomEvent('hexrota:open-dialog',{detail:{id:'install-dialog'},cancelable:true});
    document.dispatchEvent(event);
    const dialog=$('install-dialog');
    if(!event.defaultPrevented&&dialog&&!dialog.open)dialog.showModal?.();
  }
  function refreshControls(){
    const installed=standalone();
    if(installButton)installButton.hidden=installed;
    if(fullscreenButton){
      fullscreenButton.hidden=installed||typeof document.documentElement.requestFullscreen!=='function';
      const label=document.fullscreenElement?'Tam ekrandan çık':'Tam ekran';
      const text=[...fullscreenButton.childNodes].find(node=>node.nodeType===3);
      if(text)text.textContent=' '+label;else fullscreenButton.append(document.createTextNode(label));
      fullscreenButton.setAttribute('aria-pressed',String(!!document.fullscreenElement));
    }
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refreshControls();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;if(installButton)installButton.hidden=true;say('Hexrota ana ekranına eklendi.');});
  installButton?.addEventListener('click',async()=>{
    if(standalone()){refreshControls();return;}
    const prompt=installPrompt;installPrompt=null;
    if(!prompt){showInstall();return;}
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted'){installButton.hidden=true;say('Kurulum isteği onaylandı.');}else say('Kurulum iptal edildi; bağlantıyla oynamaya devam edebilirsin.');}
    catch(_){showInstall();}
  });
  shareButton?.addEventListener('click',async()=>{
    const url=applicationUrl();
    if(typeof navigator.share==='function')try{await navigator.share({title:'Hexrota',text:'İki öğretici ve on bölümlük altıgen sayı bulmacasını dene.',url});say('Paylaşım tamamlandı.');return;}catch(error){if(error?.name==='AbortError')return;}
    if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(url);say('Oyun bağlantısı kopyalandı. Arkadaşına gönderebilirsin.');return;}catch(_){}
    let field=$('share-url');
    if(!field&&status){field=document.createElement('input');field.id='share-url';field.type='url';field.readOnly=true;field.setAttribute('aria-label','Oyun bağlantısı');status.after(field);}
    if(field){field.hidden=false;field.value=url;field.focus();field.select();}
    say('Bağlantıyı seçip kopyalayabilirsin.');
  });
  fullscreenButton?.addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();refreshControls();}
    catch(_){say('Bu tarayıcı tam ekranı açamadı. Ana ekrana ekleyerek uygulama görünümünü deneyebilirsin.');}
  });
  document.addEventListener('fullscreenchange',refreshControls);
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',refreshControls);
  function offerUpdate(){if(registration?.waiting&&updateButton){updateButton.hidden=false;say('Yeni sürüm hazır. Güncelle düğmesiyle açabilirsin; ilerlemen korunur.');}}
  updateButton?.addEventListener('click',()=>{
    if(!registration?.waiting)return;
    updateRequested=true;updateButton.disabled=true;registration.waiting.postMessage({type:'SKIP_WAITING'});
  });
  if('serviceWorker'in navigator&&window.isSecureContext!==false){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();});
    const warm=worker=>worker?.postMessage({type:'CACHE_APP'});
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(result=>{
      registration=result;offerUpdate();warm(result.active);
      result.addEventListener('updatefound',()=>{
        const worker=result.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();if(worker.state==='activated')warm(result.active);});
      });
      return navigator.serviceWorker.ready;
    }).then(result=>warm(result?.active)).catch(()=>{/* Online play stays available if installation is unsupported. */});
  }
  refreshControls();
})();
