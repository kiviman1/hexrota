/* Canonical gameplay-to-story projection. Replays an isolated engine once;
 * neither the live board nor analytics, storage, clocks or presentation decide facts. */
(function(root){
 'use strict';
 const VERSION='story-events-v1',MAX_EVENTS=4096,MAX_POSITION=10000;
 const id=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}(?![\s\S])/.test(value);
 const int32=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
 const positive=value=>int32(value)&&value>0;
 const dense=value=>{if(!Array.isArray(value)||Object.keys(value).length!==value.length)return false;for(let i=0;i<value.length;i++)if(!Object.prototype.hasOwnProperty.call(value,i))return false;return true;};
 const record=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
 const fail=()=>{throw new Error('Invalid canonical story facts');};
 function equal(actual,expected){
  if(actual===expected)return true;
  if(actual===null||expected===null||typeof actual!==typeof expected||typeof actual!=='object')return false;
  if(Array.isArray(expected))return dense(actual)&&actual.length===expected.length&&expected.every((value,index)=>equal(actual[index],value));
  const keys=Object.keys(expected);return record(actual,keys)&&keys.every(key=>equal(actual[key],expected[key]));
 }
 function metadataFor(metadata,level=null){
  if(!record(metadata,['attemptVersion','levelId','variantId','levelDataVersion','attemptId','attemptSerial'])||metadata.attemptVersion!==1||!positive(metadata.levelId)||!Number.isSafeInteger(metadata.attemptSerial)||metadata.attemptSerial<1||!['variantId','levelDataVersion'].every(key=>typeof metadata[key]==='string'&&metadata[key].length>0&&metadata[key].length<=80)||typeof metadata.attemptId!=='string'||(!metadata.attemptId.startsWith('a-'+metadata.levelId+'-'+metadata.attemptSerial+'-')||!/^[0-9a-f]{8}(?![\s\S])/.test(metadata.attemptId.slice(('a-'+metadata.levelId+'-'+metadata.attemptSerial+'-').length))))fail();
  if(level&&(level.id!==metadata.levelId||level.variantId!==metadata.variantId||level.levelDataVersion!==metadata.levelDataVersion))fail();
  return {attemptId:metadata.attemptId,levelId:metadata.levelId,variantId:metadata.variantId,levelDataVersion:metadata.levelDataVersion};
 }
 function context(content,metadata){
  const clean=metadataFor(metadata),chapters=content?.chapters;
  if(!dense(chapters)||!chapters.length||new Set(chapters.map(chapter=>chapter?.id)).size!==chapters.length||new Set(chapters.map(chapter=>chapter?.levelId)).size!==chapters.length||chapters.some(chapter=>!record(chapter,['id','levelId'])||!id(chapter.id)||!positive(chapter.levelId)))fail();
  const chapter=chapters.find(chapter=>chapter.levelId===clean.levelId);if(!chapter)fail();
  return Object.freeze({attemptId:clean.attemptId,levelId:clean.levelId,levelDataVersion:clean.levelDataVersion,variantId:clean.variantId,chapterId:chapter.id});
 }
 function facts(level,metadata,snapshot,Engine=root.HexMatch){
  metadataFor(metadata,level);if(typeof Engine!=='function'||!level||typeof level!=='object'||Array.isArray(level))fail();
  const game=new Engine(level),initial=game.snapshot(),keys=Object.keys(initial);
  if(!record(snapshot,keys)||!dense(snapshot.history)||!int32(snapshot.turn)||snapshot.turn>MAX_POSITION||snapshot.history.length!==snapshot.turn||snapshot.history.some(pair=>!dense(pair)||pair.length!==2||!pair.every(int32)||pair.some(index=>index>=game.total))||!int32(snapshot.score)||!int32(snapshot.movesLeft)||!Number.isInteger(snapshot.rngState)||snapshot.rngState<1||snapshot.rngState>4294967295||!dense(snapshot.values)||snapshot.values.length!==game.total||snapshot.values.some(value=>value!==null&&(!Number.isInteger(value)||value< -2147483648||value>2147483647))||!dense(snapshot.layers)||snapshot.layers.length!==game.total||snapshot.layers.some(value=>!int32(value)))fail();
  const boxes=level.obstacles?.blockers||[],regions=level.obstacles?.regions||[],definitions=level.materials?.definitions||[],sources=level.materials?.sources||[],goals=level.objectives?.materials||[];
  if([boxes,regions,definitions,sources].some(items=>!dense(items)||items.some(item=>!id(item.id)))||!dense(goals)||goals.some(goal=>!id(goal.materialId)))fail();
  const boxesById=new Map(boxes.map(box=>[box.id,box])),sourceById=new Map(sources.map(source=>[source.id,source])),materialIds=new Map(definitions.map((definition,index)=>[definition.id,index])),totals=definitions.map(()=>0),collected=new Set(),completed=new Set(),seen=new Set(),events=[];
  function emit(type,turn,wave,subject=null,materialId=null,quantity=0,total=0,cell=-1){
   const eventId=metadata.attemptId+'/'+turn+'/'+wave+'/'+type+'/'+(subject||'wave');
   if(events.length>=MAX_EVENTS||seen.has(eventId)||eventId.length>240||!/^[A-Za-z0-9:/._-]+(?![\s\S])/.test(eventId)||!int32(turn)||turn>MAX_POSITION||!int32(wave)||wave>MAX_POSITION||subject!==null&&!id(subject)||materialId!==null&&!id(materialId)||!int32(quantity)||!int32(total)||!Number.isInteger(cell)||cell< -1||cell>MAX_POSITION)fail();
   seen.add(eventId);events.push(Object.freeze({id:eventId,type,turn,wave,subject,materialId,quantity,total,cell}));
  }
  function materials(frame,kind,turn,wave){
   for(const event of frame.materialEvents||[]){
    if(event.kind!==kind)continue;
    const source=sourceById.get(event.sourceId),index=materialIds.get(event.materialId);
    if(!source||collected.has(event.sourceId)||source.kind!==kind||source.materialId!==event.materialId||source.quantity!==event.quantity||source.cell!==event.cell||index===undefined||!positive(event.quantity))fail();
    totals[index]+=event.quantity;if(!int32(totals[index]))fail();collected.add(event.sourceId);
    emit('material_collected',turn,wave,event.sourceId,event.materialId,event.quantity,totals[index],event.cell);
   }
  }
  function terminal(turn,wave){if(game.status==='won')emit('level_won',turn,wave);else if(game.status==='lost')emit('level_lost',turn,wave);}
  emit('level_started',0,0);
  if(game.status!=='playing')terminal(0,1);
  for(const pair of snapshot.history){
   const result=game.swap(pair[0],pair[1]);if(!result?.ok||!dense(result.frames)||!result.frames.length)fail();
   const turn=game.turn;
   result.frames.forEach((frame,index)=>{
    const wave=index+1;if(!dense(frame.matched)||frame.matched.length<3)fail();
    emit('valid_match',turn,wave,null,null,frame.matched.length);
    materials(frame,'matched-cell',turn,wave);
    for(const hit of frame.blockerHits||[]){if(!boxesById.has(hit.id)||boxesById.get(hit.id).cell!==hit.cell||hit.beforeHp!==hit.hp+1||!int32(hit.hp))fail();emit('blocker_damaged',turn,wave,hit.id,null,1,hit.hp,hit.cell);}
    for(const blocker of frame.brokenBlockers||[]){const box=boxesById.get(blocker);if(!box)fail();emit('blocker_broken',turn,wave,blocker,null,1,0,box.cell);}
    materials(frame,'crate-break',turn,wave);
    if(frame.materialCounts!==undefined&&!equal(frame.materialCounts,totals))fail();
    for(const region of frame.openedRegions||[]){if(!regions.some(item=>item.id===region))fail();emit('region_opened',turn,wave,region);}
    for(const goal of goals){const total=totals[materialIds.get(goal.materialId)];if(!completed.has(goal.materialId)&&total>=goal.quantity){completed.add(goal.materialId);emit('material_goal_completed',turn,wave,goal.materialId,goal.materialId,goal.quantity,total);}}
   });
   if(game.status!=='playing')terminal(turn,result.frames.length+1);
  }
  if(!equal(snapshot,game.snapshot()))fail();
  return Object.freeze(events);
 }
 const api=Object.freeze({version:VERSION,facts,context});root.HexStoryEvents=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
