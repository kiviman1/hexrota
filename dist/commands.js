/* Versioned assistance commands. The classic-v4 engine and its reader are unchanged. */
(function(root){
  'use strict';
  const RULES='assisted-v1',VERSION=1,COMMANDS_VERSION=1,MAX_COMMANDS=512;
  const DEFAULT_LIMITS=Object.freeze({greenBrush:1,colorKey:1,rescue:1});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const equal=(a,b)=>{
    if(a===b)return true;
    if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
    return object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.prototype.hasOwnProperty.call(b,key)&&equal(a[key],b[key]));
  };
  const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
  const token=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(value)&&!/[\r\n]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
  const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
  const stateKeys=['values','layers','score','movesLeft','turn','rngState','history'];
  const snapshotKeys=['version','rulesVersion','commandsVersion','baseRulesVersion','levelId','attemptId','limits','usage','bonusMoves','assisted','commands',...stateKeys];
  function fail(message){throw new Error(message);}
  function limits(value){
    if(!exact(value,['greenBrush','colorKey','rescue'])||!integer(value.greenBrush)||value.greenBrush>100||!integer(value.colorKey)||value.colorKey>100||value.rescue!==1)fail('Invalid assisted limits');
    return clone(value);
  }
  function canonical(command){
    if(!object(command)||!token(command.id)||typeof command.type!=='string')return null;
    if(command.type==='swap'&&exact(command,['id','type','a','b'])&&integer(command.a)&&integer(command.b))return clone(command);
    if(command.type==='green_brush'&&exact(command,['id','type','index'])&&integer(command.index))return clone(command);
    if(command.type==='color_key'&&exact(command,['id','type','index','value'])&&integer(command.index)&&integer(command.value))return clone(command);
    if(command.type==='grant_moves'&&exact(command,['id','type','moves'])&&command.moves===5)return clone(command);
    return null;
  }
  function invalid(command,reason,usage){
    return {ok:false,reason,frames:[],scoreGain:0,reshuffled:false,commandId:token(command?.id)?command.id:null,type:typeof command?.type==='string'?command.type:null,duplicate:false,movesSpent:0,layersRemoved:0,usage:clone(usage)};
  }
  class AssistedGame {
    constructor(level,{attemptId,limits:requestedLimits}={},snapshot=null){
      if(!token(attemptId)||(!Number.isSafeInteger(level?.id)&&typeof level?.id!=='string'))fail('Invalid assisted identity');
      if(typeof root.HexMatch!=='function')fail('Classic engine is required');
      this.level=level;this.attemptId=attemptId;
      this.limits=limits(requestedLimits===undefined?DEFAULT_LIMITS:requestedLimits);
      this.usage={greenBrush:0,colorKey:0,rescue:0};this.bonusMoves=0;
      this.commands=[];this._results=new Map();this._model=new root.HexMatch(level);
      if(snapshot!==null&&snapshot!==undefined){
        if(snapshot.version===4&&snapshot.rulesVersion==='classic-v4')this._importClassic(snapshot);
        else this._restore(snapshot,requestedLimits);
      }
    }
    get model(){return this._model;}
    get topology(){return this._model.topology;}
    get neighbors(){return this._model.neighbors;}
    get values(){return this._model.values;}
    get layers(){return this._model.layers;}
    get score(){return this._model.score;}
    get movesLeft(){return this._model.movesLeft;}
    get turn(){return this._model.turn;}
    get rngState(){return this._model.rngState;}
    get history(){return this._model.history;}
    get total(){return this._model.total;}
    get covered(){return this._model.covered;}
    get remainingLayers(){return this._model.remainingLayers;}
    get status(){return this._model.status;}
    get assisted(){return this.usage.greenBrush+this.usage.colorKey+this.usage.rescue>0;}
    adjacent(a,b){return this._model.adjacent(a,b);}
    legalMoves(){return this._model.legalMoves();}
    findMatches(values){return this._model.findMatches(values);}
    presentationSnapshot(){
      return Object.fromEntries(stateKeys.map(key=>[key,clone(this._model[key])]));
    }
    snapshot(){
      return {version:VERSION,rulesVersion:RULES,commandsVersion:COMMANDS_VERSION,baseRulesVersion:'classic-v4',levelId:clone(this.level.id),attemptId:this.attemptId,limits:clone(this.limits),usage:clone(this.usage),bonusMoves:this.bonusMoves,assisted:this.assisted,commands:clone(this.commands),...this.presentationSnapshot()};
    }
    classicSnapshot(){
      if(this.assisted)fail('Assisted state is not a classic-v4 checkpoint');
      return this._model.snapshot();
    }
    clone(){
      const copy=Object.create(AssistedGame.prototype);
      copy.level=this.level;copy.attemptId=this.attemptId;copy.limits=clone(this.limits);copy.usage=clone(this.usage);copy.bonusMoves=this.bonusMoves;
      copy.commands=clone(this.commands);copy._model=this._model.clone();copy._results=new Map([...this._results].map(([id,value])=>[id,clone(value)]));return copy;
    }
    _importClassic(snapshot){
      const verified=new root.HexMatch(this.level,snapshot);
      for(const [index,pair]of verified.history.entries()){
        const result=this.apply({id:'legacy-swap:'+(index+1),type:'swap',a:pair[0],b:pair[1]});
        if(!result.ok)fail('Invalid classic command migration');
      }
      if(!equal(this._model.snapshot(),verified.snapshot()))fail('Classic command migration mismatch');
    }
    _restore(snapshot,requestedLimits){
      if(!exact(snapshot,snapshotKeys)||snapshot.version!==VERSION||snapshot.rulesVersion!==RULES||snapshot.commandsVersion!==COMMANDS_VERSION||snapshot.baseRulesVersion!=='classic-v4'||snapshot.attemptId!==this.attemptId||snapshot.levelId!==this.level.id||!Array.isArray(snapshot.commands)||snapshot.commands.length>MAX_COMMANDS)fail('Invalid assisted checkpoint');
      this.limits=limits(snapshot.limits);
      if(requestedLimits!==undefined&&!equal(limits(requestedLimits),this.limits))fail('Assisted limits do not match the checkpoint');
      for(const command of snapshot.commands){const result=this.apply(command);if(!result.ok||result.duplicate)fail('Invalid assisted command history');}
      if(!equal(this.snapshot(),snapshot))fail('Assisted checkpoint does not match its command history');
    }
    preview(command){
      const copy=this.clone(),result=copy.apply(command);
      return {result,snapshot:copy.snapshot(),status:copy.status,covered:copy.covered,remainingLayers:copy.remainingLayers};
    }
    apply(input){
      const command=canonical(input);
      if(!command)return invalid(input,'invalid_command',this.usage);
      const previous=this._results.get(command.id);
      if(previous)return equal(previous.command,command)?{...clone(previous.result),duplicate:true}:invalid(command,'command_id_conflict',this.usage);
      if(this.commands.length>=MAX_COMMANDS)return invalid(command,'command_limit',this.usage);
      const model=this._model.clone(),usage=clone(this.usage),beforeLayers=model.remainingLayers;let bonus=this.bonusMoves,mechanics;
      if(command.type==='swap'){
        mechanics=model.swap(command.a,command.b);if(!mechanics.ok)return invalid(command,mechanics.reason,usage);
      }else if(command.type==='grant_moves'){
        if(model.status!=='lost'||model.movesLeft!==0||this.commands.at(-1)?.type!=='swap')return invalid(command,'rescue_unavailable',usage);
        if(usage.rescue>=this.limits.rescue)return invalid(command,'rescue_limit',usage);
        usage.rescue++;bonus+=5;model.movesLeft+=5;
        mechanics={ok:true,reason:null,frames:[],scoreGain:0,reshuffled:false};
      }else{
        if(model.status!=='playing')return invalid(command,model.status,usage);
        if(command.index>=model.total)return invalid(command,'invalid_target',usage);
        if(command.type==='green_brush'){
          if(model.layers[command.index]===0)return invalid(command,'ground_empty',usage);
          if(usage.greenBrush>=this.limits.greenBrush)return invalid(command,'green_brush_limit',usage);
          model.layers[command.index]--;usage.greenBrush++;
          mechanics={ok:true,reason:null,frames:[],scoreGain:0,reshuffled:false};
        }else{
          if(!this.level.palette.includes(command.value)||model.values[command.index]===command.value)return invalid(command,'invalid_value',usage);
          if(usage.colorKey>=this.limits.colorKey)return invalid(command,'color_key_limit',usage);
          model.values[command.index]=command.value;usage.colorKey++;
          const frames=[];let totalGain=0,safetyReset=false,matched=model.findMatches();
          while(matched.length){
            const before=model.values.slice(),scoreGain=matched.reduce((sum,index)=>sum+model.values[index],0);
            for(const index of matched)model.layers[index]=Math.max(0,model.layers[index]-1);
            model.score+=scoreGain;totalGain+=scoreGain;const refill=model._gravity(matched);
            frames.push({matched:matched.slice(),before,after:model.values.slice(),layers:model.layers.slice(),scoreGain,...refill});
            matched=model.findMatches();if(frames.length>=32&&matched.length){model._stableBoard();safetyReset=true;break;}
          }
          const reshuffled=(model.status==='playing'?model._ensurePlayable():false)||safetyReset;
          mechanics={ok:true,reason:null,frames,scoreGain:totalGain,reshuffled};
        }
      }
      const result={...mechanics,commandId:command.id,type:command.type,duplicate:false,movesSpent:command.type==='swap'?1:0,layersRemoved:beforeLayers-model.remainingLayers,usage:clone(usage)};
      this._model=model;this.usage=usage;this.bonusMoves=bonus;this.commands.push(command);this._results.set(command.id,{command:clone(command),result:clone(result)});return clone(result);
    }
    swap(a,b,id=null){return this.apply({id:id===null?'swap:'+(this.commands.length+1):id,type:'swap',a,b});}
    hint(options={}){
      const model=this._model.clone();
      if(this.assisted){model.level={...this.level};for(const field of ['solutions','solution','alternativeSolutions'])delete model.level[field];}
      return model.hint(options);
    }
  }
  const api=Object.freeze({AssistedGame,VERSION,RULES_VERSION:RULES,COMMANDS_VERSION,MAX_COMMANDS,DEFAULT_LIMITS,isAssistedSnapshot:value=>object(value)&&value.version===VERSION&&value.rulesVersion===RULES});
  root.HexCommands=api;root.HexAssistedGame=AssistedGame;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
