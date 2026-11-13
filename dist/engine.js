/* Deterministic hexagonal match-three rules. No UI or storage dependencies. */
(function (global) {
  'use strict';
  const topologyCache = new WeakMap();
  const directions = [[1,0],[0,1],[1,-1]];
  const validPower = p => p === null || p === 'ring' || p === 'sprout';
  function topology(level) {
    if (topologyCache.has(level)) return topologyCache.get(level);
    const cells = level.cells, byCoord = new Map(cells.map((c,i) => [`${c.q},${c.r}`,i]));
    const neighbors = cells.map(() => []), pairs = [], lines = [];
    for (let i=0;i<cells.length;i++) {
      const c = cells[i];
      for (const [dq,dr] of directions) {
        const next = byCoord.get(`${c.q+dq},${c.r+dr}`);
        if (next !== undefined) { neighbors[i].push(next); neighbors[next].push(i); pairs.push([i,next]); }
        if (byCoord.has(`${c.q-dq},${c.r-dr}`)) continue;
        const line=[]; let q=c.q,r=c.r;
        while (byCoord.has(`${q},${r}`)) {line.push(byCoord.get(`${q},${r}`));q+=dq;r+=dr;}
        if (line.length>=3) lines.push(line);
      }
    }
    neighbors.forEach(list=>list.sort((a,b)=>a-b));
    const columnMap=new Map();
    cells.forEach((c,i) => {if (!columnMap.has(c.q)) columnMap.set(c.q,[]);columnMap.get(c.q).push(i);});
    const columns=[...columnMap.entries()].sort((a,b)=>a[0]-b[0]).map(([,indices])=>indices.sort((a,b)=>cells[a].r-cells[b].r));
    const data={neighbors,pairs,lines,columns};topologyCache.set(level,data);return data;
  }
  class HexMatch {
    constructor(level, snapshot=null) {
      this.level=level; this.topology=topology(level); this.neighbors=this.topology.neighbors;
      this.reset();
      if (snapshot) this._restore(snapshot);
    }
    reset() {
      this.values=this.level.initial.slice();this.layers=this.level.cells.map(c=>c.layers||1);
      this.specials=this.level.cells.map((_,i)=>this.level.initialSpecials?.[i]||null);
      this.score=0;this.movesLeft=this.level.moves;this.turn=0;this.rngState=(this.level.seed>>>0)||0x9e3779b9;this.history=[];
    }
    get total(){return this.values.length;}
    get covered(){return this.layers.reduce((n,v)=>n+Number(v===0),0);}
    get remainingLayers(){return this.layers.reduce((a,b)=>a+b,0);}
    get status(){
      const scoreMet=this.level.targetMode==='exact'?this.score===this.level.target:this.score>=this.level.target;
      if(this.covered===this.total && scoreMet)return 'won';
      if(this.movesLeft<=0 || (this.level.targetMode==='exact' && this.score>this.level.target))return 'lost';
      return 'playing';
    }
    adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&!!this.neighbors[a]?.includes(b);}
    _random(){let x=this.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;this.rngState=x>>>0;return this.rngState;}
    _number(){return this.level.palette[this._random()%this.level.palette.length];}
    _runs(values=this.values){
      const runs=[];
      for(const line of this.topology.lines){
        let start=0;
        for(let j=1;j<=line.length;j++){
          if(j<line.length&&values[line[j]]!=null&&values[line[j]]===values[line[start]])continue;
          if(values[line[start]]!=null&&j-start>=3)runs.push(line.slice(start,j));
          start=j;
        }
      }
      return runs;
    }
    findMatches(values=this.values){return [...new Set(this._runs(values).flat())].sort((a,b)=>a-b);}
    legalMoves(){
      const moves=[];
      for(const [a,b] of this.topology.pairs){
        if(this.specials[a]||this.specials[b]){moves.push([a,b]);continue;}
        if(this.values[a]===this.values[b])continue;
        [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
        const match=this.findMatches();
        [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
        if(match.length)moves.push([a,b]);
      }
      return moves;
    }
    _birth(runs,a,b){
      const enabled=this.level.powers||[];
      const candidates=new Set();let type=null;
      if(enabled.includes('sprout')){
        for(const run of runs)if(run.length>=5)run.forEach(i=>candidates.add(i));
        for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
          const shared=runs[i].filter(k=>runs[j].includes(k));
          if(shared.length)for(const k of runs[i].concat(runs[j]))candidates.add(k);
        }
        if(candidates.size)type='sprout';
      }
      if(!type&&enabled.includes('ring')){
        for(const run of runs)if(run.length>=4)run.forEach(i=>candidates.add(i));
        if(candidates.size)type='ring';
      }
      if(!type)return null;
      const eligible=[...candidates].filter(i=>!this.specials[i]).sort((x,y)=>x-y);
      const index=eligible.includes(b)?b:eligible.includes(a)?a:eligible[0];
      return index===undefined?null:{index,type};
    }
    _sproutPath(start){
      const path=[start],visited=new Set(path);
      while(path.length<4){
        const origin=path[path.length-1],queue=[[origin]],seen=new Set([origin]);let route=null;
        for(let cursor=0;cursor<queue.length;cursor++){
          const current=queue[cursor],last=current[current.length-1];
          if(last!==origin&&!visited.has(last)&&this.layers[last]>0){route=current;break;}
          const next=this.neighbors[last].filter(i=>!seen.has(i)&&!visited.has(i));
          next.sort((a,b)=>(this.layers[b]>0?1:0)-(this.layers[a]>0?1:0)||this.layers[b]-this.layers[a]||a-b);
          for(const index of next){seen.add(index);queue.push(current.concat(index));}
        }
        if(!route){
          const next=this.neighbors[origin].find(i=>!visited.has(i));
          if(next===undefined)break;
          route=[origin,next];
        }
        let extended=false;
        for(const index of route.slice(1)){
          if(path.length===4)break;
          if(visited.has(index))continue;
          path.push(index);visited.add(index);extended=true;
        }
        if(!extended)break;
      }
      return path;
    }
    previewPower(index){
      const type=this.specials[index];
      return type==='ring'?[index,...this.neighbors[index]]:type==='sprout'?this._sproutPath(index):[];
    }
    _effects(initial){
      const hit=new Set(initial),activated=[],fired=new Set();
      const queue=[...hit].sort((a,b)=>a-b);
      for(let cursor=0;cursor<queue.length;cursor++){
        const index=queue[cursor],type=this.specials[index];
        if(!type||fired.has(index))continue;
        fired.add(index);
        const affected=this.previewPower(index);
        activated.push({index,type,affected:affected.slice()});
        for(const cell of affected)if(!hit.has(cell)){hit.add(cell);queue.push(cell);}
      }
      return {hit:[...hit].sort((a,b)=>a-b),activated};
    }
    _gravity(removed){
      const cleared=new Set(removed);
      for(const column of this.topology.columns){
        const survivors=column.filter(i=>!cleared.has(i)).map(i=>({value:this.values[i],special:this.specials[i]}));
        const missing=column.length-survivors.length;
        const replacements=Array.from({length:missing},()=>({value:this._number(),special:null}));
        const next=replacements.concat(survivors);
        column.forEach((index,j)=>{this.values[index]=next[j].value;this.specials[index]=next[j].special;});
      }
    }
    _stableBoard(){
      // Values settle independently; existing special tiles are never destroyed here.
      for(let attempt=0;attempt<256;attempt++){
        this.values=this.values.map(()=>this._number());
        if(!this.findMatches().length && this.legalMoves().length)return true;
      }
      for(const coefficients of [[1,2],[2,1],[1,-1]])for(let offset=0;offset<4;offset++){
        this.values=this.level.cells.map(c=>this.level.palette[Math.floor((((coefficients[0]*c.q+coefficients[1]*c.r+offset)%4)+4)%4/2)]);
        if(!this.findMatches().length&&this.legalMoves().length)return true;
      }
      throw new Error('This board shape cannot provide a settled legal swap');
    }
    _ensurePlayable(){
      if(this.legalMoves().length)return false;
      const base=this.values.map((value,i)=>({value,special:this.specials[i]}));
      for(let attempt=0;attempt<128;attempt++){
        const tiles=base.slice();
        for(let i=tiles.length-1;i>0;i--){const j=this._random()%(i+1);[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
        this.values=tiles.map(t=>t.value);this.specials=tiles.map(t=>t.special);
        if(!this.findMatches().length&&this.legalMoves().length)return true;
      }
      this._stableBoard();return true;
    }
    swap(a,b){
      if(this.status!=='playing')return {ok:false,reason:this.status,frames:[],scoreGain:0,reshuffled:false};
      if(!this.adjacent(a,b))return {ok:false,reason:'neighbor',frames:[],scoreGain:0,reshuffled:false};
      const activating=!!(this.specials[a]||this.specials[b]);
      [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
      [this.specials[a],this.specials[b]]=[this.specials[b],this.specials[a]];
      let runs=this._runs(),matched=[...new Set(runs.flat())];
      const triggers=activating?[a,b].filter(i=>this.specials[i]):[];
      if(!matched.length&&!triggers.length){
        [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
        [this.specials[a],this.specials[b]]=[this.specials[b],this.specials[a]];
        return {ok:false,reason:'no-match',frames:[],scoreGain:0,reshuffled:false};
      }
      this.movesLeft--;this.turn++;this.history.push([a,b]);
      const frames=[];let totalGain=0,safetyReset=false;
      while(matched.length||(!frames.length&&triggers.length)){
        const before=this.values.slice(),beforeSpecials=this.specials.slice();
        const birth=!frames.length&&!activating?this._birth(runs,a,b):null;
        const effects=this._effects(matched.concat(!frames.length?triggers:[]));
        const hit=effects.hit,scoreGain=hit.reduce((n,i)=>n+this.values[i],0);
        hit.forEach(i=>{this.layers[i]=Math.max(0,this.layers[i]-1);this.specials[i]=null;});
        if(birth)this.specials[birth.index]=birth.type;
        const removed=hit.filter(i=>!birth||i!==birth.index);
        this.score+=scoreGain;totalGain+=scoreGain;this._gravity(removed);
        frames.push({matched:hit,removed,before,after:this.values.slice(),beforeSpecials,afterSpecials:this.specials.slice(),layers:this.layers.slice(),scoreGain,activated:effects.activated,created:birth?[birth]:[]});
        runs=this._runs();matched=[...new Set(runs.flat())];
        if(frames.length>=32&&matched.length){this._stableBoard();safetyReset=true;break;}
      }
      const reshuffled=(this.status==='playing'?this._ensurePlayable():false)||safetyReset;
      return {ok:true,reason:null,frames,scoreGain:totalGain,reshuffled};
    }
    snapshot(){return {version:3,values:this.values.slice(),specials:this.specials.slice(),layers:this.layers.slice(),score:this.score,movesLeft:this.movesLeft,turn:this.turn,rngState:this.rngState,history:this.history.map(p=>p.slice())};}
    clone(){
      const copy=Object.create(HexMatch.prototype);
      copy.level=this.level;copy.topology=this.topology;copy.neighbors=this.neighbors;
      copy.values=this.values.slice();copy.specials=this.specials.slice();copy.layers=this.layers.slice();copy.score=this.score;copy.movesLeft=this.movesLeft;copy.turn=this.turn;copy.rngState=this.rngState;copy.history=this.history.map(p=>p.slice());
      return copy;
    }
    _restore(s){
      const n=this.total;
      if(s.version!==3||!Array.isArray(s.values)||s.values.length!==n||s.values.some(v=>!this.level.palette.includes(v))||!Array.isArray(s.specials)||s.specials.length!==n||s.specials.some(p=>!validPower(p))||!Array.isArray(s.layers)||s.layers.length!==n||s.layers.some((v,i)=>!Number.isInteger(v)||v<0||v>(this.level.cells[i].layers||1))||!Number.isInteger(s.score)||s.score<0||!Number.isInteger(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||!Number.isInteger(s.turn)||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!Array.isArray(s.history)||s.history.length!==s.turn||s.history.some(p=>!Array.isArray(p)||p.length!==2||!this.adjacent(p[0],p[1]))||this.findMatches(s.values).length)throw new Error('Invalid match-three checkpoint');
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)throw new Error('Invalid checkpoint history');
      if(replay.score!==s.score||replay.movesLeft!==s.movesLeft||replay.turn!==s.turn||replay.rngState!==s.rngState||replay.values.some((v,i)=>v!==s.values[i])||replay.specials.some((v,i)=>v!==s.specials[i])||replay.layers.some((v,i)=>v!==s.layers[i]))throw new Error('Checkpoint does not match its history');
      Object.assign(this,{values:replay.values,specials:replay.specials,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history});
    }
    hint(options={}){
      if(this.status!=='playing')return null;
      const solution=this.level.solution||[],legal=this.legalMoves();
      if(this.history.length<solution.length&&this.history.every((p,i)=>solution[i]&&((p[0]===solution[i][0]&&p[1]===solution[i][1])||(p[0]===solution[i][1]&&p[1]===solution[i][0])))){
        const pair=solution[this.history.length];
        if(legal.some(p=>(p[0]===pair[0]&&p[1]===pair[1])||(p[1]===pair[0]&&p[0]===pair[1])))return {pair:pair.slice()};
      }
      if(!legal.length)return null;
      const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
      const budget=Math.max(1,Math.min(150,Number(options.maxMs)||90)),maxDepth=Math.max(1,Math.min(3,Number(options.maxDepth)||3)),end=clock()+budget;
      const initialLayers=this.remainingLayers;
      let beam=[{game:this,first:null,rank:0}],best=null;
      for(let depth=0;depth<maxDepth;depth++){
        const next=[];
        for(const node of beam){
          if(clock()>=end)return {pair:(best?.first||legal[0]).slice()};
          for(const pair of node.game.legalMoves()){
            if(clock()>=end)return {pair:(best?.first||legal[0]).slice()};
            const child=node.game.clone();child.swap(...pair);
            const first=node.first||pair;
            const rank=(initialLayers-child.remainingLayers)*120+(child.covered-this.covered)*45+Math.min(child.score-this.score,Math.max(0,this.level.target-this.score))*.8-depth*8;
            if(child.status==='won')return {pair:first.slice()};
            const item={game:child,first,rank};next.push(item);if(!best||rank>best.rank)best=item;
          }
        }
        next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,10);if(!beam.length)break;
      }
      return {pair:(best?.first||legal[0]).slice()};
    }
  }
  global.HexMatch=HexMatch;
})(typeof window!=='undefined'?window:globalThis);
