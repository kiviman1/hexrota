/* Pure six-direction swipe classification. The host owns pointer capture,
 * screen-to-SVG conversion, and committing a single recognized gesture. */
(function(root) {
  'use strict';
  function outsideViewport(e, viewport) {
    return !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) ||
      e.clientX < 0 || e.clientY < 0 || e.clientX > viewport.width || e.clientY > viewport.height;
  }
  function hitTest(local, layout, matrix) {
    const { positions, radius } = layout;
    const scale=Math.min(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
    const padding=Math.min(6,3/Math.max(.1,scale));
    const nearest=positions.map((point,index)=>({index,x:Math.abs(local.x-point.x),y:Math.abs(local.y-point.y),distance:Math.hypot(local.x-point.x,local.y-point.y)})).sort((a,b)=>a.distance-b.distance);
    const point=nearest[0];if(!point)return null;
    const inside=pad=>point.x<=radius+pad&&point.y<=radius*Math.sqrt(3)/2+pad&&Math.sqrt(3)*point.x+point.y<=Math.sqrt(3)*radius+pad*2;
    if(inside(0))return point.index;
    // A small edge allowance covers narrow gaps, but never guesses their bisector.
    return inside(padding)&&(!nearest[1]||nearest[1].distance-point.distance>padding)?point.index:null;
  }
  function sample(gesture, e, local, viewport) {
    if (!gesture) return;
    if(outsideViewport(e, viewport)){gesture.invalid=true;return;}
    gesture.maxDistance=Math.max(gesture.maxDistance,Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y));
    if(!gesture.local)return;
    if(!local){gesture.invalid=true;return;}
    const dx=local.x-gesture.local.x,dy=local.y-gesture.local.y,length=Math.hypot(dx,dy);
    if(!length||gesture.maxDistance<12)return;
    let choice=null,alignment=-1;
    for(const neighbor of gesture.neighbors){
      const cosine=(dx*neighbor.dx+dy*neighbor.dy)/(length*neighbor.distance);
      if(cosine<Math.cos(Math.PI/8)||cosine<=alignment)continue;
      const along=length*cosine,threshold=Math.max(12,Math.min(20,neighbor.screenDistance*.28))*neighbor.distance/neighbor.screenDistance;
      if(along<threshold)continue;
      choice=neighbor.index;alignment=cosine;
    }
    if(choice===null)return;
    if(gesture.target===null)gesture.target=choice;
    else if(gesture.target!==choice)gesture.conflicted=true;
  }

  const api = Object.freeze({ outsideViewport, hitTest, sample });
  root.HexBoardInput = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
