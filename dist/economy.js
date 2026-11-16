/* Pure one-clear progression and virtual economy. No storage, clock, SDK or UI. */
(function(root){
 'use strict';
 const ITEMS=Object.freeze(['greenBrush','colorKey']);
 // Published grant version: its historical value remains 20 Gold.
 const WELCOME=Object.freeze({version:'onboarding-v1',gold:20});
 const copy=value=>JSON.parse(JSON.stringify(value));
 const map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 const token=value=>typeof value==='string'&&value.length>0&&value.length<=180&&!/[^A-Za-z0-9_.:-]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
 const exact=(value,fields)=>map(value)&&Object.keys(value).length===fields.length&&fields.every(field=>Object.prototype.hasOwnProperty.call(value,field));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function fail(code){const error=new Error(code);error.code=code;throw error;}
 function need(condition,code){if(!condition)fail(code);}
 function validateConfig(config){
  const fields=['schemaVersion','rulesVersion','pricesVersion','campaignId','levelIds','tutorialIds','tutorialCount','reward','inventory','rescue','botanical'];
  need((exact(config,fields)||exact(config,[...fields,'welcome']))&&config.schemaVersion===1&&config.rulesVersion==='economy-v1'&&token(config.pricesVersion)&&token(config.campaignId),'invalid_economy_config');
  need(Array.isArray(config.levelIds)&&config.levelIds.length>0&&config.levelIds.every((id,index)=>integer(id)&&id>0&&(!index||id>config.levelIds[index-1]))&&Array.isArray(config.tutorialIds)&&config.tutorialIds.length===2&&config.tutorialIds.every(token)&&new Set(config.tutorialIds).size===2&&config.tutorialCount===2,'invalid_economy_config');
  if(Object.prototype.hasOwnProperty.call(config,'welcome'))need(exact(config.welcome,['version','gold'])&&config.welcome.version===WELCOME.version&&config.welcome.gold===WELCOME.gold,'invalid_economy_config');
  need(exact(config.reward,['gold','stars'])&&config.reward.gold===20&&config.reward.stars===1&&exact(config.inventory,ITEMS),'invalid_economy_config');
  for(const item of ITEMS){const entry=config.inventory[item];need(exact(entry,['unlockAfterLevelId','gift','costGold','maxPerAttempt'])&&config.levelIds.includes(entry.unlockAfterLevelId)&&entry.gift===3&&integer(entry.costGold)&&entry.costGold>0&&integer(entry.maxPerAttempt)&&entry.maxPerAttempt>0&&entry.maxPerAttempt<=10,'invalid_economy_config');}
  need(config.inventory.greenBrush.unlockAfterLevelId===3&&config.inventory.colorKey.unlockAfterLevelId===6,'invalid_economy_config');
  need(exact(config.rescue,['moves','goldCost','dailyAdLimit','maxPerAttempt'])&&config.rescue.moves===5&&integer(config.rescue.goldCost)&&config.rescue.goldCost>0&&integer(config.rescue.dailyAdLimit)&&config.rescue.dailyAdLimit>0&&config.rescue.maxPerAttempt===1,'invalid_economy_config');
  need(Array.isArray(config.botanical)&&config.botanical.length===4&&config.botanical.every((entry,index)=>exact(entry,['stars','id'])&&entry.stars===[2,5,8,10][index]&&entry.id===['flowers','plants','trees','complete'][index]),'invalid_economy_config');return true;
 }
 function createManager(input){
  if(input===undefined||input===null)input=root.HEX_ECONOMY_CONFIG||(typeof module==='object'&&module.exports?require('./economy-config.js'):undefined);
  validateConfig(input);const config=copy(input),known=id=>Number.isSafeInteger(id)&&config.levelIds.includes(id);
  const sorted=values=>config.levelIds.filter(id=>values.includes(id));
  const idList=value=>Array.isArray(value)&&value.every(known)&&same(value,sorted(value));
  const next=cleared=>config.levelIds.find(id=>!cleared.includes(id))??null;
  const clearId=id=>`clear:${config.campaignId}:${id}`,giftId=(id,item)=>`gift:${config.campaignId}:${id}:${item}`;
  const welcome=config.welcome||WELCOME,welcomeId=`welcome:${config.campaignId}:${welcome.version}`;
  function createState(){return {schemaVersion:1,rulesVersion:'economy-v1',campaignId:config.campaignId,clearedLevelIds:[],claimedLevelIds:[],gold:0,stars:0,inventory:{greenBrush:0,colorKey:0},migration:{schemaVersion:1,source:'new',recognizedLevelIds:[],verifiedLevelIds:[]},transactions:{}};}
  function validate(state){
   need(exact(state,['schemaVersion','rulesVersion','campaignId','clearedLevelIds','claimedLevelIds','gold','stars','inventory','migration','transactions'])&&state.schemaVersion===1&&state.rulesVersion==='economy-v1'&&state.campaignId===config.campaignId&&idList(state.clearedLevelIds)&&idList(state.claimedLevelIds)&&integer(state.gold)&&integer(state.stars)&&exact(state.inventory,ITEMS)&&ITEMS.every(item=>integer(state.inventory[item]))&&map(state.transactions),'invalid_economy_state');
   const migration=state.migration;
   need(exact(migration,['schemaVersion','source','recognizedLevelIds','verifiedLevelIds'])&&migration.schemaVersion===1&&['new','hexrota-match-v5','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'].includes(migration.source)&&idList(migration.recognizedLevelIds)&&idList(migration.verifiedLevelIds)&&migration.verifiedLevelIds.every(id=>migration.recognizedLevelIds.includes(id))&&(migration.source!=='new'||migration.recognizedLevelIds.length===0),'invalid_economy_migration');
   const cleared=migration.recognizedLevelIds.slice(),claimed=[],gifts=new Set(),usage=new Map(),inventory={greenBrush:0,colorKey:0};let gold=0,stars=0;
   const rows=Object.entries(state.transactions);need(rows.every(([id,row])=>token(id)&&exact(row,['kind','levelId','attemptId','itemId','source','assisted','sequence','costGold','pricesVersion'])&&integer(row.sequence)&&row.sequence>0),'invalid_economy_ledger');rows.sort((a,b)=>a[1].sequence-b[1].sequence);
   for(let index=0;index<rows.length;index++){
    const [id,row]=rows[index];need(row.sequence===index+1&&typeof row.assisted==='boolean'&&integer(row.costGold)&&(row.pricesVersion===null||token(row.pricesVersion)),'invalid_economy_ledger');
    if(row.kind==='clear'){
     need(known(row.levelId)&&token(row.attemptId)&&row.itemId===null&&row.costGold===0&&row.pricesVersion===null&&id===clearId(row.levelId)&&!claimed.includes(row.levelId)&&['gameplay','legacy'].includes(row.source),'invalid_economy_ledger');
     need(row.source==='legacy'?migration.verifiedLevelIds.includes(row.levelId):next(cleared)===row.levelId,'invalid_economy_ledger');
     if(!cleared.includes(row.levelId))cleared.push(row.levelId);claimed.push(row.levelId);gold+=config.reward.gold;stars+=config.reward.stars;
    }else if(row.kind==='gift'){
     need(ITEMS.includes(row.itemId)&&row.levelId===config.inventory[row.itemId].unlockAfterLevelId&&claimed.includes(row.levelId)&&token(row.attemptId)&&row.attemptId===state.transactions[clearId(row.levelId)].attemptId&&row.assisted===state.transactions[clearId(row.levelId)].assisted&&row.source==='milestone'&&row.costGold===0&&row.pricesVersion===null&&id===giftId(row.levelId,row.itemId)&&!gifts.has(row.itemId),'invalid_economy_ledger');gifts.add(row.itemId);inventory[row.itemId]+=config.inventory[row.itemId].gift;
    }else if(row.kind==='welcome'){
     need(id===welcomeId&&row.levelId===null&&token(row.attemptId)&&row.itemId===null&&row.source==='onboarding'&&row.assisted===false&&row.costGold===0&&row.pricesVersion===welcome.version,'invalid_economy_ledger');gold+=welcome.gold;
    }else if(row.kind==='purchase'){
     need(!id.startsWith('clear:')&&!id.startsWith('gift:')&&ITEMS.includes(row.itemId)&&cleared.includes(config.inventory[row.itemId].unlockAfterLevelId)&&row.levelId===null&&row.attemptId===null&&row.source==='command'&&row.assisted===false&&row.pricesVersion===config.pricesVersion&&row.costGold===config.inventory[row.itemId].costGold&&gold>=row.costGold,'invalid_economy_ledger');gold-=row.costGold;inventory[row.itemId]++;
    }else if(row.kind==='use'||row.kind==='rescue'){
     need(!id.startsWith('clear:')&&!id.startsWith('gift:')&&known(row.levelId)&&row.levelId===next(cleared)&&token(row.attemptId)&&row.source==='command'&&row.assisted===true,'invalid_economy_ledger');
     const key=row.attemptId+':'+(row.kind==='rescue'?'rescue':row.itemId),count=usage.get(key)||0;
     if(row.kind==='use'){need(ITEMS.includes(row.itemId)&&cleared.includes(config.inventory[row.itemId].unlockAfterLevelId)&&row.levelId>config.inventory[row.itemId].unlockAfterLevelId&&row.costGold===0&&row.pricesVersion===null&&inventory[row.itemId]>0&&count<config.inventory[row.itemId].maxPerAttempt,'invalid_economy_ledger');inventory[row.itemId]--;}
     else{need(row.itemId==='rescue5'&&row.pricesVersion===config.pricesVersion&&row.costGold===config.rescue.goldCost&&gold>=row.costGold&&count<config.rescue.maxPerAttempt,'invalid_economy_ledger');gold-=row.costGold;}
     usage.set(key,count+1);
    }else fail('invalid_economy_ledger');
    need(integer(gold)&&integer(stars)&&ITEMS.every(item=>integer(inventory[item])),'invalid_economy_ledger');
   }
   need(migration.verifiedLevelIds.every(id=>claimed.includes(id))&&ITEMS.every(item=>!claimed.includes(config.inventory[item].unlockAfterLevelId)||gifts.has(item))&&same(sorted(cleared),state.clearedLevelIds)&&same(sorted(claimed),state.claimedLevelIds)&&gold===state.gold&&stars===state.stars&&stars===claimed.length&&ITEMS.every(item=>inventory[item]===state.inventory[item]),'economy_ledger_mismatch');return true;
  }
  function restore(state){validate(state);return copy(state);}
  function result(state,applied,reason,reward=null){return {state,applied,reason,reward,pendingLevelIds:state.migration.recognizedLevelIds.filter(id=>!state.claimedLevelIds.includes(id))};}
  function append(state,id,row){need(!Object.prototype.hasOwnProperty.call(state.transactions,id),'duplicate_economy_transaction');state.transactions[id]={...row,sequence:Object.keys(state.transactions).length+1};}
  function row(kind,levelId,attemptId,itemId,source,assisted,costGold=0,pricesVersion=null){return {kind,levelId,attemptId,itemId,source,assisted,sequence:0,costGold,pricesVersion};}
  function grant(state,levelId,attemptId,source,assisted){
   const reward={gold:config.reward.gold,stars:config.reward.stars,inventory:{greenBrush:0,colorKey:0}};
   append(state,clearId(levelId),row('clear',levelId,attemptId,null,source,assisted));state.gold+=reward.gold;state.stars+=reward.stars;
   if(!state.clearedLevelIds.includes(levelId))state.clearedLevelIds=sorted([...state.clearedLevelIds,levelId]);state.claimedLevelIds=sorted([...state.claimedLevelIds,levelId]);
   for(const item of ITEMS)if(config.inventory[item].unlockAfterLevelId===levelId){append(state,giftId(levelId,item),row('gift',levelId,attemptId,item,'milestone',assisted));reward.inventory[item]+=config.inventory[item].gift;state.inventory[item]+=config.inventory[item].gift;}
   return reward;
  }
  function migrate(existing,legacy={}){
   need(map(legacy)&&Object.keys(legacy).every(key=>['done','verifiedLevelIds','sourceKey'].includes(key)),'invalid_legacy_progress');
   const proofs=legacy.verifiedLevelIds===undefined?[]:legacy.verifiedLevelIds;need(Array.isArray(proofs)&&proofs.every(known),'invalid_legacy_evidence');
   let state,applied=false,reason='already_migrated',reward={gold:0,stars:0,inventory:{greenBrush:0,colorKey:0}};
   if(existing!==null&&existing!==undefined)state=restore(existing);
   else{
    const done=legacy.done===undefined?[]:legacy.done,source=legacy.sourceKey===undefined?'hexrota-match-v5':legacy.sourceKey;need(['hexrota-match-v5','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'].includes(source)&&Array.isArray(done)&&done.every(index=>integer(index)&&index<config.tutorialCount+config.levelIds.length),'invalid_legacy_progress');
    state=createState();state.migration={schemaVersion:1,source,recognizedLevelIds:sorted([...done.filter(index=>index>=config.tutorialCount).map(index=>config.levelIds[index-config.tutorialCount]),...proofs]),verifiedLevelIds:[]};state.clearedLevelIds=state.migration.recognizedLevelIds.slice();applied=true;reason='migrated';
   }
   for(const id of sorted(proofs))if(state.migration.recognizedLevelIds.includes(id)&&!state.claimedLevelIds.includes(id)){
    state.migration.verifiedLevelIds=sorted([...state.migration.verifiedLevelIds,id]);const item=grant(state,id,`legacy-${id}`,'legacy',false);reward.gold+=item.gold;reward.stars+=item.stars;for(const name of ITEMS)reward.inventory[name]+=item.inventory[name];applied=true;if(reason!=='migrated')reason='legacy_review_applied';
   }
   validate(state);return result(state,applied,reason,reward.gold||reward.stars?reward:null);
  }
  function complete(raw,context){
   const state=restore(raw);need(map(context)&&Object.keys(context).every(key=>['levelId','attemptId','status','verified','assisted','tutorial'].includes(key))&&token(context.attemptId)&&['won','lost','playing'].includes(context.status)&&typeof context.verified==='boolean'&&(context.assisted===undefined||typeof context.assisted==='boolean')&&(context.tutorial===undefined||typeof context.tutorial==='boolean'),'invalid_economy_context');
   if(config.tutorialIds.includes(context.levelId))return result(state,false,'tutorial_no_reward');need(known(context.levelId)&&context.tutorial!==true,'invalid_economy_level');
   if(state.clearedLevelIds.includes(context.levelId))return result(state,false,'already_cleared');if(context.levelId!==next(state.clearedLevelIds))return result(state,false,'level_locked');if(context.status!=='won')return result(state,false,'not_won');if(!context.verified)return result(state,false,'unverified_win');
   const reward=grant(state,context.levelId,context.attemptId,'gameplay',context.assisted===true);validate(state);return result(state,true,'level_claimed',reward);
  }
  function claimWelcome(raw,context){
   const state=restore(raw);need(exact(context,['levelId','attemptId','status','verified'])&&token(context.attemptId)&&['won','lost','playing'].includes(context.status)&&typeof context.verified==='boolean','invalid_welcome_context');
   if(context.levelId!==config.tutorialIds[1])return result(state,false,'welcome_unavailable');
   if(Object.prototype.hasOwnProperty.call(state.transactions,welcomeId))return result(state,false,state.transactions[welcomeId].kind==='welcome'?'welcome_already_claimed':'transaction_conflict');
   if(context.status!=='won')return result(state,false,'not_won');if(!context.verified)return result(state,false,'unverified_win');
   const reward={gold:welcome.gold,stars:0,inventory:{greenBrush:0,colorKey:0}};
   append(state,welcomeId,row('welcome',null,context.attemptId,null,'onboarding',false,0,welcome.version));state.gold+=welcome.gold;validate(state);return result(state,true,'welcome_claimed',reward);
  }
  function canEnter(raw,levelId){const state=restore(raw);return config.tutorialIds.includes(levelId)||known(levelId)&&next(state.clearedLevelIds)===levelId;}
  function view(raw){const state=restore(raw),nextLevelId=next(state.clearedLevelIds);return {gold:state.gold,stars:state.stars,inventory:copy(state.inventory),cleared:state.clearedLevelIds.slice(),claimed:state.claimedLevelIds.slice(),clearedLevelIds:state.clearedLevelIds.slice(),claimedLevelIds:state.claimedLevelIds.slice(),nextLevelId,campaignComplete:nextLevelId===null,pendingReviewLevelIds:state.migration.recognizedLevelIds.filter(id=>!state.claimedLevelIds.includes(id)),unlocks:Object.fromEntries(ITEMS.map(item=>[item,state.clearedLevelIds.includes(config.inventory[item].unlockAfterLevelId)])),botanical:config.botanical.map(entry=>({...entry,unlocked:state.stars>=entry.stars}))};}
  function operation(raw,context,kind){
   const state=restore(raw),allowed=kind==='purchase'?['operationId','itemId']:kind==='use'?['operationId','itemId','attemptId','levelId']:['operationId','attemptId','levelId'];need(exact(context,allowed)&&token(context.operationId)&&!context.operationId.startsWith('clear:')&&!context.operationId.startsWith('gift:')&&!context.operationId.startsWith('welcome:'),'invalid_economy_operation');
   if(kind!=='rescue')need(ITEMS.includes(context.itemId),'invalid_economy_item');if(kind!=='purchase')need(known(context.levelId)&&token(context.attemptId),'invalid_economy_context');
   const itemId=kind==='rescue'?'rescue5':context.itemId,levelId=kind==='purchase'?null:context.levelId,attemptId=kind==='purchase'?null:context.attemptId;
   const prior=Object.prototype.hasOwnProperty.call(state.transactions,context.operationId)?state.transactions[context.operationId]:null;if(prior)return result(state,false,prior.kind===kind&&prior.itemId===itemId&&prior.levelId===levelId&&prior.attemptId===attemptId?'duplicate_transaction':'transaction_conflict');
   if(kind!=='purchase'&&next(state.clearedLevelIds)!==levelId)return result(state,false,state.clearedLevelIds.includes(levelId)?'already_cleared':'level_locked');
   if(kind!=='rescue'&&!state.clearedLevelIds.includes(config.inventory[itemId].unlockAfterLevelId))return result(state,false,'item_locked');
   const used=Object.values(state.transactions).filter(entry=>entry.kind===kind&&entry.attemptId===attemptId&&entry.itemId===itemId).length;
   if(kind==='use'&&(levelId<=config.inventory[itemId].unlockAfterLevelId||used>=config.inventory[itemId].maxPerAttempt))return result(state,false,levelId<=config.inventory[itemId].unlockAfterLevelId?'item_locked':'attempt_limit');
   if(kind==='rescue'&&used>=config.rescue.maxPerAttempt)return result(state,false,'attempt_limit');
   const costGold=kind==='purchase'?config.inventory[itemId].costGold:kind==='rescue'?config.rescue.goldCost:0;if(state.gold<costGold)return result(state,false,'insufficient_gold');if(kind==='use'&&state.inventory[itemId]===0)return result(state,false,'insufficient_stock');
   append(state,context.operationId,row(kind,levelId,attemptId,itemId,'command',kind!=='purchase',costGold,costGold?config.pricesVersion:null));state.gold-=costGold;if(kind==='purchase')state.inventory[itemId]++;if(kind==='use')state.inventory[itemId]--;validate(state);return {...result(state,true,kind==='purchase'?'item_purchased':kind==='use'?'item_consumed':'rescue_paid'),costGold,itemId};
  }
  return Object.freeze({createState,validate,restore,migrate,complete,claimWelcome,canEnter,nextLevel:state=>next(restore(state).clearedLevelIds),view,purchase:(state,context)=>operation(state,context,'purchase'),consume:(state,context)=>operation(state,context,'use'),spendRescue:(state,context)=>operation(state,context,'rescue'),getTransaction:(state,id)=>{need(token(id),'invalid_economy_operation');const ledger=restore(state).transactions;return copy(Object.prototype.hasOwnProperty.call(ledger,id)?ledger[id]:null);},config:()=>copy(config)});
 }
 const api=Object.freeze({createManager,validateConfig});root.HexEconomy=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
