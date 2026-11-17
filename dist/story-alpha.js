/* Story review uses the unchanged material catalog and a distinct storage scope.
 * Narrative versions never rename or reinterpret a gameplay attempt identity. */
(function(root){
 'use strict';
 const prefix='hexrota-story-9-15:',version='story-alpha-v1',levelDataVersion='material-alpha-v1',variantId='materials-v1',versions=Object.freeze([version]);
 let enabled=false;try{enabled=new URLSearchParams(root.location?.search||'').get('dev')==='story-9-15';}catch(_){}
 function material(){const api=root.HexMaterialAlpha;if(!api||typeof api.createCatalog!=='function'||typeof api.currentLevels!=='function')throw new Error('Material catalog unavailable for story alpha');return api;}
 function storage(backing){return Object.freeze({getItem:key=>backing.getItem(prefix+key),setItem:(key,value)=>backing.setItem(prefix+key,value),removeItem:key=>backing.removeItem(prefix+key)});}
 function currentLevels(levels){return material().currentLevels(levels);}
 function createCatalog(classic,levels,Engine=root.HexMatch,options={}){return material().createCatalog(classic,levels,Engine,options);}
 function validateBindings(content,levels){
  if(typeof root.HexStory?.validateContent!=='function')throw new Error('Story engine unavailable for story alpha');
  const book=root.HexStory.validateContent(content),byLevel=new Map(currentLevels(levels).map(level=>[level.id,level]));
  const reject=()=>{throw new Error('Invalid story gameplay binding');};
  function check(filter,level,chapterId){
   const sources=level.materials.sources,goals=level.objectives.materials,boxes=level.obstacles.blockers,regions=level.obstacles.regions;
   if(filter.event==='material_collected'){
    const possible=sources.filter(source=>(filter.materialId===null||source.materialId===filter.materialId)&&(filter.subject===null||source.id===filter.subject));if(!possible.length)reject();return;
   }
   if(filter.event==='material_goal_completed'){
    const possible=goals.filter(goal=>(filter.materialId===null||goal.materialId===filter.materialId)&&(filter.subject===null||goal.materialId===filter.subject));if(!possible.length)reject();return;
   }
   if(filter.materialId!==null)reject();
   if(filter.event==='blocker_damaged'||filter.event==='blocker_broken'){if(!boxes.some(box=>filter.subject===null||box.id===filter.subject))reject();return;}
   if(filter.event==='region_opened'){if(!regions.some(region=>filter.subject===null||region.id===filter.subject))reject();return;}
   if(filter.event==='story_choice_selected'||filter.event==='dialogue_acknowledged'){
    const possible=book.nodes.filter(node=>node.chapterId===chapterId&&(filter.subject===null||node.id===filter.subject)&&(filter.event!=='story_choice_selected'||node.choices.length>0));if(!possible.length)reject();return;
   }
   if(filter.subject!==null)reject();
  }
  for(const chapter of book.chapters){const level=byLevel.get(chapter.levelId);if(!level)reject();for(const node of book.nodes.filter(node=>node.chapterId===chapter.id)){if(node.trigger!==null)check(node.trigger,level,chapter.id);for(const condition of node.conditions)if(condition.kind==='event_seen')check({event:condition.event,materialId:condition.materialId,subject:condition.subject},level,chapter.id);}}
  return book;
 }
 const api=Object.freeze({enabled,prefix,version,versions,levelDataVersion,variantId,storage,currentLevels,createCatalog,validateBindings});root.HexStoryAlpha=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
