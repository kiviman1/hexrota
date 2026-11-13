/* Pure puzzle rules. Rendering, persistence and audio are handled by the app. */
(function (global) {
  'use strict';
  class HexEngine {
    constructor(level, path = []) {
      this.level = level;
      this.path = [];
      this.counts = level.cells.map(() => 0);
      this.sum = 0;
      this.covered = 0;
      this.neighbors = level.cells.map((_, i) => level.cells.map((_, j) => j).filter(j => this.adjacent(i, j)));
      for (const index of path) {
        const result = this.add(index);
        if (!result.ok) throw new Error('Invalid restored route: ' + result.reason);
      }
    }
    adjacent(i, j) {
      const a = this.level.cells[i], b = this.level.cells[j];
      if (!a || !b || i === j) return false;
      const q = a.q - b.q, r = a.r - b.r;
      return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === 1;
    }
    get status() {
      if (this.sum > this.level.target) return 'over';
      if (this.covered === this.level.cells.length && this.sum === this.level.target) return 'won';
      if (this.path.length && !this.neighbors[this.path[this.path.length - 1]].some(i => this.counts[i] < (this.level.cells[i].cap || 1))) return 'stuck';
      return 'playing';
    }
    get state() {
      return {path: this.path.slice(), counts: this.counts.slice(), sum: this.sum, covered: this.covered, status: this.status};
    }
    add(index) {
      if (!Number.isInteger(index) || !this.level.cells[index]) return {ok:false, reason:'invalid'};
      if (this.status === 'won') return {ok:false, reason:'won'};
      if (this.status === 'over') return {ok:false, reason:'over'};
      if (this.counts[index] >= (this.level.cells[index].cap || 1)) return {ok:false, reason:'used'};
      if (this.path.length && !this.adjacent(this.path[this.path.length - 1], index)) return {ok:false, reason:'neighbor'};
      if (this.counts[index] === 0) this.covered++;
      this.counts[index]++;
      this.path.push(index);
      this.sum += this.level.cells[index].value;
      return {ok:true, reason:null};
    }
    undo() {
      if (!this.path.length) return false;
      const index = this.path.pop();
      this.sum -= this.level.cells[index].value;
      this.counts[index]--;
      if (!this.counts[index]) this.covered--;
      return true;
    }
    reset() {
      this.path.length = 0;
      this.counts.fill(0);
      this.sum = 0;
      this.covered = 0;
    }
    hint() {
      if (this.status === 'won') return {type:'none'};
      if (this.status === 'over' || this.status === 'stuck') return {type:'undo'};
      const known = this.level.solution || [];
      if (this.path.every((index, n) => index === known[n]) && this.path.length < known.length) {
        return {type:'next', index:known[this.path.length]};
      }
      const cells = this.level.cells, n = cells.length, target = this.level.target;
      const counts = this.counts.slice(), route = [], memo = new Set();
      const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
      const deadline = clock() + 70;
      let ticks = 0, timedOut = false;
      const weights = cells.map((_, i) => 3 ** i);
      let initialCode = counts.reduce((code, count, i) => code + count * weights[i], 0);
      function reachable(last, needed, neighbors) {
        if (last < 0 || !needed) return true;
        const seen = new Set([last]), stack = [last];
        while (stack.length) {
          const current = stack.pop();
          for (const j of neighbors[current]) {
            if (!seen.has(j) && counts[j] < (cells[j].cap || 1)) {seen.add(j); stack.push(j);}
          }
        }
        for (let j = 0; j < n; j++) if (!counts[j] && !seen.has(j)) return false;
        return true;
      }
      const search = (last, sum, covered, code) => {
        if ((++ticks & 127) === 0 && clock() > deadline) {timedOut = true; return false;}
        if (sum > target) return false;
        if (covered === n && sum === target) return true;
        let minimum = 0, maximum = 0;
        for (let j = 0; j < n; j++) {
          if (!counts[j]) minimum += cells[j].value;
          maximum += ((cells[j].cap || 1) - counts[j]) * cells[j].value;
        }
        if (sum + minimum > target || sum + maximum < target || sum === target) return false;
        const key = code * (n + 1) + last + 1;
        if (memo.has(key)) return false;
        if (!reachable(last, n - covered, this.neighbors)) {memo.add(key); return false;}
        const options = (last < 0 ? cells.map((_, i) => i) : this.neighbors[last]).filter(i => counts[i] < (cells[i].cap || 1));
        options.sort((a, b) => (counts[a] ? 8 : 0) + this.neighbors[a].filter(i => counts[i] < (cells[i].cap || 1)).length - (counts[b] ? 8 : 0) - this.neighbors[b].filter(i => counts[i] < (cells[i].cap || 1)).length);
        for (const index of options) {
          const first = counts[index] === 0;
          counts[index]++; route.push(index);
          if (search(index, sum + cells[index].value, covered + Number(first), code + weights[index])) return true;
          route.pop(); counts[index]--;
          if (timedOut) return false;
        }
        memo.add(key);
        return false;
      };
      const found = search(this.path.length ? this.path[this.path.length - 1] : -1, this.sum, this.covered, initialCode);
      if (found && route.length) return {type:'next', index:route[0]};
      return this.path.length ? {type:'undo', reason:timedOut ? 'timeout' : 'blocked'} : {type:'none'};
    }
  }
  global.HexEngine = HexEngine;
})(typeof window !== 'undefined' ? window : globalThis);
