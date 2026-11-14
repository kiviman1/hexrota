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
    const triples = cells.map(() => []);
    for (const line of lines) for (let j=0;j+2<line.length;j++) {
      const triple=line.slice(j,j+3);for(const i of triple)triples[i].push(triple);
    }
    const columnMap=new Map();
    cells.forEach((c,i) => {if (!columnMap.has(c.q)) columnMap.set(c.q,[]);columnMap.get(c.q).push(i);});
    const columns=[...columnMap.entries()].sort((a,b)=>a[0]-b[0]).map(([,indices])=>indices.sort((a,b)=>cells[a].r-cells[b].r));
    const data={neighbors,pairs,lines,columns,triples};topologyCache.set(level,data);return data;
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
    _newMatchesAt(index,value,values=this.values){
      let count=0;
      for(const triple of this.topology.triples[index]) {
        if(triple.every(i=>i===index||values[i]===value))count++;
      }
      return count;
    }
    _fillVacancies(){
      const refill=[];
      for(const column of this.topology.columns)for(const index of column){
        if(this.values[index]!==null)continue;
        let minimum=Infinity,choices=[];
        for(const value of this.level.palette){
          const count=this._newMatchesAt(index,value);
          if(count<minimum){minimum=count;choices=[value];}
          else if(count===minimum)choices.push(value);
        }
        const value=choices[this._random()%choices.length];
        this.values[index]=value;
        refill.push({index,value,forced:minimum>0,minMatches:minimum});
      }
      return refill;
    }
    _gravity(matched){
      const removed=new Set(matched),falls=[],spawnSlots=new Map();
      // Track tile identities before compaction: equal numbers can still move
      // between distinct cells and need their actual origin for animation.
      // This metadata never consumes RNG or participates in game decisions.
      for(const column of this.topology.columns){
        const survivors=column.filter(i=>!removed.has(i)).map(from=>({from,value:this.values[from]}));
        const missing=column.length-survivors.length;
        const next=Array(missing).fill(null).concat(survivors.map(tile=>tile.value));
        survivors.forEach((tile,j)=>{
          const to=column[missing+j];
          if(tile.from!==to)falls.push({from:tile.from,to,value:tile.value,spawn:false});
        });
        for(let j=0;j<missing;j++)spawnSlots.set(column[j],{spawnOrder:j,spawnCount:missing});
        column.forEach((index,j)=>{this.values[index]=next[j];});
      }
      // Compact every column before selecting replacements, preserving natural
      // survivor matches and the existing deterministic controlled-fill order.
      const compacted=this.values.slice(),refill=this._fillVacancies();
      for(const tile of refill)falls.push({from:null,to:tile.index,value:tile.value,spawn:true,...spawnSlots.get(tile.index)});
      return {compacted,refill,falls};
    }
    _stableBoard(){
      // Bounded, match-aware construction rather than unrestricted refill.
      for(let attempt=0;attempt<64;attempt++){
        this.values=this.values.map(()=>null);this._fillVacancies();
        if(!this.findMatches().length&&this.legalMoves().length)return true;
      }
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
        this.score+=scoreGain;totalGain+=scoreGain;const refill=this._gravity(matched);
        frames.push({matched:matched.slice(),before,after:this.values.slice(),layers:this.layers.slice(),scoreGain,...refill});
        matched=this.findMatches();
        if(frames.length>=32 && matched.length){this._stableBoard();safetyReset=true;break;}
      }
      const reshuffled=(this.status==='playing'?this._ensurePlayable():false)||safetyReset;
      return {ok:true,reason:null,frames,scoreGain:totalGain,reshuffled};
    }
    snapshot(){return {version:4,rulesVersion:'classic-v4',values:this.values.slice(),layers:this.layers.slice(),score:this.score,movesLeft:this.movesLeft,turn:this.turn,rngState:this.rngState,history:this.history.map(p=>p.slice())};}
    clone(){
      const copy=Object.create(HexMatch.prototype);
      copy.level=this.level;copy.topology=this.topology;copy.neighbors=this.neighbors;
      copy.values=this.values.slice();copy.layers=this.layers.slice();copy.score=this.score;copy.movesLeft=this.movesLeft;copy.turn=this.turn;copy.rngState=this.rngState;copy.history=this.history.map(p=>p.slice());
      return copy;
    }
    _restore(s){
      const n=this.total;
      if(s.version!==4||s.rulesVersion!=='classic-v4'||!Array.isArray(s.values)||s.values.length!==n||s.values.some(v=>!this.level.palette.includes(v))||!Array.isArray(s.layers)||s.layers.length!==n||s.layers.some((v,i)=>!Number.isInteger(v)||v<0||v>(this.level.cells[i].layers||1))||!Number.isInteger(s.score)||s.score<0||!Number.isInteger(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||!Number.isInteger(s.turn)||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!Array.isArray(s.history)||s.history.length!==s.turn||s.history.some(p=>!Array.isArray(p)||p.length!==2||!this.adjacent(p[0],p[1]))||this.findMatches(s.values).length)throw new Error('Invalid match-three checkpoint');
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)throw new Error('Invalid checkpoint history');
      if(replay.score!==s.score||replay.movesLeft!==s.movesLeft||replay.turn!==s.turn||replay.rngState!==s.rngState||replay.values.some((v,i)=>v!==s.values[i])||replay.layers.some((v,i)=>v!==s.layers[i]))throw new Error('Checkpoint does not match its history');
      Object.assign(this,{values:replay.values,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history});
    }
    hint(options={}){
      if(this.status!=='playing')return null;
      options=options&&typeof options==='object'?options:{};
      const legal=this.legalMoves();if(!legal.length)return null;
      const same=(a,b)=>a&&b&&((a[0]===b[0]&&a[1]===b[1])||(a[0]===b[1]&&a[1]===b[0]));
      const routes=[...(Array.isArray(this.level.solutions)?this.level.solutions:[]),this.level.solution,...(this.level.alternativeSolutions||[])].filter(route=>Array.isArray(route)&&route.length);
      // Both independently certified openings remain useful after either route is chosen.
      for(const route of routes){
        if(this.history.length>=route.length||!this.history.every((pair,index)=>same(pair,route[index])))continue;
        const pair=route[this.history.length];
        if(legal.some(move=>same(move,pair)))return {pair:pair.slice(),source:'proven_route',guaranteed:true,continuation:route.slice(this.history.length).map(move=>move.slice()),searchedNodes:0,depth:0,truncated:false};
      }
      const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
      const nodeLimited=Number.isInteger(options.maxNodes)&&options.maxNodes>0;
      const maxNodes=Math.min(100000,nodeLimited?options.maxNodes:5000);
      const budget=Math.max(1,Math.min(150,Number(options.maxMs)||90)),end=clock()+budget;
      const maxDepth=Math.min(this.movesLeft,Math.max(1,Math.min(3,Number(options.maxDepth)||3)));
      const width=Math.max(1,Math.min(32,Math.floor(Number(options.beamWidth)||10)));
      const initialLayers=this.remainingLayers,visited=new Set();
      let beam=[{game:this,path:[],rank:0}],bestPlaying=null,bestLost=null,searchedNodes=0,depthReached=0;
      const reply=(source='heuristic',item=null,truncated=false)=>({
        pair:(item?.path[0]||bestPlaying?.path[0]||bestLost?.path[0]||legal[0]).slice(),source,guaranteed:source!=='heuristic',
        continuation:source==='heuristic'?null:item.path.map(move=>move.slice()),searchedNodes,depth:depthReached,truncated
      });
      const exhausted=()=>searchedNodes>=maxNodes||(!nodeLimited&&clock()>=end);
      for(let depth=0;depth<maxDepth;depth++){
        const next=[];
        for(const node of beam){
          // A lost board cannot be expanded into a fictitious future recovery.
          if(node.game.status!=='playing')continue;
          for(const pair of node.game.legalMoves()){
            if(exhausted())return reply('heuristic',null,true);
            const child=node.game.clone(),result=child.swap(...pair);if(!result.ok)continue;
            searchedNodes++;depthReached=Math.max(depthReached,depth+1);
            const path=node.path.concat([pair.slice()]);
            const progress=initialLayers-child.remainingLayers,green=child.covered-this.covered;
            const points=Math.min(child.score,this.level.target)-Math.min(this.score,this.level.target);
            const urgency=Math.max(0,this.level.target-child.score)/Math.max(1,child.movesLeft);
            const item={game:child,path,rank:progress*120+green*45+points*.8-(depth+1)*8-urgency*.35};
            if(child.status==='won')return reply('search_win',item,false);
            if(child.status==='lost'){if(!bestLost||item.rank>bestLost.rank)bestLost=item;continue;}
            if(!bestPlaying||item.rank>bestPlaying.rank)bestPlaying=item;
            const state=child.values.join(',')+'/'+child.layers.join(',')+'/'+child.score+'/'+child.movesLeft+'/'+child.rngState;
            if(visited.has(state))continue;visited.add(state);next.push(item);
          }
        }
        next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,width);if(!beam.length)break;
      }
      return reply();
    }
  }
  global.HexMatch=HexMatch;
})(typeof window!=='undefined'?window:globalThis);
