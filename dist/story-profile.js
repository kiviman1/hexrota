/* Strict narrative profile projection. Canonical boards and attempt metadata
 * prove every stored story state; no clocks, storage or UI live here. */
(function(root){
 'use strict';
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key),map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function createAdapter({content,Story,Events,Engine,catalog,levels,tutorialCount}){
  content=Story.validateContent(content);const chapters=new Map(content.chapters.map(chapter=>[chapter.levelId,chapter]));
  const invalid=()=>{throw new Error('invalid_story_profile');};
  const plain=value=>{if(!map(value)||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,key),'value')))invalid();};
  function context(metadata){const chapter=chapters.get(metadata?.levelId);if(!chapter)invalid();return {attemptId:metadata.attemptId,levelId:metadata.levelId,levelDataVersion:metadata.levelDataVersion,variantId:metadata.variantId,chapterId:chapter.id};}
  function relevant(index){return Number.isInteger(index)&&index>=tutorialCount&&index<levels.length&&chapters.has(levels[index].id);}
  function create(){return {version:'story-profile-v1',states:{}};}
  function restore(raw,game){
   if(!map(game))invalid();const boards=game.boards||{},attempts=game.attempts||{};
   if(raw===undefined){if(Object.keys(boards).some(key=>relevant(Number(key))))invalid();return create();}
   plain(raw);if(Object.keys(raw).length!==2||raw.version!=='story-profile-v1'||!own(raw,'states'))invalid();plain(raw.states);
   const states={};
   for(const key of Object.keys(raw.states)){
    if(!/^(?:0|[1-9]\d*)$/.test(key)||!relevant(Number(key))||!own(boards,key)||!own(attempts,key))invalid();
    const base=levels[Number(key)],checked=catalog.restore(base.id,boards[key],attempts[key]);
    const facts=Events.facts(checked.level,checked.metadata,boards[key],Engine);
    states[key]=Story.restore(content,raw.states[key],context(checked.metadata),facts);
   }
   for(const key of Object.keys(boards))if(relevant(Number(key))&&!own(states,key))invalid();
   return {version:'story-profile-v1',states};
  }
  return Object.freeze({content,create,restore,context,relevant});
 }
 function fromGlobals(scope){
  scope.HexStoryAlpha.validateBindings(scope.HEX_STORY_CONTENT,scope.HEX_MATERIAL_ALPHA_LEVELS);
  const updates=scope.HexStoryAlpha.currentLevels(scope.HEX_MATERIAL_ALPHA_LEVELS),levels=[...scope.HEX_TUTORIALS,...scope.HEX_LEVELS.map(level=>updates.find(update=>update.id===level.id)||level)];
  const classic=scope.HexAttempts.createCatalog(scope.HEX_LEVELS,scope.HEX_VARIANTS,scope.HexMatch),catalog=scope.HexStoryAlpha.createCatalog(classic,scope.HEX_MATERIAL_ALPHA_LEVELS,scope.HexMatch);
  return createAdapter({content:scope.HEX_STORY_CONTENT,Story:scope.HexStory,Events:scope.HexStoryEvents,Engine:scope.HexMatch,catalog,levels,tutorialCount:scope.HEX_TUTORIALS.length});
 }
 const api=Object.freeze({createAdapter,fromGlobals});root.HexStoryProfile=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
