'use strict';
// Authored flow inputs shared by the JS invariant and real C# comparison suites.
const E=require('../dist/economy.js'),config=require('../data/economy-config-9-5.json');
const copy=value=>JSON.parse(JSON.stringify(value));
const context=(levelId,extra={})=>({levelId,attemptId:'campaign-'+levelId,status:'won',verified:true,...extra});
const complete=(levelId,extra={})=>({op:'complete',context:context(levelId,extra)});
const opening=count=>Array.from({length:count},(_,index)=>complete(index+1));
function cleared(count){const manager=E.createManager(config);let state=manager.createState();for(let level=1;level<=count;level++)state=manager.complete(state,context(level)).state;return state;}
function cases(){
 const result=[];
 const add=(label,commands,state=null,customConfig=config)=>result.push({label,input:{config:copy(customConfig),state:copy(state),commands:copy(commands)}});
 add('new profile / exact typed level IDs / reward-free tutorials',[{op:'create'},{op:'config'},{op:'view'},...[1,'1',2,'learn-1','learn-2','T1',0,null].map(levelId=>({op:'canEnter',levelId})),complete('learn-1'),complete('learn-2'),{op:'view'}]);
 add('100 callbacks pay exactly once; variants/attempts never create a second entitlement',[{op:'create'},...Array.from({length:100},(_,index)=>complete(1,{attemptId:'variant-attempt-'+index})),{op:'view'},{op:'nextLevel'}]);
 add('campaign / milestone gifts / all terminal clears / final does not loop',[{op:'create'},...opening(10).flatMap(command=>[command,{op:'view'}]),...opening(10),{op:'nextLevel'},...[1,5,10,'learn-1'].map(levelId=>({op:'canEnter',levelId}))]);
 add('lost, playing, unverified win, locked future, string main ID',[{op:'create'},complete(1,{status:'lost'}),complete(1,{status:'playing'}),complete(1,{verified:false}),complete(2),complete('1'),{op:'view'}]);
 add('legacy done stays cleared; only independently verified wins receive currency',[{op:'migrate',legacy:{done:[0,1,2,3,4,7],verifiedLevelIds:[1,3],sourceKey:'hexrota-match-v5'}},{op:'view'},complete(2),{op:'migrate',legacy:{done:[0,1,2,3,4,7],verifiedLevelIds:[1,2,3,6]}},{op:'migrate',legacy:{done:[0,1,2,3,4,7],verifiedLevelIds:[1,2,3,6]}},{op:'view'}]);
 add('legacy valid won checkpoint without old done flag recovers once',[{op:'migrate',legacy:{done:[0,1],verifiedLevelIds:[1]}},{op:'view'},{op:'migrate',legacy:{done:[0,1],verifiedLevelIds:[1]}}]);
 add('authoritative ledger ignores later spoofed done and unrelated proof',[{op:'migrate',legacy:{done:[0,1,2,3,4,5,6,7,8,9,10,11],verifiedLevelIds:[1,3,10]}},{op:'view'}],cleared(1));
 for(const key of ['hexrota-match-v5','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'])add('legacy supported source '+key,[{op:'migrate',legacy:{done:[0,1,2,4,7],verifiedLevelIds:[1,3,6],sourceKey:key}},{op:'view'}]);
 for(const done of [null,{},['2'],[-1],[12],[2.5],[false]])add('reject malformed legacy done '+JSON.stringify(done),[{op:'migrate',legacy:{done}}]);
 for(const verifiedLevelIds of [null,{},['1'],[11],[-1],[false]])add('reject malformed proof IDs '+JSON.stringify(verifiedLevelIds),[{op:'migrate',legacy:{done:[2],verifiedLevelIds}}]);
 add('reject unknown migration source',[{op:'migrate',legacy:{done:[2],verifiedLevelIds:[1],sourceKey:'unknown-v99'}}]);
 add('legacy pending survives persisted restore / ordinary reset cannot reduce ledger',[{op:'view'},{op:'restore'},{op:'migrate',legacy:{done:[],verifiedLevelIds:[]}},{op:'nextLevel'},{op:'view'}],E.createManager(config).migrate(null,{done:[0,1,2,3,4,5,6,7],verifiedLevelIds:[1,3,6]}).state);
 add('stock usage and duplicate command ID / conflict / independent attempt usage',[
  {op:'consume',context:{operationId:'brush-a',itemId:'greenBrush',attemptId:'attempt-4a',levelId:4}},
  {op:'consume',context:{operationId:'brush-a',itemId:'greenBrush',attemptId:'attempt-4a',levelId:4}},
  {op:'consume',context:{operationId:'brush-a',itemId:'greenBrush',attemptId:'attempt-4b',levelId:4}},
  {op:'consume',context:{operationId:'brush-limit',itemId:'greenBrush',attemptId:'attempt-4a',levelId:4}},
  {op:'consume',context:{operationId:'brush-b',itemId:'greenBrush',attemptId:'attempt-4b',levelId:4}},
  {op:'consume',context:{operationId:'brush-c',itemId:'greenBrush',attemptId:'attempt-4c',levelId:4}},
  {op:'consume',context:{operationId:'brush-empty',itemId:'greenBrush',attemptId:'attempt-4d',levelId:4}},
  {op:'consume',context:{operationId:'key-locked',itemId:'colorKey',attemptId:'attempt-4a',levelId:4}},
  {op:'getTransaction',id:'brush-a'},{op:'view'},complete(4,{assisted:true}),{op:'restore'}
 ],cleared(3));
 add('purchase positive price / insufficient funds / duplicate / conflict / prototype-safe ID',[
  {op:'purchase',context:{operationId:'buy-brush',itemId:'greenBrush'}},
  {op:'purchase',context:{operationId:'buy-brush',itemId:'greenBrush'}},
  {op:'purchase',context:{operationId:'buy-brush',itemId:'colorKey'}},
  {op:'purchase',context:{operationId:'buy-key',itemId:'colorKey'}},
  {op:'getTransaction',id:'toString'},{op:'purchase',context:{operationId:'toString',itemId:'greenBrush'}},{op:'view'}
 ],cleared(6));
 add('new game cannot spend TEST wallet / locked item / invalid identities',[
  {op:'purchase',context:{operationId:'buy',itemId:'greenBrush'}},
  {op:'spendRescue',context:{operationId:'rescue-a',attemptId:'a',levelId:1}},
  {op:'purchase',context:{operationId:'bad',itemId:'stars'}},
  {op:'consume',context:{operationId:'bad-level',itemId:'greenBrush',attemptId:'a',levelId:'1'}},{op:'view'}
 ],cleared(0));
 add('rescue charge140 at most once / same command id / no new entitlement',[
  {op:'spendRescue',context:{operationId:'rescue-a',attemptId:'attempt-8',levelId:8}},
  {op:'spendRescue',context:{operationId:'rescue-a',attemptId:'attempt-8',levelId:8}},
  {op:'spendRescue',context:{operationId:'rescue-b',attemptId:'attempt-8',levelId:8}},
  {op:'spendRescue',context:{operationId:'rescue-a',attemptId:'another',levelId:8}},
  complete(8,{assisted:true}),{op:'view'},complete(8)
 ],cleared(7));
 const paid=E.createManager(config).purchase(cleared(7),{operationId:'historical-price',itemId:'greenBrush'}).state;
 add('unknown historical price version fails closed until explicit price archive exists', [{op:'restore'},{op:'purchase',context:{operationId:'new-price',itemId:'greenBrush'}},{op:'view'}],paid,{...copy(config),pricesVersion:'economy-9-5-v2',inventory:{...copy(config.inventory),greenBrush:{...config.inventory.greenBrush,costGold:80}}});
 const forgedCost=copy(paid);forgedCost.transactions['historical-price'].costGold=1;forgedCost.gold+=69;add('corrupt state rejects internally consistent but incorrect current purchase price',[{op:'restore'},{op:'validate'}],forgedCost);
 const forgedVersion=copy(paid);forgedVersion.transactions['historical-price'].pricesVersion='unknown-price-v99';add('corrupt state rejects unsupported historical purchase price version',[{op:'restore'},{op:'validate'}],forgedVersion);
 const paidRescue=E.createManager(config).spendRescue(cleared(7),{operationId:'paid-rescue',attemptId:'a8',levelId:8}).state;
 paidRescue.transactions['paid-rescue'].costGold=139;paidRescue.gold=1;add('corrupt state rejects internally consistent but incorrect rescue price',[{op:'restore'},{op:'validate'}],paidRescue);
 for(const operationId of ['__proto__','constructor','prototype','end\n','', 'x'.repeat(181),'clear:main:5','gift:main:3:greenBrush'])add('invalid operation ID '+JSON.stringify(operationId),[{op:'purchase',context:{operationId,itemId:'greenBrush'}},{op:'getTransaction',id:operationId}],cleared(4));
 for(const levelId of [null,false,'1',1.5,-1,11])add('malformed clear identity '+JSON.stringify(levelId),[complete(levelId)],cleared(0));
 for(const extra of [{attemptId:''},{attemptId:'a\n'},{verified:'true'},{assisted:1},{tutorial:1},{status:'complete'},{unexpected:true}])add('malformed completion '+JSON.stringify(extra),[complete(1,extra)],cleared(0));
 const valid=cleared(6),mutations={
  'future version':s=>s.schemaVersion=99,'extra field':s=>s.unknown=1,'gold inflation':s=>s.gold++,'TEST wallet conversion':s=>s.gold=300,'star inflation':s=>s.stars++,'stock inflation':s=>s.inventory.greenBrush++,
  'erase permanent clear':s=>s.clearedLevelIds.pop(),'string clear ID':s=>s.clearedLevelIds[0]='1','duplicate clear ID':s=>s.clearedLevelIds.push(6),'missing gift':s=>delete s.transactions['gift:main:3:greenBrush'],
  'gift wrong attempt':s=>s.transactions['gift:main:3:greenBrush'].attemptId='unrelated-attempt','gift wrong assistance':s=>s.transactions['gift:main:3:greenBrush'].assisted=true,
  'duplicate sequence':s=>s.transactions['clear:main:2'].sequence=1,'zero sequence':s=>s.transactions['clear:main:1'].sequence=0,'unknown ledger field':s=>s.transactions['clear:main:1'].junk=1,'wrong source':s=>s.transactions['clear:main:1'].source='legacy',
  'legacy out of source':s=>s.migration.verifiedLevelIds=[1],'forged unrecognized pending':s=>s.migration.recognizedLevelIds=[10],'unsafe quantity':s=>s.gold=9007199254740992
 };
 for(const [label,mutate]of Object.entries(mutations)){const state=copy(valid);mutate(state);add('corrupt state rejects '+label,[{op:'validate'},{op:'restore'},{op:'view'},complete(7)],state);}
 for(const state of [null,{},[],false,1,''])add('present corrupt state '+JSON.stringify(state),[{op:'restore'},{op:'validate'},{op:'view'}],state);
 for(const change of [c=>c.schemaVersion=2,c=>c.reward.gold=200,c=>c.reward.stars=2,c=>c.inventory.greenBrush.unlockAfterLevelId=2,c=>c.inventory.colorKey.gift=4,c=>c.rescue.moves=3,c=>c.botanical[0].stars=1,c=>c.levelIds[0]='1',c=>c.levelIds.push(10),c=>c.pricesVersion='bad\n']){const changed=copy(config);change(changed);add('corrupt config '+JSON.stringify(changed),[{op:'create'}],null,changed);}
 // Onboarding is a separate, versioned one-time entitlement; campaign clears stay unchanged.
 const welcomeContext=(extra={})=>({levelId:'learn-2',attemptId:'tutorial-finish',status:'won',verified:true,...extra});
 const welcome=(extra={})=>({op:'claimWelcome',context:welcomeContext(extra)});
 const welcomeManager=E.createManager(config),welcomed=welcomeManager.claimWelcome(welcomeManager.createState(),welcomeContext()).state;
 add('verified T2 welcome pays20 once across100 callbacks without stars or inventory',[{op:'create'},...Array.from({length:100},(_,index)=>welcome({attemptId:'tutorial-'+index})),{op:'view'},{op:'restore'},{op:'canEnter',levelId:1}]);
 add('welcome requires exact T2 identity and a verified win',[{op:'create'},...[null,false,0,1,2,'1','learn-1','T2','learn-2 '].map(levelId=>welcome({levelId})),welcome({status:'playing'}),welcome({status:'lost'}),welcome({verified:false}),{op:'view'}]);
 add('welcome survives restore and ordinary migration reset; every campaign clear keeps independent reward',[{op:'restore'},{op:'migrate',legacy:{done:[],verifiedLevelIds:[]}},welcome(),...opening(10),{op:'view'},welcome({attemptId:'replayed-lesson'}),{op:'restore'}],welcomed);
 const oldConfig=copy(config);delete oldConfig.welcome;
 add('published old exact config restores and grants the same historical onboarding version',[{op:'create'},welcome(),{op:'restore'},{op:'config'}],null,oldConfig);
 add('old config can restore a welcome ledger written by the current config',[{op:'restore'},welcome(),{op:'view'}],welcomed,oldConfig);
 for(const context of [null,[],false,1,'',{},welcomeContext({verified:'true'}),welcomeContext({attemptId:''}),welcomeContext({attemptId:'bad\n'}),welcomeContext({status:'complete'}),{...welcomeContext(),unexpected:true}])add('malformed welcome context '+JSON.stringify(context),[{op:'create'},{op:'claimWelcome',context},{op:'view'}]);
 const welcomeId='welcome:'+config.campaignId+':onboarding-v1';
 for(const [label,mutate]of Object.entries({
  'version':s=>s.transactions[welcomeId].pricesVersion='onboarding-v99',
  'source':s=>s.transactions[welcomeId].source='gameplay',
  'level':s=>s.transactions[welcomeId].levelId='learn-2',
  'attempt':s=>s.transactions[welcomeId].attemptId='',
  'item':s=>s.transactions[welcomeId].itemId='greenBrush',
  'assisted':s=>s.transactions[welcomeId].assisted=true,
  'cost':s=>s.transactions[welcomeId].costGold=1,
  'id':s=>{s.transactions['welcome:main:alternate']=s.transactions[welcomeId];delete s.transactions[welcomeId];},
  'gold':s=>s.gold=40,
  'stars':s=>s.stars=1,
  'stock':s=>s.inventory.greenBrush=1
 })){const bad=copy(welcomed);mutate(bad);add('corrupt state rejects welcome '+label,[{op:'validate'},{op:'restore'}],bad);}
 for(const value of [null,{},[],{version:'onboarding-v2',gold:20},{version:'onboarding-v1',gold:21},{version:'onboarding-v1',gold:20,stars:1}])add('invalid welcome config '+JSON.stringify(value),[{op:'create'}],null,{...copy(config),welcome:value});
 add('ordinary commands cannot occupy reserved welcome grant namespace',[{op:'purchase',context:{operationId:welcomeId,itemId:'greenBrush'}},{op:'consume',context:{operationId:welcomeId,itemId:'greenBrush',attemptId:'a8',levelId:8}},{op:'spendRescue',context:{operationId:welcomeId,attemptId:'a8',levelId:8}}],cleared(7));
 const historical=E.createManager(config).purchase(cleared(7),{operationId:'historical-before-welcome',itemId:'greenBrush'}).state;
 historical.transactions[welcomeId]=historical.transactions['historical-before-welcome'];delete historical.transactions['historical-before-welcome'];
 add('legacy valid arbitrary operation id remains restorable and does not masquerade as welcome',[{op:'restore'},welcome(),{op:'view'}],historical);
 return result;
}
function run(input){
 let manager,state=copy(input.state??null);try{manager=E.createManager(input.config);}catch(error){return {error:error.code||error.message};}
 const output=[];
 for(const command of input.commands){let result;try{
  const op=command.op;
  if(op==='create'){result=manager.createState();state=result;}
  else if(op==='restore'){result=manager.restore(Object.hasOwn(command,'state')?command.state:state);state=result;}
  else if(op==='validate')result=manager.validate(Object.hasOwn(command,'state')?command.state:state);
  else if(op==='migrate'){result=manager.migrate(state,command.legacy);state=result.state;}
  else if(op==='complete'){result=manager.complete(state,command.context);state=result.state;}
  else if(op==='claimWelcome'){result=manager.claimWelcome(state,command.context);state=result.state;}
  else if(op==='canEnter')result=manager.canEnter(state,command.levelId);
  else if(op==='nextLevel')result=manager.nextLevel(state);
  else if(op==='view')result=manager.view(state);
  else if(op==='purchase'){result=manager.purchase(state,command.context);state=result.state;}
  else if(op==='consume'){result=manager.consume(state,command.context);state=result.state;}
  else if(op==='spendRescue'){result=manager.spendRescue(state,command.context);state=result.state;}
  else if(op==='getTransaction')result=manager.getTransaction(state,command.id);
  else if(op==='config')result=manager.config();
  else throw Error('unknown_economy_operation');
 }catch(error){result={error:error.code||error.message};}
 output.push(copy({result,state}));}
 return output;
}
module.exports={cases,run,cleared,config,copy,context};
