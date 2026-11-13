/* Audio settings and lifecycle regressions; no real sound, timers or network. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const sourcePath=__dirname+'/dist/audio.js';
const unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));

function harness(options={}){
  const timers=new Map(),listeners=new Map(),contexts=[];
  let nextTimer=1,now=0;
  const failures={ctor:false,gain:false,resume:false,...options.failures};
  const document={hidden:false,visibilityState:'visible',
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);}
  };
  class Param{
    constructor(value=0){this.value=value;this.events=[];}
    setValueAtTime(value,time){this.value=value;this.events.push({kind:'set',value,time});return this;}
    linearRampToValueAtTime(value,time){this.value=value;this.events.push({kind:'linear',value,time});return this;}
    exponentialRampToValueAtTime(value,time){this.value=value;this.events.push({kind:'exp',value,time});return this;}
    setTargetAtTime(value,time,constant){this.value=value;this.events.push({kind:'target',value,time,constant});return this;}
    cancelScheduledValues(time){this.events.push({kind:'cancel',time});return this;}
    cancelAndHoldAtTime(time){this.events.push({kind:'hold',time});return this;}
  }
  class Node{
    constructor(context){this.context=context;this.connections=[];this.disconnected=false;}
    connect(node){this.connections.push(node);return node;}
    disconnect(){this.disconnected=true;this.connections=[];}
  }
  class Oscillator extends Node{
    constructor(context){super(context);this.frequency=new Param(440);this.detune=new Param(0);this.started=false;this.ended=false;this.stopTime=Infinity;this.onended=null;this.events=new Map();}
    start(time=this.context.currentTime){this.started=true;this.startTime=time;}
    stop(time=this.context.currentTime){this.stopTime=Math.min(this.stopTime,time);if(this.stopTime<=this.context.currentTime)this.end();}
    addEventListener(type,fn){this.events.set(type,fn);}
    removeEventListener(type,fn){if(this.events.get(type)===fn)this.events.delete(type);}
    end(){if(this.ended)return;this.ended=true;this.onended?.();this.events.get('ended')?.();}
  }
  class AudioContext{
    constructor(){if(failures.ctor)throw new Error('Audio API cannot initialize');this.state=options.initialState||'suspended';this.currentTime=now/1000;this.destination={kind:'destination'};this.gains=[];this.oscillators=[];this.resumeCount=0;this.closeCount=0;contexts.push(this);}
    createGain(){if(failures.gain)throw new Error('Gain API unavailable');const gain=new Node(this);gain.gain=new Param(1);this.gains.push(gain);return gain;}
    createOscillator(){const oscillator=new Oscillator(this);this.oscillators.push(oscillator);return oscillator;}
    resume(){this.resumeCount++;if(failures.resume)return Promise.reject(new Error('Autoplay denied'));this.state='running';return Promise.resolve();}
    close(){this.closeCount++;this.state='closed';return Promise.resolve();}
  }
  const sandbox={document,console,Math,Number,Promise,performance:{now:()=>now},
    setTimeout(fn,delay=0){const id=nextTimer++;timers.set(id,{fn,delay:Number(delay)||0,at:now+(Number(delay)||0)});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  if(options.available!==false)sandbox.AudioContext=AudioContext;
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(sourcePath,'utf8'),sandbox,{filename:'audio.js'});
  function expire(){for(const context of contexts){context.currentTime=now/1000;for(const node of context.oscillators)if(node.stopTime<=context.currentTime)node.end();}}
  function tick(){const entry=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!entry)return false;timers.delete(entry[0]);now=Math.max(now,entry[1].at);expire();entry[1].fn();return true;}
  function visibility(hidden){document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';for(const fn of [...listeners.get('visibilitychange')||[]])fn();}
  const living=()=>contexts.flatMap(c=>c.oscillators).filter(n=>n.started&&!n.ended&&n.stopTime>n.context.currentTime);
  const master=()=>contexts.at(-1)?.gains.find(g=>g.connections.includes(contexts.at(-1).destination));
  return {HexAudio:sandbox.HexAudio,contexts,timers,listeners,failures,tick,visibility,living,master};
}

(async()=>{
  // Music can be enabled in stored settings before a gesture; it still cannot autoplay.
  const h=harness(),audio=new h.HexAudio({sfx:true,music:true,volume:.65});
  assert.equal(h.contexts.length,0,'constructor does not create an audio context');
  audio.configure({music:true});audio.setActive(true);
  assert.equal(h.contexts.length,0,'activation does not bypass unlock');assert.equal(h.timers.size,0);
  assert.equal(await audio.unlock(),true,'gesture unlock succeeds');
  assert.equal(h.contexts.length,1);assert(h.living().length>0,'music creates actual tones');assert.equal(h.timers.size,1,'one music scheduler');
  const beforeNotes=h.contexts[0].oscillators.length;
  for(let n=0;n<5;n++){audio.configure({music:true,sfx:true,volume:.65});audio.setActive(true);}
  assert.equal(h.timers.size,1,'repeated settings do not duplicate the scheduler');
  assert.equal(h.contexts[0].oscillators.length,beforeNotes,'idempotent activation does not stack music');
  for(let n=0;n<40;n++){assert(h.tick());assert.equal(h.timers.size,1,'music retains exactly one future wakeup');assert(h.living().length<=24,'music voices remain bounded over time');}
  audio.configure({music:false});assert.equal(h.timers.size,0,'music off clears the scheduler');assert.equal(h.living().length,0,'music off stops current voices');
  audio.configure({music:true});assert.equal(h.timers.size,1,'reenabling music restarts once');
  h.visibility(true);assert.equal(h.timers.size,0,'hidden page has no music scheduler');assert.equal(h.living().length,0,'hidden page stops music');
  h.visibility(false);assert.equal(h.timers.size,1,'visible active page resumes music');
  audio.setActive(false);assert.equal(h.timers.size,0);assert.equal(h.living().length,0);
  h.visibility(true);h.visibility(false);assert.equal(h.timers.size,0,'visibility cannot resume an inactive game');
  audio.setActive(true);assert.equal(h.timers.size,1);
  audio.configure({volume:2});assert.equal(h.master().gain.value,1,'high volume clamps');
  audio.configure({volume:-2});assert.equal(h.master().gain.value,0,'low volume clamps');
  audio.configure({volume:NaN});assert(Number.isFinite(h.master().gain.value),'NaN never reaches an AudioParam');assert(h.master().gain.value>=0&&h.master().gain.value<=1);
  audio.configure({volume:.4});assert.equal(h.master().gain.value,.4);
  audio.stop();assert.equal(h.timers.size,0);assert.equal(h.living().length,0);
  audio.dispose();audio.dispose();assert.equal(h.contexts[0].closeCount,1,'dispose closes once');assert.equal(h.listeners.get('visibilitychange')?.size||0,0,'dispose removes visibility listener');assert.equal(h.timers.size,0);
  assert.equal(await audio.unlock(),false,'disposed audio cannot reactivate');

  const fx=harness(),effects=new fx.HexAudio({sfx:true,music:false});
  effects.setActive(true);effects.move(1);effects.victory();effects.click();assert.equal(fx.contexts.length,0,'effects also wait for a gesture unlock');
  assert.equal(await effects.unlock(),true);assert.equal(fx.contexts[0].oscillators.length,0,'music-disabled unlock is quiet');
  effects.move(2);const moveCount=fx.contexts[0].oscillators.length;assert(moveCount>0,'move produces a sound');
  effects.victory();assert(fx.contexts[0].oscillators.length>moveCount,'victory produces its own tones');
  effects.click();const enabledCount=fx.contexts[0].oscillators.length;
  effects.configure({sfx:false});effects.move(4);effects.victory();effects.click();assert.equal(fx.contexts[0].oscillators.length,enabledCount,'muted effects create no nodes');
  effects.stop();assert.equal(fx.living().length,0,'stop also releases effects');effects.dispose();

  // Browser restrictions and partially implemented APIs are normal failure paths.
  for(const settings of [{available:false},{failures:{ctor:true}},{failures:{gain:true}},{failures:{resume:true}}]){
    const failed=harness(settings),silent=new failed.HexAudio({music:true,sfx:true,volume:NaN});
    silent.setActive(true);assert.equal(await silent.unlock(),false,'unavailable audio resolves false');
    silent.configure({music:false,sfx:false,volume:Infinity});silent.move(2);silent.victory();silent.click();silent.stop();silent.dispose();
    assert.equal(failed.timers.size,0,'failed audio leaves no scheduled loop');
  }
  const denied=harness({failures:{resume:true}}),retry=new denied.HexAudio({music:true});retry.setActive(true);
  assert.equal(await retry.unlock(),false);denied.failures.resume=false;assert.equal(await retry.unlock(),true,'later gesture can recover from denied autoplay');
  assert.equal(denied.contexts.length,1,'a retry reuses a usable context');assert.equal(denied.timers.size,1);retry.dispose();
  await Promise.resolve();await Promise.resolve();assert.equal(unhandled.length,0,unhandled.join('\n'));
  console.log('Audio checks passed: gesture gating, real tones, singleton music, settings/volume, visibility/pause, failure recovery and disposal.');
})().catch(error=>{console.error(error);process.exitCode=1;});
