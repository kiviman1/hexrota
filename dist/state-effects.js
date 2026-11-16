/* DOM/history effects for the transient application state. No game, receipt,
 * clock, storage or persistence dependencies belong in this adapter. */
(function(root){
 'use strict';
 function create(options={}){
  const doc=options.document||root.document,win=options.window||doc?.defaultView||root,state=options.state;
  if(!doc||!state||!['snapshot','preview','dispatch','subscribe'].every(name=>typeof state[name]==='function'))throw new TypeError('State effects require a document and state store');
  let disposed=false;const handles=new Map(),acknowledgements=new Map(),closeOptions=new Map(),nativeClosing=new Set(),failed=new Map(),listeners=[],temporaryFocus=new Map();
  const report=(type,error,modal)=>{try{options.onError?.({type,error,id:modal?.id||null,instance:modal?.instance||null});}catch(_){}};
  const facts=override=>{if(override!==undefined)return override;try{return options.getFacts?.()||{};}catch(error){report('facts.read',error);return {blocked:true};}};
  const snapshot=()=>state.snapshot(),record=id=>snapshot().overlays.modals.find(modal=>modal.id===id)||null;
  const dialogFor=value=>{const node=typeof value==='string'?doc.getElementById(value):value;return node?.tagName==='DIALOG'?node:null;};
  const result=(reason,accepted=false)=>Object.freeze({accepted,changed:false,reason,state:snapshot(),effects:[]});
  function rememberFailure(modal,error){failed.set(modal.instance,error);if(failed.size>32)failed.delete(failed.keys().next().value);}
  function acknowledgeLater(dialog,instance){let queue=acknowledgements.get(dialog);if(!queue)acknowledgements.set(dialog,queue=[]);queue.push(instance);if(queue.length>32)queue.shift();}
  function forgetAcknowledgement(dialog,instance){const queue=acknowledgements.get(dialog),index=queue?.lastIndexOf(instance)??-1;if(index>=0)queue.splice(index,1);if(queue&&!queue.length)acknowledgements.delete(dialog);}
  function syncModalClass(){doc.body?.classList.toggle('modal-open',!!topDialog());}
  function topDialog(){
   for(const modal of [...snapshot().overlays.modals].reverse()){const dialog=dialogFor(modal.id);if(dialog?.open)return dialog;}
   // Native geometry probes and an optional platform fallback may open a dialog
   // outside the command adapter. Treat it as a defensive input barrier, never
   // as authority to bypass OPEN_MODAL guards or award a provider result.
   return [...doc.querySelectorAll('dialog[open]')].at(-1)||null;
  }
  function focusable(node){
   if(!node?.isConnected||typeof node.focus!=='function'||node.disabled)return false;
   for(let current=node;current?.nodeType===1;current=current.parentElement){
    if(current.hidden||current.inert||current.hasAttribute('inert'))return false;
    try{const style=win.getComputedStyle(current);if(style.display==='none'||style.visibility==='hidden')return false;}catch(_){}
   }
   return true;
  }
  function focus(node){if(!focusable(node))return false;try{node.focus({preventScroll:true});return doc.activeElement===node;}catch(error){report('focus.restore',error);return false;}}
  function focusContainer(node){
   if(!node)return;
   const target=node.querySelector('[autofocus],h1,h2,button:not([disabled]),a[href]')||node;
   if(typeof target.focus!=='function')return;
   if(!target.hasAttribute('tabindex')&&!/^(?:BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)){
    temporaryFocus.set(target,null);target.setAttribute('tabindex','-1');
   }
   focus(target);
  }
  function restoreFocus(handle){
   const top=topDialog(),opener=handle?.opener;
   if(focusable(opener)&&(!top||top.contains(opener))&&focus(opener))return;
   if(top&&!top.contains(doc.activeElement))focusContainer(top);
  }
  function notify(handle,reason){
   if(handle.notified||disposed)return;handle.notified=true;
   const callback=()=>options.onClose?.({id:handle.modal.id,instance:handle.modal.instance,reason});
   try{if(options.runAction)options.runAction(callback);else callback();}catch(error){report('modal.closed_callback',error,handle.modal);}
  }
  function openEffect(modal){
   const dialog=dialogFor(modal.id);if(!dialog){
    const error=new Error('Dialog element is unavailable');rememberFailure(modal,error);report('modal.open',error,modal);state.dispatch({type:'CLOSE_MODAL',id:modal.id,instance:modal.instance},facts());return;
   }
   const old=handles.get(dialog),handle={modal,opener:old?.opener||doc.activeElement,notified:false,opened:false};handles.set(dialog,handle);
   try{if(!dialog.open){if(typeof dialog.showModal!=='function')throw new Error('Native modal API is unavailable');dialog.showModal();}if(!dialog.open)throw new Error('Native modal did not open');handle.opened=true;syncModalClass();}
   catch(error){
    rememberFailure(modal,error);report('modal.open',error,modal);
    closeOptions.set(modal.instance,{notify:false,restoreFocus:false});state.dispatch({type:'CLOSE_MODAL',id:modal.id,instance:modal.instance},facts());
   }
  }
  function closeEffect(modal,event,restoreLast){
   const dialog=dialogFor(modal.id),handle=dialog&&handles.get(dialog),settings=closeOptions.get(modal.instance)||{};closeOptions.delete(modal.instance);
   if(!dialog||!handle||handle.modal.instance!==modal.instance){syncModalClass();return;}
   const restore=settings.restoreFocus??(event.type==='CLOSE_MODAL'||restoreLast);
   if(dialog.open){
    acknowledgeLater(dialog,modal.instance);
    try{if(typeof dialog.close!=='function')throw new Error('Native modal API is unavailable');dialog.close();}
    catch(error){
     report('modal.close',error,modal);
     if(dialog.open){
      forgetAcknowledgement(dialog,modal.instance);rememberFailure(modal,error);
      // A failed native close leaves a visible barrier. Restore the ordinary
      // modal through the same guarded transition where its parent allows it.
      // The native fallback remains blocking if a platform error prevents that.
      state.dispatch({type:'OPEN_MODAL',id:modal.id},facts());syncModalClass();return;
     }
    }
   }else if(handle.opened&&!nativeClosing.has(modal.instance))acknowledgeLater(dialog,modal.instance);
   handles.delete(dialog);syncModalClass();
   if(settings.notify!==false)notify(handle,settings.reason||'closed');
   if(restore&&!disposed)restoreFocus(handle);
  }
  function restoreModalOrder(id){
   const modals=snapshot().overlays.modals,index=modals.findIndex(modal=>modal.id===id);if(index<0)return false;
   const affected=modals.slice(index),active=doc.activeElement;
   // Only a native bypass can get here: the pure transition refused to orphan
   // a required child after its parent was already closed outside this adapter.
   // Restore the same instances/order, without producing domain close callbacks.
   try{
    for(const modal of affected.slice(1).reverse()){
     const dialog=dialogFor(modal.id);if(!dialog?.open)continue;
     acknowledgeLater(dialog,modal.instance);
     try{dialog.close();}catch(error){forgetAcknowledgement(dialog,modal.instance);throw error;}
    }
    for(const modal of affected){const dialog=dialogFor(modal.id);if(!dialog)throw new Error('Dialog element is unavailable');if(!dialog.open)dialog.showModal();if(!dialog.open)throw new Error('Native modal did not open');const handle=handles.get(dialog);if(handle)handle.opened=true;}
    syncModalClass();const top=topDialog();if(top?.contains(active)&&focusable(active))focus(active);else if(top&&!top.contains(doc.activeElement))focusContainer(top);return true;
   }catch(error){report('modal.native_restore',error,affected[0]);syncModalClass();return false;}
  }
  const unsubscribe=state.subscribe((change,previous,event)=>{
   if(disposed||!change.accepted)return;
   const closing=change.effects.filter(effect=>effect.type==='modal.close'),last=closing.at(-1)?.modal.instance;
   for(const effect of change.effects){
    if(disposed)break;
    if(effect.type==='modal.open')openEffect(effect.modal);
    else if(effect.type==='modal.close')closeEffect(effect.modal,event,event.type==='CLOSE_ALL'&&closeOptions.get('all')?.restoreFocus&&last===effect.modal.instance);
   }
   if(event.type==='CLOSE_ALL')closeOptions.delete('all');
  });
  function nativeClose(dialog){
   if(disposed)return;
   const queue=acknowledgements.get(dialog);
   if(queue?.length){queue.shift();if(!queue.length)acknowledgements.delete(dialog);syncModalClass();return;}
   const handle=handles.get(dialog),current=record(dialog.id);
   // close events have no native instance payload. An older queued close must
   // not affect an already reopened dialog or clear its newer pending request.
   if(dialog.open||!handle||!current||current.instance!==handle.modal.instance){syncModalClass();return;}
   nativeClosing.add(current.instance);
   try{const change=state.dispatch({type:'CLOSE_MODAL',id:current.id,instance:current.instance},facts());if(!change.accepted&&!change.queued)restoreModalOrder(current.id);}finally{nativeClosing.delete(current.instance);}
  }
  for(const dialog of doc.querySelectorAll('dialog')){const listener=()=>nativeClose(dialog);dialog.addEventListener('close',listener);listeners.push([dialog,listener]);}
  function canOpen(id,override){
   if(disposed||!dialogFor(id))return false;
   const foreign=topDialog();if(foreign&&!record(foreign.id))return false;
   return state.preview({type:'OPEN_MODAL',id},facts(override)).accepted===true;
  }
  function open(id,override){
   if(disposed)return result('disposed');
   const dialog=dialogFor(id);if(!dialog)return result('missing_dialog');
   const foreign=topDialog();if(foreign&&!record(foreign.id))return result('unmanaged_modal');
   const current=record(id);
   if(current&&!dialog.open){
    // A required parent cannot be removed while its child remains open. Repair
    // that same native opening instead of allocating an invalid replacement.
    if(snapshot().overlays.modals.at(-1).instance!==current.instance){if(!restoreModalOrder(id))return result('effect_failed');return result('native_restored',true);}
    // The user closed it natively, but its queued close event has not run yet.
    // Starting another opening supersedes cleanup for that obsolete request.
    closeOptions.set(current.instance,{notify:false,restoreFocus:false,reason:'superseded'});
    const closed=state.dispatch({type:'CLOSE_MODAL',id,instance:current.instance},facts(override));if(!closed.accepted&&!closed.queued)return closed;
   }
   const change=state.dispatch({type:'OPEN_MODAL',id},facts(override)),modal=record(id);
   if(modal&&failed.has(modal.instance)){failed.delete(modal.instance);return result('effect_failed');}
   const failedEffect=change.effects?.find(effect=>effect.type==='modal.open'&&failed.has(effect.modal.instance));
   if(failedEffect){failed.delete(failedEffect.modal.instance);return result('effect_failed');}
   return change;
  }
  function close(value,{internal=false,restoreFocus:restore=true}={}){
   if(disposed)return result('disposed');
   const dialog=dialogFor(value);if(!dialog)return result('missing_dialog');
   const current=record(dialog.id);
   if(!internal&&topDialog()!==dialog)return result(current?'not_top_modal':'already_closed',!current);
   if(!current){
    if(dialog.open)try{dialog.close();syncModalClass();return result('unmanaged_closed',true);}catch(error){report('modal.close',error);return result('effect_failed');}
    return result('already_closed',true);
   }
   closeOptions.set(current.instance,{restoreFocus:restore});
   const change=state.dispatch({type:'CLOSE_MODAL',id:current.id,instance:current.instance},facts());
   if(!change.accepted&&!change.queued)closeOptions.delete(current.instance);
   if(failed.has(current.instance)){failed.delete(current.instance);return result('effect_failed');}
   return change;
  }
  function closeAll({restoreFocus:restore=false}={}){
   if(disposed)return result('disposed');closeOptions.set('all',{restoreFocus:restore});
   const change=state.dispatch({type:'CLOSE_ALL'},facts());
   if(!change.changed&&!change.queued)closeOptions.delete('all');
   // Native platform fallbacks are also removed on an explicit navigation
   // boundary, but are never adopted into the state command policy.
   for(const dialog of [...doc.querySelectorAll('dialog[open]')].reverse())if(!record(dialog.id))try{dialog.close();}catch(error){report('modal.close',error);}
   syncModalClass();const failedEffect=change.effects?.find(effect=>effect.type==='modal.close'&&failed.has(effect.modal.instance));if(failedEffect){failed.delete(failedEffect.modal.instance);return result('effect_failed');}return change;
  }
  function renderScreen(screen,{historyChange=true,replace=false}={}){
   if(disposed)return result('disposed');
   if(snapshot().navigation.screen!==screen)return result('unaccepted_navigation');
   const target=doc.getElementById(screen+'-screen'),screens=[...doc.querySelectorAll('.app-screen')];
   if(!target||!screens.includes(target))return result('missing_screen');
   const previous=doc.body.dataset.screen,active=doc.activeElement;
   for(const node of screens){node.hidden=node!==target;node.inert=node!==target;}
   doc.body.dataset.screen=screen;
   for(const button of doc.querySelectorAll('[data-nav]')){const current=button.dataset.nav===screen;button.classList.toggle('is-active',current);if(current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
   if(active?.closest?.('.app-screen')?.hidden||active!==doc.body&&!focusable(active))focusContainer(target);
   if(historyChange&&(replace||previous!==screen))try{win.history[replace?'replaceState':'pushState']({screen},'','#'+screen);}catch(error){report('navigation.history',error);}
   doc.documentElement.scrollTop=0;if(doc.body)doc.body.scrollTop=0;
   return result('rendered',true);
  }
  function destroy(){
   if(disposed)return;disposed=true;unsubscribe();
   for(const [dialog,listener]of listeners)dialog.removeEventListener('close',listener);
   for(const [node,value]of temporaryFocus)if(value===null)node.removeAttribute('tabindex');else node.setAttribute('tabindex',value);
   handles.clear();acknowledgements.clear();closeOptions.clear();nativeClosing.clear();failed.clear();temporaryFocus.clear();
  }
  return Object.freeze({canOpen,open,close,closeAll,topDialog,renderScreen,destroy});
 }
 const api=Object.freeze({create});root.HexStateEffects=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
