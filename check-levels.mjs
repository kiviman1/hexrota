import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('./dist/levels.js', import.meta.url), 'utf8'), context);
const levels = context.window.HEX_LEVELS;
const directions = new Set(['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']);
assert.equal(levels.length, 10, 'The vertical slice must contain exactly ten levels.');

for (const [levelIndex, level] of levels.entries()) {
  const coordinates = new Set();
  const visits = Array(level.cells.length).fill(0);
  let total = 0;
  for (const cell of level.cells) {
    const key = `${cell.q},${cell.r}`;
    assert(!coordinates.has(key), `L${levelIndex + 1}: duplicate hex coordinate`);
    coordinates.add(key);
    assert(Number.isInteger(cell.value) && cell.value > 0);
    assert(cell.cap === 1 || cell.cap === 2);
  }
  for (const [step, index] of level.solution.entries()) {
    const cell = level.cells[index];
    assert(cell, `L${levelIndex + 1}: solution references a missing cell`);
    if (step > 0) {
      const previous = level.cells[level.solution[step - 1]];
      assert(directions.has(`${cell.q - previous.q},${cell.r - previous.r}`),
        `L${levelIndex + 1}: non-adjacent step ${step}`);
    }
    assert(++visits[index] <= cell.cap, `L${levelIndex + 1}: tile capacity exceeded`);
    total += cell.value;
    assert(total <= level.target, `L${levelIndex + 1}: route overshoots its target`);
  }
  assert(visits.every(count => count >= 1), `L${levelIndex + 1}: solution leaves a tile unpainted`);
  assert.equal(total, level.target, `L${levelIndex + 1}: wrong solution sum`);
  if (levelIndex >= 2) {
    assert(level.target > level.cells.reduce((sum, cell) => sum + cell.value, 0),
      `L${levelIndex + 1}: the double-use mechanic must be necessary`);
  }
  if (levelIndex) assert(level.cells.length > levels[levelIndex - 1].cells.length);
  console.log(`✓ ${String(levelIndex + 1).padStart(2, '0')} ${level.name}: ${level.cells.length} tiles, ${level.solution.length} steps, target ${level.target}`);
}

console.log('All ten level routes pass adjacency, capacity, coverage and target checks.');
