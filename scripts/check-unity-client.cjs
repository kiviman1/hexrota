#!/usr/bin/env node
'use strict';
// Structural checks complement, but never substitute for, real Editor tests.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const project = path.join(root, 'unity-client');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
function walk(dir) { return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => { const p = path.join(dir, entry.name); return entry.isDirectory() ? [p, ...walk(p)] : [p]; }); }
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
check('exact engine/data synchronization; runtime allowlist excludes harnesses', () => {
  const run = spawnSync(process.execPath, ['scripts/sync-unity-client.cjs', '--check'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const manifest = JSON.parse(read('SourceManifest.json'));
  const synced = new Set(manifest.files.map(file => file.source));
  for (const required of [
    'unity/Application/GameSessionController.cs', 'unity/Gameplay/HexMatch.Obstacles.cs',
    'unity/Gameplay/HexMatch.ColumnFlow.cs', 'unity/Catalog/CampaignFlowCatalog.cs',
    'unity/Gameplay/HexMatch.Materials.cs', 'unity/Catalog/MaterialAlphaCatalog.cs',
    'unity/Story/StoryEngine.cs', 'unity/StoryAdapter/StoryBindings.cs',
    'unity/StoryAdapter/CanonicalStoryFacts.cs', 'data/obstacle-levels-v1.json',
    'data/campaign-flow-levels-v1.json', 'data/campaign-flow-levels-v2.json',
    'data/material-alpha-levels-v1.json', 'data/story-content-v1.json'
  ]) assert(synced.has(required), 'Required Unity migration input missing: ' + required);
  for (const item of manifest.files) assert(!/Harness|ParitySupport|Program\.cs/.test(item.source));
  for (const item of walk(path.join(project, 'Assets/Hexrota/Core')).filter(file => file.endsWith('.cs'))) assert(!/UnityEngine|System\.Text\.Json|static void Main/.test(fs.readFileSync(item, 'utf8')), item);
});
const assets = walk(path.join(project, 'Assets'));
const guidMap = new Map();
check('every asset/folder has stable metadata; GUIDs are unique', () => {
  for (const file of assets.filter(file => !file.endsWith('.meta'))) {
    assert(fs.existsSync(`${file}.meta`), `Missing meta: ${file}`);
    const metadata = fs.readFileSync(`${file}.meta`, 'utf8');
    const match = metadata.match(/^guid: ([a-f0-9]{32})$/m);
    assert(match, `Invalid GUID: ${file}`);
    assert(!guidMap.has(match[1]), `Duplicate GUID: ${file} and ${guidMap.get(match[1])}`);
    guidMap.set(match[1], file);
    if (fs.statSync(file).isDirectory()) assert(metadata.includes('folderAsset: yes'), `Folder importer: ${file}`);
  }
  for (const file of assets.filter(file => file.endsWith('.meta'))) assert(fs.existsSync(file.slice(0, -5)), `Orphan meta: ${file}`);
});
check('serialized local references resolve to committed assets', () => {
  // Unity builtin resources use zero-prefixed GUIDs. Other references must be
  // repository assets, or an explicitly documented Unity package reference.
  const packageGuids = new Set([
    'fe87c0e1cc204ed48ad3b37840f39efc', // Unity UI Image
    '5f7201a12d95ffc409449d95f23cf332', // Unity UI Text
    '4e29b1a8efbd4b44bb3f3716e73f07ff', // Unity UI Button
    '0cd44c1031e13a943bb63640046fad76', // Unity UI CanvasScaler
    'dc42784cf147c0c48a680349fa168899', // Unity UI GraphicRaycaster
  ]);
  for (const file of assets.filter(file => /\.(unity|prefab|asset|mat)$/.test(file))) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bguid: ([a-f0-9]{32})\b/g)) assert(/^0000000000000000/.test(match[1]) || guidMap.has(match[1]) || packageGuids.has(match[1]), `Missing asset reference ${match[1]} in ${file}`);
  }
});
check('Unity Hub project pins the requested Editor and usable build scenes', () => {
  assert.match(read('ProjectSettings/ProjectVersion.txt'), /^m_EditorVersion: 6000\.6\.9f1$/m);
  const manifest = JSON.parse(read('Packages/manifest.json'));
  assert(manifest.dependencies['com.unity.ugui'], 'Unity UI dependency required');
  const settings = read('ProjectSettings/EditorBuildSettings.asset');
  const scenes = [...settings.matchAll(/path: (Assets\/[^\r\n]+\.unity)\s+guid: ([a-f0-9]{32})/g)];
  assert(scenes.length > 0, 'At least one serialized build scene required');
  assert.match(settings, /enabled: 1/);
  for (const scene of scenes) {
    assert(fs.existsSync(path.join(project, scene[1])), `Missing scene: ${scene[1]}`);
    assert.equal(path.normalize(guidMap.get(scene[2]) || ''), path.normalize(path.join(project, scene[1])), `Scene GUID mismatch: ${scene[1]}`);
    const content = read(scene[1]);
    assert.match(content, /--- !u!1 /, 'Scene needs actual GameObjects');
    assert.match(content, /m_Script: \{fileID: 11500000, guid:/, 'Scene needs a real client component');
  }
});
check('runtime and Editor/test assemblies have separate compilation boundaries', () => {
  const defs = assets.filter(file => file.endsWith('.asmdef')).map(file => ({file, value: JSON.parse(fs.readFileSync(file, 'utf8'))}));
  assert(defs.some(item => item.value.name === 'Hexrota.Core' && item.value.noEngineReferences));
  assert(defs.some(item => item.value.includePlatforms?.includes('Editor')), 'Editor assembly boundary required');
  assert(defs.some(item => item.value.optionalUnityReferences?.includes('TestAssemblies') || item.value.references?.includes('UnityEngine.TestRunner')), 'Unity Test Framework assembly required');
  for (const file of assets.filter(file => file.endsWith('.cs'))) {
    const relative = path.relative(project, file);
    assert(!/ParityHarness|ParitySupport|Program\.cs/.test(relative), `Harness leaked into game: ${relative}`);
    if (fs.readFileSync(file, 'utf8').includes('using UnityEditor')) {
      const owner = defs.filter(item => file.startsWith(path.dirname(item.file) + path.sep)).sort((a, b) => b.file.length - a.file.length)[0];
      assert(owner && owner.value.includePlatforms?.includes('Editor'), `Editor API in runtime assembly: ${relative}`);
    }
  }
});
check('real reusable prefabs and canonical level data exist', () => {
  assert(assets.filter(file => file.endsWith('.prefab')).length >= 4, 'Expected cell/stone/character/effect or scenery prefabs');
  const original = JSON.parse(read('Assets/Hexrota/Resources/HexrotaData/levels-original.json'));
  const variants = JSON.parse(read('Assets/Hexrota/Resources/HexrotaData/variants.json'));
  assert.equal(original.levels.length, 10);
  assert.equal(variants.levels.length, 10);
  assert(variants.levels.every(level => level.variants.length === 4));
});
console.log(`Unity client structure: ${checks} checks passed. Unity Editor/PlayMode/WebGL execution is a separate required validation.`);
