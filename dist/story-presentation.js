/* Disposable story card. The host owns persistence, modal instances and every
 * acknowledgement. Rendering, assets and late callbacks grant no progress. */
(function(root){
 'use strict';
 const poses=new Set(['idle','point','call','celebrate']);
 function create({dialog,document:doc=dialog?.ownerDocument,onAction,reducedMotion=()=>false}={}){
  if(!dialog||!doc||typeof onAction!=='function')throw new TypeError('invalid_story_presenter');
  const find=id=>dialog.querySelector('#'+id);let current=null,serial=0,disposed=false,actor=null;
  function clear(){serial++;current=null;actor?.destroy();actor=null;find('story-portrait').replaceChildren();find('story-actions').replaceChildren();dialog.removeAttribute('data-story-instance');dialog.removeAttribute('data-story-node');}
  function render(model,token){
   if(disposed)return false;if(!model||!poses.has(model.pose)||!Array.isArray(model.choices)||typeof model.text!=='string')throw new TypeError('invalid_story_projection');
   clear();const own=++serial,identity=Object.freeze({...token});current={own,identity};
   dialog.dataset.storyInstance=model.instanceId;dialog.dataset.storyNode=model.nodeId;dialog.dataset.reducedMotion=String(!!reducedMotion());
   find('story-speaker').textContent=model.speakerName;find('story-text').textContent=model.text;
   const portrait=find('story-portrait'),win=doc.defaultView;
   const fallback=()=>{if(disposed||current?.own!==own)return;actor?.destroy();actor=null;const image=doc.createElement('img');image.alt='';image.width=60;image.height=75;image.src='./assets/scenes/coop-v1/tavik/'+model.pose+'.webp';image.onerror=()=>{if(current?.own===own&&image.getAttribute('src')!=='./assets/characters/tavik/front.webp')image.src='./assets/characters/tavik/front.webp';};portrait.replaceChildren(image);};
   if(win.HexTavikMotion?.mount){
    try{actor=win.HexTavikMotion.mount(portrait,{assetBase:'./assets/scenes/coop-v1/',reducedMotion:!!reducedMotion(),onError:fallback});const ownActor=actor;Promise.resolve(ownActor.play(model.pose)).then(ok=>{if(current?.own===own&&actor===ownActor&&!ok)fallback();}).catch(fallback);}catch(_){fallback();}
   }else fallback();
   const scene=find('story-scene'),asset=model.sceneAsset;
   if(asset&&/^assets\/scenes\/(?:coop-v1|tutorial-coop-v1)\/[a-z0-9/_-]+\.(?:webp|jpg)(?![\s\S])/.test(asset)){scene.src='./'+asset;scene.hidden=false;scene.onerror=()=>{if(current?.own===own)scene.hidden=true;};}else{scene.hidden=true;scene.removeAttribute('src');}
   const actions=find('story-actions'),choices=doc.createElement('div');choices.id='story-choices';
   function button(id,text,kind,choiceId){
    const node=doc.createElement('button');if(id)node.id=id;node.type='button';node.textContent=text;node.className=kind==='skip'?'story-skip':'story-action';if(choiceId)node.dataset.storyChoice=choiceId;
    node.addEventListener('click',()=>{if(disposed||current?.own!==own||!node.isConnected||!dialog.open)return;try{onAction(Object.freeze({kind,choiceId:choiceId||null,...identity}));}catch(_){/* The same card remains retryable; a view callback cannot advance story. */}});return node;
   }
   for(const choice of model.choices)choices.append(button(null,choice.text,'choice',choice.id));actions.append(choices);
   if(!model.choices.length)actions.append(button('story-ack','Devam et','ack'));
   actions.append(button('story-skip','Atla','skip'));return true;
  }
  function destroy(){if(disposed)return;clear();disposed=true;find('story-portrait').replaceChildren();find('story-scene').removeAttribute('src');}
  return Object.freeze({render,clear,destroy});
 }
 const api=Object.freeze({create});root.HexStoryPresentation=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
