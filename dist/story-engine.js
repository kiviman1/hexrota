/* story-v1: pure, bounded narrative reducer. Gameplay facts are supplied by the
 * canonical host; restoring always replays the journal against that proof. */
(function(root){
 'use strict';
 const TYPES=Object.freeze(['level_started','valid_match','blocker_damaged','blocker_broken','material_collected','region_opened','material_goal_completed','level_won','level_lost','story_choice_selected','dialogue_acknowledged']);
 const POSES=['idle','point','call','celebrate'],LIMITS=Object.freeze({events:4096,history:256,queue:16,journal:512,repeat:8});
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),map=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const dense=x=>{if(!Array.isArray(x)||Object.keys(x).length!==x.length)return false;for(let i=0;i<x.length;i++)if(!own(x,i))return false;return true;};
 const copy=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function fail(){throw Error('invalid_story_contract');}
 function assert(ok){if(!ok)fail();}
 function keys(o,names){assert(map(o)&&Object.keys(o).length===names.length&&names.every(k=>own(o,k)));}
 const id=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,63}$(?![\s\S])/.test(x),nullableId=x=>x===null||id(x),integer=(x,min=0,max=2147483647)=>Number.isInteger(x)&&x>=min&&x<=max;
 const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
 const identity=(x,max=16384)=>typeof x==='string'&&x.length>0&&x.length<=max&&/^[A-Za-z0-9:/._-]+$(?![\s\S])/.test(x);
 function same(a,b){if(a===b)return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>same(v,b[i]));if(map(a)&&map(b)){const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>own(b,k)&&same(a[k],b[k]));}return false;}
 function filter(f){keys(f,['event','materialId','subject']);assert(TYPES.includes(f.event)&&nullableId(f.materialId)&&nullableId(f.subject));}
 const compiled=new WeakMap();
 function compile(raw){
  if(compiled.has(raw))return compiled.get(raw);
  keys(raw,['schemaVersion','contentVersion','speakers','scenes','chapters','nodes']);assert(raw.schemaVersion===1&&raw.contentVersion==='story-content-v1');
  assert(dense(raw.speakers)&&raw.speakers.length>0&&raw.speakers.length<=8&&dense(raw.scenes)&&raw.scenes.length<=8&&dense(raw.chapters)&&raw.chapters.length>0&&raw.chapters.length<=16&&dense(raw.nodes)&&raw.nodes.length>0&&raw.nodes.length<=128);
  const speakers=new Map(),scenes=new Map(),chapters=new Map(),nodes=new Map(),levels=new Set(),orders=new Set();
  for(const s of raw.speakers){keys(s,['id','name']);assert(id(s.id)&&text(s.name,60)&&!speakers.has(s.id));speakers.set(s.id,s);}
  for(const s of raw.scenes){keys(s,['id','asset']);assert(id(s.id)&&!scenes.has(s.id)&&typeof s.asset==='string'&&/^assets\/[A-Za-z0-9/_-]+\.(?:webp|png|svg)$(?![\s\S])/.test(s.asset)&&!s.asset.includes('..'));scenes.set(s.id,s);}
  for(const c of raw.chapters){keys(c,['id','levelId']);assert(id(c.id)&&integer(c.levelId,1,10000)&&!chapters.has(c.id)&&!levels.has(c.levelId));chapters.set(c.id,c);levels.add(c.levelId);}
  for(const n of raw.nodes){
   keys(n,['id','chapterId','speakerId','text','pose','trigger','conditions','once','priority','order','next','choices','sceneId']);
   assert(id(n.id)&&!nodes.has(n.id)&&chapters.has(n.chapterId)&&speakers.has(n.speakerId)&&text(n.text,240)&&POSES.includes(n.pose)&&typeof n.once==='boolean'&&integer(n.priority,0,1000)&&integer(n.order,0,1000)&&nullableId(n.next)&&nullableId(n.sceneId)&&(n.sceneId===null||scenes.has(n.sceneId))&&dense(n.conditions)&&n.conditions.length<=16&&dense(n.choices)&&n.choices.length!==1&&n.choices.length<=4);
   if(n.trigger!==null)filter(n.trigger);
   const order=n.chapterId+'/'+n.priority+'/'+n.order;assert(!orders.has(order));orders.add(order);
   const choices=new Set();for(const c of n.choices){keys(c,['id','text','next']);assert(id(c.id)&&!choices.has(c.id)&&text(c.text,80)&&id(c.next));choices.add(c.id);}
   for(const c of n.conditions){assert(map(c));if(c.kind==='event_seen'){keys(c,['kind','event','materialId','subject']);filter({event:c.event,materialId:c.materialId,subject:c.subject});}else if(c.kind==='node_acknowledged'){keys(c,['kind','nodeId']);assert(id(c.nodeId));}else if(c.kind==='choice_selected'){keys(c,['kind','nodeId','choiceId']);assert(id(c.nodeId)&&id(c.choiceId));}else fail();}
   nodes.set(n.id,n);
  }
  const flowEdges=n=>[...(n.next===null?[]:[n.next]),...n.choices.map(c=>c.next)];
  for(const n of nodes.values()){
   if(n.trigger?.event==='level_started')assert(n.conditions.length===0);
   if(n.trigger&&['dialogue_acknowledged','story_choice_selected'].includes(n.trigger.event)){const source=nodes.get(n.trigger.subject);assert(source&&source.chapterId===n.chapterId&&n.trigger.materialId===null);if(n.trigger.event==='story_choice_selected')assert(source.choices.length>=2);}
   const branches=new Map();for(const c of n.conditions)if(c.kind==='choice_selected'){assert(!branches.has(c.nodeId)||branches.get(c.nodeId)===c.choiceId);branches.set(c.nodeId,c.choiceId);}
  }
  const edges=n=>[...flowEdges(n),...[...nodes.values()].filter(t=>t.trigger&&['dialogue_acknowledged','story_choice_selected'].includes(t.trigger.event)&&t.trigger.subject===n.id).map(t=>t.id)];
  for(const n of nodes.values())for(const target of edges(n)){const t=nodes.get(target);assert(t&&t.chapterId===n.chapterId);}
  const visiting=new Set(),visited=new Set();function visit(n){assert(!visiting.has(n.id));if(visited.has(n.id))return;visiting.add(n.id);edges(n).forEach(k=>visit(nodes.get(k)));visiting.delete(n.id);visited.add(n.id);}nodes.forEach(visit);
  const descendants=n=>{const found=new Set();function walk(key){if(found.has(key))return;found.add(key);edges(nodes.get(key)).forEach(walk);}edges(n).forEach(walk);return found;};
  for(const n of nodes.values())for(const c of n.conditions){if(c.kind==='event_seen'){if(['dialogue_acknowledged','story_choice_selected'].includes(c.event)&&c.subject!==null){const t=nodes.get(c.subject);assert(t&&t.chapterId===n.chapterId&&t.id!==n.id&&!descendants(n).has(t.id));if(c.event==='story_choice_selected')assert(t.choices.length>=2);}}else{const t=nodes.get(c.nodeId);assert(t&&t.chapterId===n.chapterId&&t.id!==n.id&&!descendants(n).has(t.id));if(c.kind==='choice_selected')assert(t.choices.some(x=>x.id===c.choiceId));}}
  const reachable=new Set();function reach(n){if(reachable.has(n.id))return;reachable.add(n.id);edges(n).forEach(k=>reach(nodes.get(k)));}for(const n of nodes.values())if(n.trigger!==null&&!['dialogue_acknowledged','story_choice_selected'].includes(n.trigger.event))reach(n);assert(reachable.size===nodes.size);
  for(const c of chapters.values())assert([...nodes.values()].some(n=>n.chapterId===c.id&&n.trigger?.event==='level_started'));
  // Acknowledgement prerequisites are causal edges too: two independently
  // triggered nodes cannot wait forever for each other's first acknowledgement.
  const prerequisites=n=>[...edges(n),...[...nodes.values()].filter(t=>t.conditions.some(c=>c.kind!=='event_seen'?c.nodeId===n.id:['dialogue_acknowledged','story_choice_selected'].includes(c.event)&&c.subject===n.id)).map(t=>t.id)];
  visiting.clear();visited.clear();function causal(n){assert(!visiting.has(n.id));if(visited.has(n.id))return;visiting.add(n.id);prerequisites(n).forEach(k=>causal(nodes.get(k)));visiting.delete(n.id);visited.add(n.id);}nodes.forEach(causal);
  const content=freeze(copy(raw)),result={content,speakers:new Map(content.speakers.map(x=>[x.id,x])),chapters:new Map(content.chapters.map(x=>[x.id,x])),nodes:new Map(content.nodes.map(x=>[x.id,x]))};compiled.set(content,result);return result;
 }
 function validateContent(raw){return compile(raw).content;}
 function contextCheck(c,book){keys(c,['attemptId','levelId','levelDataVersion','variantId','chapterId']);assert(integer(c.levelId,1,10000)&&typeof c.attemptId==='string'&&c.attemptId.length<=120&&Number.isSafeInteger(Number(c.attemptId.split('-')[2]))&&new RegExp('^a-'+c.levelId+'-[1-9][0-9]*-[0-9a-f]{8}$(?![\\s\\S])').test(c.attemptId)&&text(c.levelDataVersion,80)&&text(c.variantId,80)&&book.chapters.get(c.chapterId)?.levelId===c.levelId);}
 function create(content,context){const book=compile(content);contextCheck(context,book);return freeze({version:'story-v1',contentVersion:book.content.contentVersion,context:copy(context),cursor:0,events:[],narrativeEvents:[],fired:[],acknowledged:[],selectedChoices:[],active:null,pending:[],journal:[]});}
 function eventCheck(e,internal=false){
  keys(e,['id','type','turn','wave','subject','materialId','quantity','total','cell']);assert(identity(e.id,internal?16384:240)&&TYPES.includes(e.type)&&integer(e.turn,0,10000)&&integer(e.wave,0,10000)&&nullableId(e.subject)&&nullableId(e.materialId)&&integer(e.quantity)&&integer(e.total)&&integer(e.cell,-1,10000));
  assert(internal===['story_choice_selected','dialogue_acknowledged'].includes(e.type));
  if(e.type==='material_collected')assert(e.subject!==null&&e.materialId!==null&&e.quantity>0&&e.total>=e.quantity&&e.cell>=0);
  if(e.type==='material_goal_completed')assert(e.subject===e.materialId&&e.materialId!==null&&e.quantity>0&&e.total>=e.quantity&&e.cell===-1);
  if(e.type==='valid_match')assert(e.quantity>=3&&e.subject===null&&e.materialId===null&&e.total===0&&e.cell===-1);
  if(['level_started','level_won','level_lost'].includes(e.type))assert(e.subject===null&&e.materialId===null&&e.quantity===0&&e.total===0&&e.cell===-1);
  if(e.type==='region_opened')assert(e.subject!==null&&e.materialId===null&&e.quantity===0&&e.total===0&&e.cell===-1);
  if(internal)assert(e.subject!==null&&e.materialId===null&&e.quantity===0&&e.total===0&&e.cell===-1);
  if(e.type==='blocker_damaged'||e.type==='blocker_broken')assert(e.subject!==null&&e.materialId===null&&e.quantity===1&&e.cell>=0&&(e.type!=='blocker_broken'||e.total===0));
 }
 function factsCheck(facts){assert(dense(facts)&&facts.length<=LIMITS.events);const ids=new Set();let lastTurn=0,lastWave=0,terminal=false;for(let i=0;i<facts.length;i++){const e=facts[i];eventCheck(e);assert(!ids.has(e.id)&&!terminal&&e.turn>=lastTurn&&(e.turn!==lastTurn||e.wave>=lastWave));ids.add(e.id);if(i===0)assert(e.type==='level_started'&&e.turn===0&&e.wave===0);else assert(e.type!=='level_started'&&(e.turn>0||['level_won','level_lost'].includes(e.type))&&e.wave>0);lastTurn=e.turn;lastWave=e.wave;terminal=e.type==='level_won'||e.type==='level_lost';}}
 function basic(content,state){const book=compile(content);keys(state,['version','contentVersion','context','cursor','events','narrativeEvents','fired','acknowledged','selectedChoices','active','pending','journal']);assert(state.version==='story-v1'&&state.contentVersion===book.content.contentVersion);contextCheck(state.context,book);assert(integer(state.cursor,0,LIMITS.events)&&dense(state.events)&&state.cursor===state.events.length&&dense(state.narrativeEvents)&&state.narrativeEvents.length<=LIMITS.history&&dense(state.fired)&&state.fired.length<=LIMITS.history&&dense(state.acknowledged)&&state.acknowledged.length<=LIMITS.history&&dense(state.selectedChoices)&&state.selectedChoices.length<=LIMITS.history&&dense(state.pending)&&state.pending.length+(state.active===null?0:1)<=LIMITS.queue&&dense(state.journal)&&state.journal.length<=LIMITS.journal);return book;}
 function matches(f,e){return f.event===e.type&&(f.materialId===null||f.materialId===e.materialId)&&(f.subject===null||f.subject===e.subject);}
 function conditions(n,s){return n.conditions.every(c=>c.kind==='event_seen'?[...s.events,...s.narrativeEvents].some(e=>matches(c,e)):c.kind==='node_acknowledged'?s.acknowledged.some(a=>a.nodeId===c.nodeId):s.selectedChoices.some(a=>a.nodeId===c.nodeId&&a.choiceId===c.choiceId));}
 const compare=book=>(a,b)=>{const x=book.nodes.get(a.nodeId),y=book.nodes.get(b.nodeId);return y.priority-x.priority||x.order-y.order||(a.nodeId<b.nodeId?-1:a.nodeId>b.nodeId?1:0)||(a.instanceId<b.instanceId?-1:a.instanceId>b.instanceId?1:0);};
 function admit(book,s,n,e){if(s.fired.some(f=>f.instanceId===e.id+'/node/'+n.id))return;if(s.fired.filter(f=>f.nodeId===n.id).length>=(n.once?1:LIMITS.repeat)||s.fired.length>=LIMITS.history||s.pending.length+(s.active?1:0)>=LIMITS.queue)return;const item={instanceId:e.id+'/node/'+n.id,nodeId:n.id,eventId:e.id};assert(identity(item.instanceId));s.fired.push(item);if(s.active===null)s.active=copy(item);else{s.pending.push(copy(item));s.pending.sort(compare(book));}}
 function triggers(book,s,e){const candidates=[...book.nodes.values()].filter(n=>n.chapterId===s.context.chapterId&&n.trigger!==null&&matches(n.trigger,e)&&conditions(n,s));candidates.sort((a,b)=>b.priority-a.priority||a.order-b.order);for(const n of candidates)admit(book,s,n,e);}
 function appendJournal(s,j){assert(s.journal.length<LIMITS.journal);s.journal.push(j);}
 function observe(content,state,facts){const book=basic(content,state);factsCheck(facts);assert(facts.every(e=>e.id.startsWith(state.context.attemptId+'/')));const common=Math.min(state.cursor,facts.length);for(let i=0;i<common;i++)assert(same(state.events[i],facts[i]));if(facts.length<=state.cursor)return freeze(copy(state));const s=copy(state);for(let i=s.cursor;i<facts.length;i++){const e=copy(facts[i]);s.events.push(e);s.cursor++;triggers(book,s,e);}const previous=s.journal.at(-1);if(previous?.kind==='observe')previous.through=s.cursor;else appendJournal(s,{kind:'observe',through:s.cursor});return freeze(s);}
 function finish(book,s,n,event,next){s.active=null;if(next!==null){const target=book.nodes.get(next);assert(conditions(target,s));admit(book,s,target,event);}triggers(book,s,event);if(s.active===null&&s.pending.length)s.active=s.pending.shift();else if(s.active!==null&&s.pending.length){/* Existing pending is earlier than the directly enqueued successor only by priority. */const items=[s.active,...s.pending];items.sort(compare(book));s.active=items.shift();s.pending=items;}return freeze(s);}
 function action(content,state,instanceId,skipped,choiceId){
  const book=basic(content,state);assert(identity(instanceId));
  const oldChoice=state.selectedChoices.find(x=>x.instanceId===instanceId),oldAck=state.acknowledged.find(x=>x.instanceId===instanceId);
  if(choiceId!==null){assert(id(choiceId));if(oldChoice){assert(oldChoice.choiceId===choiceId);return freeze(copy(state));}assert(!oldAck);}else if(oldAck){assert(!oldChoice&&oldAck.skipped===skipped);return freeze(copy(state));}
  assert(state.active!==null&&state.active.instanceId===instanceId);const n=book.nodes.get(state.active.nodeId);assert(n&&n.chapterId===state.context.chapterId);let next=n.next;
  if(choiceId!==null){const selected=n.choices.find(c=>c.id===choiceId);assert(selected);next=selected.next;}else assert(n.choices.length===0||skipped);
  const s=copy(state);assert(s.acknowledged.length<LIMITS.history&&s.narrativeEvents.length<LIMITS.history);
  s.acknowledged.push({instanceId,nodeId:n.id,skipped});if(choiceId!==null)s.selectedChoices.push({instanceId,nodeId:n.id,choiceId});
  const last=s.events.at(-1),e={id:instanceId+(choiceId===null?'/ack':'/choice/'+choiceId),type:choiceId===null?'dialogue_acknowledged':'story_choice_selected',turn:last?.turn??0,wave:last?.wave??0,subject:n.id,materialId:null,quantity:0,total:0,cell:-1};eventCheck(e,true);s.narrativeEvents.push(e);
  appendJournal(s,choiceId===null?{kind:'ack',instanceId,skipped}:{kind:'choice',instanceId,choiceId});return finish(book,s,n,e,next);
 }
 function acknowledge(content,state,instanceId,skipped=false){assert(typeof skipped==='boolean');return action(content,state,instanceId,skipped,null);}
 function choose(content,state,instanceId,choiceId){return action(content,state,instanceId,false,choiceId);}
 function restore(content,raw,context,facts){
  basic(content,raw);contextCheck(context,compile(content));assert(same(context,raw.context));factsCheck(facts);assert(facts.every(e=>e.id.startsWith(context.attemptId+'/')));assert(raw.cursor===facts.length);let s=create(content,context);
  for(const j of raw.journal){assert(map(j));if(j.kind==='observe'){keys(j,['kind','through']);assert(integer(j.through,1,facts.length)&&j.through>s.cursor);s=observe(content,s,facts.slice(0,j.through));}else if(j.kind==='ack'){keys(j,['kind','instanceId','skipped']);s=acknowledge(content,s,j.instanceId,j.skipped);}else if(j.kind==='choice'){keys(j,['kind','instanceId','choiceId']);s=choose(content,s,j.instanceId,j.choiceId);}else fail();}
  assert(same(raw,s));return s;
 }
 function active(content,state){const book=basic(content,state);if(!state.active)return null;const n=book.nodes.get(state.active.nodeId);assert(n);return freeze({instanceId:state.active.instanceId,nodeId:n.id,speakerId:n.speakerId,speakerName:book.speakers.get(n.speakerId).name,text:n.text,pose:n.pose,choices:n.choices.map(c=>({id:c.id,text:c.text})),sceneId:n.sceneId});}
 const api=Object.freeze({TYPES,LIMITS,validateContent,create,observe,acknowledge,choose,restore,snapshot:state=>copy(state),active});root.HexStory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
