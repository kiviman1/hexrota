/* Versioned first-play presentation policy. The host owns progress and commits;
 * this module has no timing or gameplay authority. */
(function(root){
 'use strict';
 const V1='onboarding-v1',V2='onboarding-v2',versions=Object.freeze([V1,V2]);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 function invalid(kind){throw new TypeError('invalid_onboarding_'+kind);}
 function exact(value,names,kind){
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(kind);
  const keys=Reflect.ownKeys(value);if(keys.length!==names.length||keys.some(key=>typeof key!=='string'||!names.includes(key))||names.some(key=>!own(value,key)||!Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,key),'value')))invalid(kind);
 }
 function validate(value){exact(value,['version'],'policy');if(!versions.includes(value.version))invalid('policy');return Object.freeze({version:value.version});}
 function normalize(value,options){
  exact(options,['existingRecord','eligible'],'context');if(typeof options.existingRecord!=='boolean'||typeof options.eligible!=='boolean')invalid('context');
  if(value===undefined)return !options.existingRecord&&options.eligible?Object.freeze({version:V2}):null;
  return validate(value);
 }
 function isV2(policy){return policy===null||policy===undefined?false:validate(policy).version===V2;}
 const policies=Object.freeze({
  [V1]:Object.freeze({version:V1,automaticFeedback:false,feedbackMs:900,idleMs:4000}),
  [V2]:Object.freeze({version:V2,automaticFeedback:true,feedbackMs:900,idleMs:4000})
 });
 function rules(policy){return policies[isV2(policy)?V2:V1];}
 function requiresAcknowledgement(policy,step){return !isV2(policy)&&step?.acknowledge===true;}
 const projection=(title,text,concept,autonomy)=>Object.freeze({title,text,concept,autonomy});
 function project(policy,facts){
  if(!isV2(policy))return null;
  if(!facts||typeof facts!=='object'||Array.isArray(facts))invalid('projection');
  const descriptor=Object.getOwnPropertyDescriptor(facts,'levelId');if(!descriptor||!own(descriptor,'value'))invalid('projection');
  if(!['learn-1','learn-2'].includes(descriptor.value))return null;
  exact(facts,['levelId','turn','phase'],'projection');
  const {levelId,turn,phase}=facts;if(!Number.isInteger(turn)||turn<0||turn>2147483647||!['ready','result','busy'].includes(phase))invalid('projection');
  const result=phase!=='ready';
  if(levelId==='learn-1'){
   if(turn===0)return projection('2’yi 1’e kaydır.','Ya da ikisine sırayla dokun.','swap',false);
   if(turn>=3)return projection('İlk alan yeşerdi!','Her yer yeşil. Yeni zemine hazırsın.','both',false);
   if(result)return turn===1?projection('Yeşil zemin kalır.','Şimdi bir üçlü daha bul.','ground',false):projection('Biraz daha yeşerdi.','Son iki yeri de yeşert.','ground',false);
   return turn===1?projection('Sıra sende: bir üçlü bul.','Yeşil yerler yeni taşlar gelse de kalır.','ground',true):projection('Son iki yeri yeşert.','Bir üçlü daha bul.','ground',true);
  }
  if(turn===0)return projection('Noktalı yeri yeşert.','Noktalı zeminde bir üçlü oluştur.','ground',phase==='ready');
  if(turn>=4)return projection('Görev tamam!','Puanın yeterli ve her yer yeşil.','both',false);
  if(result){
   if(turn===1)return projection('Bir eşleşme daha gerekiyor.','Noktalı yerde bir nokta kaldı.','ground',false);
   if(turn===2)return projection('Yeni taşlar da eşleşti!','Ek hamle harcamadın. Hedefin 25 puan.','score',false);
   return projection('Puan tamam; son yeri yeşert.','Bir yer kaldı. Onu da yeşile boya.','both',false);
  }
  return turn<3?projection('25 puana ulaş.','Bir üçlü daha bul.','score',true):projection('Puan tamam; son yeri yeşert.','Son bir üçlü bul.','both',true);
 }
 const api=Object.freeze({versions,normalize,validate,isV2,rules,requiresAcknowledgement,project});root.HexOnboardingPolicy=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
