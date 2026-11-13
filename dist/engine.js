/* Deterministic hexagonal match-three rules. No UI or storage dependencies. */
(function (global) {
  'use strict';
  const topologyCache = new WeakMap();
  const directions = [[1,0],[0,1],[1,-1]];
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
    findMatches(values=this.values){
      const marked=new Set();
      for(const line of this.topology.lines){
        let start=0;
        for(let j=1;j<=line.length;j++){
          if(j<line.length&&values[line[j]]!=null&&values[line[j]]===values[line[start]])continue;
          if(values[line[start]]!=null&&j-start>=3)for(let k=start;k<j;k++)marked.add(line[k]);
          start=j;
        }
      }
      return [...marked].sort((a,b)=>a-b);
    }
    legalMoves(){
      const moves=[];
      for(const [a,b] of this.topology.pairs){
        if(this.values[a]===this.values[b])continue;
        [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
        const match=this.findMatches();
        [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
        if(match.length)moves.push([a,b]);
      }
      return moves;
    }
    _gravity(matched){
      const removed=new Set(matched);
      for(const column of this.topology.columns){
        const survivors=column.filter(i=>!removed.has(i)).map(i=>this.values[i]);
        const missing=column.length-survivors.length;
        const replacements=Array.from({length:missing},()=>this._number());
        const next=replacements.concat(survivors);
        column.forEach((index,j)=>{this.values[index]=next[j];});
      }
    }
    _stableBoard(){
      // Bounded construction: a fourth palette value always breaks a 3-axis run.
      for(let attempt=0;attempt<256;attempt++){
        this.values=this.values.map(()=>this._number());
        if(!this.findMatches().length && this.legalMoves().length)return true;
      }
      // Deterministic two-color lattice fallback: each axis alternates or has
      // pairs, so there are no existing runs. Production shapes admit a swap.
      for(const coefficients of [[1,2],[2,1],[1,-1]])for(let offset=0;offset<4;offset++){
        this.values=this.level.cells.map(c=>this.level.palette[Math.floor((((coefficients[0]*c.q+coefficients[1]*c.r+offset)%4)+4)%4/2)]);
        if(!this.findMatches().length&&this.legalMoves().length)return true;
      }
      throw new Error('This board shape cannot provide a settled legal swap');
    }
    _ensurePlayable(){
      if(this.legalMoves().length)return false;
      const base=this.values.slice();
      for(let attempt=0;attempt<128;attempt++){
        this.values=base.slice();
        for(let i=this.values.length-1;i>0;i--){const j=this._random()%(i+1);[this.values[i],this.values[j]]=[this.values[j],this.values[i]];}
        if(!this.findMatches().length&&this.legalMoves().length)return true;
      }
      this._stableBoard();return true;
    }
    swap(a,b){
      if(this.status!=='playing')return {ok:false,reason:this.status,frames:[],scoreGain:0,reshuffled:false};
      if(!this.adjacent(a,b))return {ok:false,reason:'neighbor',frames:[],scoreGain:0,reshuffled:false};
      [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
      let matched=this.findMatches();
      if(!matched.length){[this.values[a],this.values[b]]=[this.values[b],this.values[a]];return {ok:false,reason:'no-match',frames:[],scoreGain:0,reshuffled:false};}
      this.movesLeft--;this.turn++;this.history.push([a,b]);
      const frames=[];let totalGain=0,safetyReset=false;
      while(matched.length){
        const before=this.values.slice(),scoreGain=matched.reduce((n,i)=>n+this.values[i],0);
        matched.forEach(i=>{this.layers[i]=Math.max(0,this.layers[i]-1);});
        this.score+=scoreGain;totalGain+=scoreGain;this._gravity(matched);
        frames.push({matched:matched.slice(),before,after:this.values.slice(),layers:this.layers.slice(),scoreGain});
        matched=this.findMatches();
        if(frames.length>=32 && matched.length){this._stableBoard();safetyReset=true;break;}
      }
      const reshuffled=(this.status==='playing'?this._ensurePlayable():false)||safetyReset;
      return {ok:true,reason:null,frames,scoreGain:totalGain,reshuffled};
    }
    snapshot(){return {version:2,values:this.values.slice(),layers:this.layers.slice(),score:this.score,movesLeft:this.movesLeft,turn:this.turn,rngState:this.rngState,history:this.history.map(p=>p.slice())};}
    clone(){
      const copy=Object.create(HexMatch.prototype);
      copy.level=this.level;copy.topology=this.topology;copy.neighbors=this.neighbors;
      copy.values=this.values.slice();copy.layers=this.layers.slice();copy.score=this.score;copy.movesLeft=this.movesLeft;copy.turn=this.turn;copy.rngState=this.rngState;copy.history=this.history.map(p=>p.slice());
      return copy;
    }
    _restore(s){
      const n=this.total;
      if(s.version!==2||!Array.isArray(s.values)||s.values.length!==n||s.values.some(v=>!this.level.palette.includes(v))||!Array.isArray(s.layers)||s.layers.length!==n||s.layers.some((v,i)=>!Number.isInteger(v)||v<0||v>(this.level.cells[i].layers||1))||!Number.isInteger(s.score)||s.score<0||!Number.isInteger(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||!Number.isInteger(s.turn)||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!Array.isArray(s.history)||s.history.length!==s.turn||s.history.some(p=>!Array.isArray(p)||p.length!==2||!this.adjacent(p[0],p[1]))||this.findMatches(s.values).length)throw new Error('Invalid match-three checkpoint');
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)throw new Error('Invalid checkpoint history');
      if(replay.score!==s.score||replay.movesLeft!==s.movesLeft||replay.turn!==s.turn||replay.rngState!==s.rngState||replay.values.some((v,i)=>v!==s.values[i])||replay.layers.some((v,i)=>v!==s.layers[i]))throw new Error('Checkpoint does not match its history');
      Object.assign(this,{values:replay.values,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history});
    }
    hint(){
      if(this.status!=='playing')return null;
      const solution=this.level.solution||[];
      if(this.history.length<solution.length&&this.history.every((p,i)=>solution[i]&&((p[0]===solution[i][0]&&p[1]===solution[i][1])||(p[0]===solution[i][1]&&p[1]===solution[i][0])))){
        const pair=solution[this.history.length];
        if(this.legalMoves().some(p=>(p[0]===pair[0]&&p[1]===pair[1])||(p[1]===pair[0]&&p[0]===pair[1])))return {pair:pair.slice()};
      }
      const clock=()=>typeof performance!=='undefined'?performance.now():Date.now(),end=clock()+90;
      const initialLayers=this.remainingLayers;
      let beam=[{game:this,first:null,rank:0}],best=null;
      for(let depth=0;depth<3;depth++){
        const next=[];
        for(const node of beam){
          for(const pair of node.game.legalMoves()){
            const child=node.game.clone();child.swap(...pair);
            const first=node.first||pair;
            const rank=(initialLayers-child.remainingLayers)*120+(child.covered-this.covered)*45+Math.min(child.score-this.score,Math.max(0,this.level.target-this.score))*.8-depth*8;
            if(child.status==='won')return {pair:first.slice()};
            const item={game:child,first,rank};next.push(item);if(!best||rank>best.rank)best=item;
            if(clock()>end)return best?{pair:best.first.slice()}:null;
          }
        }
        next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,10);if(!beam.length)break;
      }
      return best?{pair:best.first.slice()}:null;
    }
  }
  global.HexMatch=HexMatch;
})(typeof window!=='undefined'?window:globalThis);
