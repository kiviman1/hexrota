/* Deterministic hexagonal match-three rules. No UI or storage dependencies. */
(function (global) {
  'use strict';
  const topologyCache = new WeakMap();
  const directions = [[1,0],[0,1],[1,-1]];
  const int32=value=>Number.isInteger(value)&&value>=-2147483648&&value<=2147483647;
  const dense=value=>{if(!Array.isArray(value))return false;for(let i=0;i<value.length;i++)if(!Object.prototype.hasOwnProperty.call(value,i))return false;return true;};
  const materialRules=level=>level.rulesVersion==='classic-v6';
  const obstacleRules=level=>level.rulesVersion==='classic-v5'||materialRules(level);
  const groundLayers=(level,cell)=>obstacleRules(level)?(cell.layers==null?1:cell.layers):(cell.layers==null||cell.layers===0?1:cell.layers);
  const columnFlow=level=>obstacleRules(level)&&level.obstacles.activation==='column-flow-v1';
  function flowCells(level,hp){
    const open=level.cells.map(()=>false),byCoord=new Map(level.cells.map((c,i)=>[c.q+','+c.r,i])),boxes=new Map(level.obstacles.blockers.map((b,i)=>[b.cell,i]));
    for(const source of level.obstacles.sources){let index=source;
      while(index!==undefined){
        const box=boxes.get(index);if(box!==undefined&&hp[box]>0)break;
        open[index]=true;const cell=level.cells[index];index=byCoord.get(cell.q+','+(cell.r+1));
      }
    }
    return open;
  }
  function validateObstacles(level,invalid){
    const data=level.obstacles,n=level.cells.length,id=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(v),index=v=>Number.isInteger(v)&&v>=0&&v<n;
    if(!data||data.version!=='obstacles-v1'||!dense(data.blockers)||!dense(data.regions))invalid();
    const flow=data.activation==='column-flow-v1';
    if(data.activation!==undefined&&!flow)invalid();
    if(flow){
      if(!dense(data.sources)||!data.sources.length||new Set(data.sources).size!==data.sources.length)invalid();
      const columns=new Set();
      for(const i of data.sources){if(!index(i)||columns.has(level.cells[i].q)||level.cells.some(c=>c.q===level.cells[i].q&&c.r<level.cells[i].r))invalid();columns.add(level.cells[i].q);}
    }else if(data.sources!==undefined)invalid();
    const boxes=new Map(),regions=new Map(),occupied=new Set(),closed=new Set();
    for(const box of data.blockers){
      if(!box||!id(box.id)||boxes.has(box.id)||!index(box.cell)||occupied.has(box.cell)||![1,2].includes(box.hp)||(box.required!==undefined&&typeof box.required!=='boolean'))invalid();
      boxes.set(box.id,box);occupied.add(box.cell);
    }
    for(const region of data.regions){
      if(!region||!id(region.id)||regions.has(region.id)||!dense(region.cells)||!region.cells.length||!dense(region.requires)||(flow?region.requires.length!==0:!region.requires.length)||new Set(region.requires).size!==region.requires.length||(region.required!==undefined&&typeof region.required!=='boolean'))invalid();
      for(const i of region.cells){if(!index(i)||closed.has(i))invalid();closed.add(i);}
      for(const key of region.requires)if(!boxes.has(key))invalid();
      regions.set(region.id,region);
    }
    if(flow&&data.blockers.some(b=>b.regionId!==undefined))invalid();
    for(const box of data.blockers)if(box.regionId!==undefined&&(!regions.has(box.regionId)||!regions.get(box.regionId).requires.includes(box.id)))invalid();
    if(flow){
      const initialOpen=flowCells(level,data.blockers.map(b=>b.hp));
      for(let i=0;i<n;i++)if(initialOpen[i]?(!int32(level.initial[i])||!level.palette.includes(level.initial[i])):level.initial[i]!==null)invalid();
      if(!flowCells(level,data.blockers.map(()=>0)).every(Boolean))invalid();
      // Every box must be exposable by real neighboring source-fed cells;
      // exposing a physical hole never grants a separate remote key.
      const hp=data.blockers.map(b=>b.hp);let changed=true;
      while(changed){changed=false;const open=flowCells(level,hp);
        data.blockers.forEach((b,j)=>{if(hp[j]>0&&level.cells.some((c,i)=>{const at=level.cells[b.cell],dq=c.q-at.q,dr=c.r-at.r;return open[i]&&Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))===1;})){hp[j]=0;changed=true;}});
      }
      if(hp.some(v=>v>0))invalid();
      return;
    }
    for(let i=0;i<n;i++)if(occupied.has(i)||closed.has(i)){if(level.initial[i]!==null)invalid();}else if(!int32(level.initial[i])||!level.palette.includes(level.initial[i]))invalid();
    // Structural reachability, not a solver proof: expose boxes next to active
    // axial cells, then regions whose full dependency set can be removed.
    const exposed=new Set(level.cells.map((_,i)=>i).filter(i=>!occupied.has(i)&&!closed.has(i))),removed=new Set(),opened=new Set();
    let changed=true;
    while(changed){changed=false;
      for(const box of data.blockers)if(!removed.has(box.id)&&data.regions.every(r=>!r.cells.includes(box.cell)||opened.has(r.id))&&[...exposed].some(i=>{const a=level.cells[i],b=level.cells[box.cell],dq=a.q-b.q,dr=a.r-b.r;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))===1;})){removed.add(box.id);exposed.add(box.cell);changed=true;}
      for(const region of data.regions)if(!opened.has(region.id)&&region.requires.every(key=>removed.has(key))){opened.add(region.id);region.cells.forEach(i=>{if(!data.blockers.some(b=>b.cell===i&&!removed.has(b.id)))exposed.add(i);});changed=true;}
    }
    if(removed.size!==boxes.size||opened.size!==regions.size)invalid();
  }
  function validateMaterials(level,invalid){
    const own=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
    const id=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(value),data=level.materials,goals=level.objectives;
    if(!own(data,['version','definitions','sources'])||data.version!=='materials-v1'||!dense(data.definitions)||!dense(data.sources)||!own(goals,['version','score','ground','materials'])||goals.version!=='objectives-v1'||typeof goals.score!=='boolean'||typeof goals.ground!=='boolean'||!dense(goals.materials)||!goals.score&&!goals.ground&&!goals.materials.length)invalid();
    const definitions=new Map(),supply=data.definitions.map(()=>0),sources=new Set(),goalIds=new Set(),crates=new Map(level.obstacles.blockers.map(box=>[box.id,box])),boxCells=new Set(level.obstacles.blockers.map(box=>box.cell));
    const coordinates=new Set(level.cells.map(cell=>cell.q+','+cell.r));
    const canMatch=cell=>directions.some(([dq,dr])=>[-2,-1,0].some(start=>[0,1,2].every(step=>coordinates.has((cell.q+(start+step)*dq)+','+(cell.r+(start+step)*dr)))));
    data.definitions.forEach((definition,index)=>{if(!own(definition,['id'])||!id(definition.id)||definitions.has(definition.id))invalid();definitions.set(definition.id,index);});
    for(const source of data.sources){
      if(!own(source,source?.kind==='crate-break'?['id','kind','materialId','quantity','cell','blockerId']:['id','kind','materialId','quantity','cell'])||!id(source.id)||sources.has(source.id)||!definitions.has(source.materialId)||!int32(source.quantity)||source.quantity<=0||!Number.isInteger(source.cell)||source.cell<0||source.cell>=level.cells.length)invalid();
      sources.add(source.id);
      if(source.kind==='crate-break'){if(!crates.has(source.blockerId)||crates.get(source.blockerId).cell!==source.cell)invalid();}
      else if(source.kind!=='matched-cell'||boxCells.has(source.cell)||!canMatch(level.cells[source.cell]))invalid();
      const index=definitions.get(source.materialId);supply[index]+=source.quantity;if(supply[index]>2147483647)invalid();
    }
    for(const goal of goals.materials){
      if(!own(goal,['materialId','quantity'])||!definitions.has(goal.materialId)||goalIds.has(goal.materialId)||!int32(goal.quantity)||goal.quantity<=0||goal.quantity>supply[definitions.get(goal.materialId)])invalid();goalIds.add(goal.materialId);
    }
  }
  function validateLevel(level){
    const invalid=()=>{throw new Error('Invalid match-three level');};
    if(!level||typeof level!=='object'||!dense(level.cells)||!level.cells.length||!dense(level.palette)||!level.palette.length||!dense(level.initial)||level.initial.length!==level.cells.length||!Number.isInteger(level.seed)||level.seed<0||level.seed>0xffffffff||!int32(level.moves)||level.moves<0||!int32(level.target)||level.target<0)invalid();
    const coordinates=new Set(),palette=new Set();let ground=0;
    for(const value of level.palette){if(!int32(value))invalid();palette.add(value);}
    for(const cell of level.cells){
      if(!cell||typeof cell!=='object'||!int32(cell.q)||!int32(cell.r))invalid();
      const key=cell.q+','+cell.r;if(coordinates.has(key))invalid();coordinates.add(key);
      const layers=groundLayers(level,cell);
      if(!int32(layers)||layers<0)invalid();ground+=layers;if(ground>2147483647)invalid();
    }
    if(obstacleRules(level))validateObstacles(level,invalid);
    else{if(level.obstacles!==undefined||![undefined,null,'classic-v4'].includes(level.rulesVersion))invalid();for(const value of level.initial)if(!int32(value)||!palette.has(value))invalid();}
    if(materialRules(level))validateMaterials(level,invalid);
    else if(level.materials!==undefined||level.objectives!==undefined)invalid();
    return true;
  }
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
      validateLevel(level);
      this.level=level; this.topology=topology(level); this.neighbors=this.topology.neighbors;
      this.reset();
      if (snapshot||materialRules(level)&&snapshot!==null) this._restore(snapshot);
    }
    reset() {
      validateLevel(this.level);
      this.values=this.level.initial.slice();this.layers=this.level.cells.map(c=>groundLayers(this.level,c));
      this.score=0;this.movesLeft=this.level.moves;this.turn=0;this.rngState=(this.level.seed>>>0)||0x9e3779b9;this.history=[];
      if(obstacleRules(this.level)){this.blockerHp=this.level.obstacles.blockers.map(b=>b.hp);this.regionOpen=this.level.obstacles.regions.map(()=>false);if(columnFlow(this.level)){this.cellOpen=flowCells(this.level,this.blockerHp);this.regionOpen=this.level.obstacles.regions.map(r=>r.cells.every(i=>this.cellOpen[i]));}}
      if(materialRules(this.level)){this.materialCounts=this.level.materials.definitions.map(()=>0);this.collectedSources=this.level.materials.sources.map(()=>false);}
    }
    get total(){return this.values.length;}
    get covered(){return this.layers.reduce((n,v)=>n+Number(v===0),0);}
    get remainingLayers(){return this.layers.reduce((a,b)=>a+b,0);}
    get status(){
      const scoreMet=this.level.targetMode==='exact'?this.score===this.level.target:this.score>=this.level.target;
      const goals=materialRules(this.level)?this.level.objectives:null;
      const complete=goals?(!goals.score||scoreMet)&&(!goals.ground||this.covered===this.total)&&goals.materials.every(goal=>this.materialCounts[this.level.materials.definitions.findIndex(definition=>definition.id===goal.materialId)]>=goal.quantity):this.covered===this.total&&scoreMet;
      if(complete && (!obstacleRules(this.level)||(this.level.obstacles.blockers.every((b,i)=>b.required===false||this.blockerHp[i]===0)&&this.level.obstacles.regions.every((r,i)=>r.required===false||this.regionOpen[i]))))return 'won';
      if(this.movesLeft<=0 || ((!goals||goals.score)&&this.level.targetMode==='exact' && this.score>this.level.target))return 'lost';
      return 'playing';
    }
    isPlayable(index){
      if(!Number.isInteger(index)||index<0||index>=this.total)return false;
      if(!obstacleRules(this.level))return true;
      if(columnFlow(this.level))return this.cellOpen[index];
      return !this.level.obstacles.blockers.some((b,i)=>b.cell===index&&this.blockerHp[i]>0)&&!this.level.obstacles.regions.some((r,i)=>!this.regionOpen[i]&&r.cells.includes(index));
    }
    _collectMaterials(kind,origins){
      const originSet=new Set(origins),events=[];
      this.level.materials.sources.forEach((source,index)=>{
        if(this.collectedSources[index]||source.kind!==kind)return;
        const eligible=kind==='matched-cell'?originSet.has(source.cell)&&this.isPlayable(source.cell):originSet.has(source.blockerId);
        if(!eligible)return;
        const material=this.level.materials.definitions.findIndex(definition=>definition.id===source.materialId);
        this.materialCounts[material]+=source.quantity;this.collectedSources[index]=true;
        events.push({sourceId:source.id,materialId:source.materialId,quantity:source.quantity,cell:source.cell,kind:source.kind});
      });
      return events;
    }
    _damageBlockers(matched,onBreak=null){
      const blockerHits=[],brokenBlockers=[],openedRegions=[],previousOpen=columnFlow(this.level)?this.cellOpen.slice():null;
      this.level.obstacles.blockers.forEach((box,i)=>{
        if(this.blockerHp[i]>0&&(columnFlow(this.level)||this.level.obstacles.regions.every((r,j)=>this.regionOpen[j]||!r.cells.includes(box.cell)))&&matched.some(index=>this.adjacent(index,box.cell))){
          const beforeHp=this.blockerHp[i];this.blockerHp[i]--;
          blockerHits.push({id:box.id,cell:box.cell,beforeHp,hp:this.blockerHp[i]});
          if(!this.blockerHp[i])brokenBlockers.push(box.id);
        }
      });
      if(onBreak)onBreak(brokenBlockers);
      if(columnFlow(this.level))this.cellOpen=flowCells(this.level,this.blockerHp);
      this.level.obstacles.regions.forEach((region,i)=>{
        if(columnFlow(this.level)){const open=region.cells.every(index=>this.cellOpen[index]);if(open&&!this.regionOpen[i])openedRegions.push(region.id);this.regionOpen[i]=open;return;}
        if(!this.regionOpen[i]&&region.requires.every(id=>this.blockerHp[this.level.obstacles.blockers.findIndex(b=>b.id===id)]===0)){this.regionOpen[i]=true;openedRegions.push(region.id);}
      });
      return {blockerHits,brokenBlockers,openedRegions,blockerHp:this.blockerHp.slice(),regionOpen:this.regionOpen.slice(),...(previousOpen?{cellOpen:this.cellOpen.slice(),openedCells:this.cellOpen.map((open,i)=>open&&!previousOpen[i]?i:-1).filter(i=>i>=0)}:{})};
    }
    _gravityColumns(){
      if(!obstacleRules(this.level))return this.topology.columns;
      const result=[];
      for(const column of this.topology.columns){let segment=[],previous=null;
        for(const i of column){
          if(!this.isPlayable(i)){if(segment.length)result.push(segment);segment=[];previous=null;continue;}
          if(previous!==null&&this.level.cells[i].r!==this.level.cells[previous].r+1){if(segment.length)result.push(segment);segment=[];}
          segment.push(i);previous=i;
        }
        if(segment.length)result.push(segment);
      }
      return result;
    }
    adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&!!this.neighbors[a]?.includes(b);}
    _random(){let x=this.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;this.rngState=x>>>0;return this.rngState;}
    _number(){return this.level.palette[this._random()%this.level.palette.length];}
    findMatches(values=this.values){
      if(obstacleRules(this.level))values=values.map((v,i)=>this.isPlayable(i)?v:null);
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
        if(!this.isPlayable(a)||!this.isPlayable(b)||this.values[a]===this.values[b])continue;
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
        if(!this.isPlayable(index)||this.values[index]!==null)continue;
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
      for(const column of this._gravityColumns()){
        const survivors=column.filter(i=>!removed.has(i)&&(!obstacleRules(this.level)||this.values[i]!==null)).map(from=>({from,value:this.values[from]}));
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
    static validateLevel(level){return validateLevel(level);}
    _validRecoveryValues(){
      return dense(this.values)&&this.values.length===this.level.cells.length&&this.values.every((value,i)=>!this.isPlayable(i)?value===null:int32(value)&&this.level.palette.includes(value));
    }
    _recoveryInput(){
      validateLevel(this.level);
      if(!this._validRecoveryValues())throw new Error('Invalid recovery board');
      if(new Set(this.level.palette).size<2)throw new Error('Recovery requires at least two distinct palette values');
    }
    _settledPlayable(){return this._validRecoveryValues()&&!this.findMatches().length&&this.legalMoves().length>0;}
    _stableBoard(){
      this._recoveryInput();
      const original=this.values.slice(),rng=this.rngState;
      try{
      // Bounded, match-aware construction rather than unrestricted refill.
      for(let attempt=0;attempt<64;attempt++){
        this.values=this.values.map(()=>null);this._fillVacancies();
        if(this._settledPlayable())return true;
      }
      for(const coefficients of [[1,2],[2,1],[1,-1]])for(let offset=0;offset<4;offset++){
        this.values=this.level.cells.map((c,i)=>!this.isPlayable(i)?null:this.level.palette[Math.floor((((coefficients[0]*c.q+coefficients[1]*c.r+offset)%4)+4)%4/2)]);
        if(this._settledPlayable())return true;
      }
      throw new Error('This board shape cannot provide a settled legal swap');
      }catch(error){this.values=original;this.rngState=rng;throw error;}
    }
    _ensurePlayable(){
      this._recoveryInput();
      const base=this.values.slice(),rng=this.rngState;
      try{
      if(this._settledPlayable())return false;
      for(let attempt=0;attempt<128;attempt++){
        this.values=base.slice();
        const indices=this.values.map((_,i)=>i).filter(i=>this.isPlayable(i));
        for(let i=indices.length-1;i>0;i--){const j=this._random()%(i+1),a=indices[i],b=indices[j];[this.values[a],this.values[b]]=[this.values[b],this.values[a]];}
        if(this._settledPlayable())return true;
      }
      this._stableBoard();
      if(!this._settledPlayable())throw new Error('Recovery did not produce a settled legal board');
      return true;
      }catch(error){this.values=base;this.rngState=rng;throw error;}
    }
    swap(a,b){
      if(this.status!=='playing')return {ok:false,reason:this.status,frames:[],scoreGain:0,reshuffled:false};
      if(!this.adjacent(a,b))return {ok:false,reason:'neighbor',frames:[],scoreGain:0,reshuffled:false};
      if(!this.isPlayable(a)||!this.isPlayable(b))return {ok:false,reason:'blocked',frames:[],scoreGain:0,reshuffled:false};
      [this.values[a],this.values[b]]=[this.values[b],this.values[a]];
      let matched=this.findMatches();
      if(!matched.length){[this.values[a],this.values[b]]=[this.values[b],this.values[a]];return {ok:false,reason:'no-match',frames:[],scoreGain:0,reshuffled:false};}
      this.movesLeft--;this.turn++;this.history.push([a,b]);
      const frames=[];let totalGain=0,safetyReset=false;
      while(matched.length){
        const before=this.values.slice(),scoreGain=matched.reduce((n,i)=>n+this.values[i],0);
        matched.forEach(i=>{this.layers[i]=Math.max(0,this.layers[i]-1);});
        this.score+=scoreGain;totalGain+=scoreGain;
        const materialEvents=materialRules(this.level)?this._collectMaterials('matched-cell',matched):null;
        const obstacles=obstacleRules(this.level)?this._damageBlockers(matched,materialEvents?broken=>materialEvents.push(...this._collectMaterials('crate-break',broken)):null):{};const refill=this._gravity(matched);
        frames.push({matched:matched.slice(),before,after:this.values.slice(),layers:this.layers.slice(),scoreGain,...refill,...obstacles,...(materialEvents?{materialEvents,materialCounts:this.materialCounts.slice(),collectedSources:this.collectedSources.slice()}:{} )});
        matched=this.findMatches();
        if(frames.length>=32 && matched.length){this._stableBoard();safetyReset=true;break;}
      }
      const reshuffled=(this.status==='playing'?this._ensurePlayable():false)||safetyReset;
      return {ok:true,reason:null,frames,scoreGain:totalGain,reshuffled};
    }
    snapshot(){return {version:materialRules(this.level)?6:obstacleRules(this.level)?5:4,rulesVersion:materialRules(this.level)?'classic-v6':obstacleRules(this.level)?'classic-v5':'classic-v4',...(obstacleRules(this.level)?{obstacleVersion:'obstacles-v1',blockerHp:this.blockerHp.slice(),regionOpen:this.regionOpen.slice(),...(columnFlow(this.level)?{cellOpen:this.cellOpen.slice()}:{} )}:{}),...(materialRules(this.level)?{materialVersion:'materials-v1',objectiveVersion:'objectives-v1',materialCounts:this.materialCounts.slice(),collectedSources:this.collectedSources.slice(),status:this.status}:{}),values:this.values.slice(),layers:this.layers.slice(),score:this.score,movesLeft:this.movesLeft,turn:this.turn,rngState:this.rngState,history:this.history.map(p=>p.slice())};}
    clone(){
      const copy=Object.create(HexMatch.prototype);
      copy.level=this.level;copy.topology=this.topology;copy.neighbors=this.neighbors;
      copy.values=this.values.slice();copy.layers=this.layers.slice();copy.score=this.score;copy.movesLeft=this.movesLeft;copy.turn=this.turn;copy.rngState=this.rngState;copy.history=this.history.map(p=>p.slice());
      if(obstacleRules(this.level)){copy.blockerHp=this.blockerHp.slice();copy.regionOpen=this.regionOpen.slice();if(columnFlow(this.level))copy.cellOpen=this.cellOpen.slice();}
      if(materialRules(this.level)){copy.materialCounts=this.materialCounts.slice();copy.collectedSources=this.collectedSources.slice();}
      return copy;
    }
    _restore(s){
      if(materialRules(this.level))return this._restoreMaterials(s);
      if(obstacleRules(this.level))return this._restoreObstacles(s);
      const n=this.total;
      if(s.version!==4||s.rulesVersion!=='classic-v4'||!Array.isArray(s.values)||s.values.length!==n||s.values.some(v=>!this.level.palette.includes(v))||!Array.isArray(s.layers)||s.layers.length!==n||s.layers.some((v,i)=>!Number.isInteger(v)||v<0||v>(this.level.cells[i].layers||1))||!Number.isInteger(s.score)||s.score<0||!Number.isInteger(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||!Number.isInteger(s.turn)||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!Array.isArray(s.history)||s.history.length!==s.turn||s.history.some(p=>!Array.isArray(p)||p.length!==2||!this.adjacent(p[0],p[1]))||this.findMatches(s.values).length)throw new Error('Invalid match-three checkpoint');
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)throw new Error('Invalid checkpoint history');
      if(replay.score!==s.score||replay.movesLeft!==s.movesLeft||replay.turn!==s.turn||replay.rngState!==s.rngState||replay.values.some((v,i)=>v!==s.values[i])||replay.layers.some((v,i)=>v!==s.layers[i]))throw new Error('Checkpoint does not match its history');
      Object.assign(this,{values:replay.values,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history});
    }
    _restoreMaterials(s){
      const invalid=()=>{throw new Error('Invalid match-three checkpoint');};
      if(!s||typeof s!=='object'||Array.isArray(s)||s.version!==6||s.rulesVersion!=='classic-v6'||s.obstacleVersion!=='obstacles-v1'||s.materialVersion!=='materials-v1'||s.objectiveVersion!=='objectives-v1'||!dense(s.values)||s.values.length!==this.total||!dense(s.layers)||s.layers.length!==this.total||!dense(s.blockerHp)||s.blockerHp.length!==this.blockerHp.length||s.blockerHp.some((hp,i)=>!Number.isInteger(hp)||hp<0||hp>this.level.obstacles.blockers[i].hp)||!dense(s.regionOpen)||s.regionOpen.length!==this.regionOpen.length||s.regionOpen.some(v=>typeof v!=='boolean')||!dense(s.materialCounts)||s.materialCounts.length!==this.materialCounts.length||s.materialCounts.some(v=>!int32(v)||v<0)||!dense(s.collectedSources)||s.collectedSources.length!==this.collectedSources.length||s.collectedSources.some(v=>typeof v!=='boolean')||!['playing','won','lost'].includes(s.status)||!int32(s.score)||s.score<0||!int32(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||!int32(s.turn)||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!dense(s.history)||s.history.length!==s.turn||s.history.some(pair=>!dense(pair)||pair.length!==2||!this.adjacent(pair[0],pair[1])))invalid();
      if(columnFlow(this.level)&&(!dense(s.cellOpen)||s.cellOpen.length!==this.total||s.cellOpen.some(v=>typeof v!=='boolean')))invalid();
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)invalid();
      const expected=replay.snapshot(),keys=Object.keys(expected);
      if(Object.keys(s).length!==keys.length||keys.some(key=>!Object.prototype.hasOwnProperty.call(s,key)||JSON.stringify(expected[key])!==JSON.stringify(s[key]))||!replay._validRecoveryValues()||replay.findMatches().length)invalid();
      Object.assign(this,{values:replay.values,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history,blockerHp:replay.blockerHp,regionOpen:replay.regionOpen,materialCounts:replay.materialCounts,collectedSources:replay.collectedSources,...(columnFlow(this.level)?{cellOpen:replay.cellOpen}:{} )});
    }
    _restoreObstacles(s){
      const invalid=()=>{throw new Error('Invalid match-three checkpoint');};
      if(!s||s.version!==5||s.rulesVersion!=='classic-v5'||s.obstacleVersion!=='obstacles-v1'||!dense(s.values)||s.values.length!==this.total||!dense(s.layers)||s.layers.length!==this.total||!dense(s.blockerHp)||s.blockerHp.length!==this.blockerHp.length||s.blockerHp.some((hp,i)=>!Number.isInteger(hp)||hp<0||hp>this.level.obstacles.blockers[i].hp)||!dense(s.regionOpen)||s.regionOpen.length!==this.regionOpen.length||s.regionOpen.some(v=>typeof v!=='boolean')||!int32(s.score)||s.score<0||!int32(s.movesLeft)||s.movesLeft<0||s.movesLeft>this.level.moves||s.turn!==this.level.moves-s.movesLeft||!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff||!dense(s.history)||s.history.length!==s.turn||s.history.some(p=>!dense(p)||p.length!==2||!this.adjacent(p[0],p[1])))invalid();
      if(columnFlow(this.level)&&(!dense(s.cellOpen)||s.cellOpen.length!==this.total||s.cellOpen.some(v=>typeof v!=='boolean')))invalid();
      const replay=new HexMatch(this.level);
      for(const pair of s.history)if(!replay.swap(...pair).ok)invalid();
      const expected=replay.snapshot();
      for(const key of Object.keys(expected))if(JSON.stringify(expected[key])!==JSON.stringify(s[key]))invalid();
      // Replay is the authority: settled active cells must be full and inactive
      // cells null. No weaker v4 checkpoint validation is used for v5.
      if(!replay._validRecoveryValues()||replay.findMatches().length)invalid();
      Object.assign(this,{values:replay.values,layers:replay.layers,score:replay.score,movesLeft:replay.movesLeft,turn:replay.turn,rngState:replay.rngState,history:replay.history,blockerHp:replay.blockerHp,regionOpen:replay.regionOpen,...(columnFlow(this.level)?{cellOpen:replay.cellOpen}:{} )});
    }
    hint(options={}){
      if(this.status!=='playing')return null;
      options=options&&typeof options==='object'?options:{};
      const legal=this.legalMoves();if(!legal.length)return null;
      const same=(a,b)=>a&&b&&((a[0]===b[0]&&a[1]===b[1])||(a[0]===b[1]&&a[1]===b[0]));
      const solution=this.level.solution;
      const routeGroups=[Array.isArray(this.level.solutions)?this.level.solutions:[],solution==null||(Array.isArray(solution)&&!solution.length)?[]:[solution],Array.isArray(this.level.alternativeSolutions)?this.level.alternativeSolutions:[]];
      // Route metadata is untrusted, including on mutable levels outside the catalog.
      // At most 64 candidate slots and 512 copied pairs / clone swap attempts.
      // These separate proof limits do not alter search counters or truncated.
      const maxRouteCandidates=64,maxRoutePairs=512;
      let routeCandidates=0,routePairs=0;
      candidates:for(const routes of routeGroups)for(let routeIndex=0;routeIndex<routes.length;routeIndex++){
        if(routeCandidates>=maxRouteCandidates)break candidates;
        routeCandidates++;const route=routes[routeIndex];
        if(!Array.isArray(route)||this.history.length>=route.length||route.length>this.history.length+this.movesLeft||route.length>maxRoutePairs-routePairs)continue;
        routePairs+=route.length;
        if(!dense(route))continue;
        const path=Array.from(route,pair=>Array.isArray(pair)&&pair.length===2&&dense(pair)?[pair[0],pair[1]]:null);
        if(!path.every(pair=>pair&&pair.every(index=>Number.isInteger(index)&&index>=0&&index<this.total))||!this.history.every((pair,index)=>same(pair,path[index])))continue;
        const continuation=path.slice(this.history.length),pair=continuation[0];
        if(!legal.some(move=>same(move,pair)))continue;
        // Never cache a proof of externally mutable routes, state or level data.
        const proof=this.clone();let wins=false;
        try{wins=continuation.every(move=>proof.swap(...move).ok)&&proof.status==='won';}catch(error){continue;}
        if(wins)return {pair:pair.slice(),source:'proven_route',guaranteed:true,continuation,searchedNodes:0,depth:0,truncated:false};
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
            const state=child.values.join(',')+'/'+child.layers.join(',')+'/'+child.score+'/'+child.movesLeft+'/'+child.rngState+(obstacleRules(this.level)?'/'+child.blockerHp.join(',')+'/'+child.regionOpen.join(','):'')+(materialRules(this.level)?'/'+child.materialCounts.join(',')+'/'+child.collectedSources.join(','):'');
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
