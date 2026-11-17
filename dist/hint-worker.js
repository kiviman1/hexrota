/* Hint search stays off the input/render thread on supported browsers. */
importScripts('./engine.js?v=53');
self.onmessage = event => {
  try {
    const game = new self.HexMatch(event.data.level,event.data.snapshot);
    self.postMessage({hint:game.hint({maxMs:90,maxDepth:3})});
  } catch (_) {self.postMessage({hint:null});}
};
