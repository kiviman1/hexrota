/* Game save normalization is separate from DOM/bootstrap. This module reads
 * only through the supplied host adapter and never writes a profile. */
(function(root) {
  'use strict';
  const KEY = 'hexrota-match-v5';
  const LEGACY_KEYS = Object.freeze(['hexrota-match-v4', 'hexrota-match-v3', 'hexrota-match-v2']);
  const DEFAULT_PREFERENCES = Object.freeze({ music: false, volume: .65, motion: 'auto', haptics: false });
  const map = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  function defaults() { return {current:0,done:[],boards:{},attempts:{},attemptStats:{},variantSelection:{seed:0,serial:0,counts:{},recent:{}},guideAcks:[],sound:false,preferences:{...DEFAULT_PREFERENCES},records:{}}; }
  function normalize(raw, levels, tutorials) {
    if (!map(raw)) throw new Error('invalid_game_save');
    raw = clone(raw);
    const saved = defaults();
    if(raw&&typeof raw==='object'){
      if(Object.prototype.hasOwnProperty.call(raw,'economy'))saved.economy=raw.economy;
      if(Object.prototype.hasOwnProperty.call(raw,'rescue'))saved.rescue=raw.rescue;
      saved.done=Array.isArray(raw.done)?[...new Set(raw.done.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
      saved.current=Number.isInteger(raw.current)&&raw.current>=0&&raw.current<levels.length?raw.current:0;
      saved.sound=raw.sound===true;
      saved.guideAcks=Array.isArray(raw.guideAcks)?[...new Set(raw.guideAcks.filter(id=>typeof id==='string'&&tutorials.some((level,index)=>level.steps.some((step,turn)=>step.acknowledge&&id===`${index}:${turn+1}`))))]:[];
      const preferences=raw.preferences||{};
      saved.preferences={music:preferences.music===true,volume:Number.isFinite(preferences.volume)?Math.max(0,Math.min(1,preferences.volume)):.65,motion:['auto','reduce','full'].includes(preferences.motion)?preferences.motion:'auto',haptics:preferences.haptics===true};
      if(raw.records&&typeof raw.records==='object')for(let i=0;i<levels.length;i++){
        const r=raw.records[i];
        if(r&&Number.isInteger(r.score)&&r.score>=0&&r.score<=1000000&&Number.isInteger(r.movesLeft)&&r.movesLeft>=0&&r.movesLeft<=levels[i].moves)saved.records[i]={score:r.score,movesLeft:r.movesLeft,plays:Number.isInteger(r.plays)&&r.plays>=0?Math.min(r.plays,1000000):0};
      }
      if(raw.boards&&typeof raw.boards==='object')for(let i=0;i<levels.length;i++)if(raw.boards[i]&&typeof raw.boards[i]==='object')saved.boards[i]=raw.boards[i];
      if(raw.attempts&&typeof raw.attempts==='object')for(let i=0;i<levels.length;i++)if(Object.prototype.hasOwnProperty.call(raw.attempts,i))saved.attempts[i]=raw.attempts[i];
      if(raw.attemptStats&&typeof raw.attemptStats==='object')for(let i=0;i<levels.length;i++)if(raw.attemptStats[i]&&typeof raw.attemptStats[i]==='object'&&!Array.isArray(raw.attemptStats[i]))saved.attemptStats[i]=raw.attemptStats[i];
      const selection=raw.variantSelection;
      if(selection&&typeof selection==='object'){
        if(Number.isInteger(selection.seed)&&selection.seed>0&&selection.seed<=0xffffffff)saved.variantSelection.seed=selection.seed;
        if(Number.isSafeInteger(selection.serial)&&selection.serial>=0)saved.variantSelection.serial=selection.serial;
        for(const level of levels){
          const id=String(level.id),count=selection.counts?.[id],recent=selection.recent?.[id];
          if(Number.isSafeInteger(count)&&count>=0)saved.variantSelection.counts[id]=count;
          if(Array.isArray(recent))saved.variantSelection.recent[id]=recent.filter(value=>typeof value==='string'&&value.length<=80).slice(-16);
        }
      }

    }

    return saved;
  }
  function load({ read, contains, levels, tutorials }) {
    let sourceSaveKey = KEY, migrated = false, raw = null;
    // Missing is not the same as a present null/false/corrupt legacy document.
    if (contains(KEY)) {
      raw = read(KEY);
      if (!map(raw)) throw new Error('invalid_game_save');
    } else {
      for (const name of LEGACY_KEYS) {
        if (!contains(name)) continue;
        const previous = read(name);
        if (!map(previous)) throw new Error('invalid_game_save');
        sourceSaveKey = name; migrated = true;
        const tutorialCount = tutorials.length, campaignCount = levels.length - tutorialCount, boards = {};
        if (name === 'hexrota-match-v4' && previous.boards) {
          for (let i = 0; i < campaignCount; i++) if (previous.boards[i]) boards[i + tutorialCount] = previous.boards[i];
        }
        raw = {
          current: Number.isInteger(previous.current) ? previous.current + tutorialCount : tutorialCount,
          done: [...tutorials.map((_, i) => i), ...(Array.isArray(previous.done) ? previous.done.filter(i => Number.isInteger(i) && i >= 0 && i < campaignCount).map(i => i + tutorialCount) : [])],
          boards, sound: previous.sound,
          ...(Object.prototype.hasOwnProperty.call(previous, 'economy') ? { economy: previous.economy } : {}),
          ...(Object.prototype.hasOwnProperty.call(previous, 'rescue') ? { rescue: previous.rescue } : {})
        };
        break;
      }
    }
    const saved = raw === null ? defaults() : normalize(raw, levels, tutorials);
    // The old sound-only preference is not authoritative progression data.
    if (raw === null) try { saved.sound = read('hexrota-v1')?.sound === true; } catch (_) {}
    return { saved, sourceSaveKey, migrated };
  }
  const api = Object.freeze({ KEY, LEGACY_KEYS, DEFAULT_PREFERENCES, defaults, normalize, load });
  root.HexGameSave = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
