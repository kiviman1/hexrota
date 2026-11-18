#!/usr/bin/env node
'use strict';
// unity/ is the sole authority. This explicit allowlist intentionally excludes
// executable parity harnesses and the System.Text.Json test-host adapter.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const project = 'unity-client';
const core = `${project}/Assets/Hexrota/Core`;
const data = `${project}/Assets/Hexrota/Resources/HexrotaData`;
const modules = ['Application', 'Catalog', 'Commands', 'Contracts', 'Economy', 'Gameplay', 'Hints', 'Lives', 'Rescue', 'RewardAdapter', 'Rewards'];
const documents = ['data/levels-original.json', 'data/tutorials-fixed.json', 'dist/variants.json', 'dist/lives-config.json', 'dist/reward-rules.json', 'data/economy-config-9-5.json'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const guid = asset => hash(`hexrota-unity:${asset.replace(/^unity-client\//, '')}`).slice(0, 32);
const read = file => fs.readFileSync(path.join(root, file));
const walk = dir => fs.readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
function meta(asset, directory = false) {
  const header = `fileFormatVersion: 2\nguid: ${guid(asset)}\n`;
  if (directory) return `${header}folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData:\n  assetBundleName:\n  assetBundleVariant:\n`;
  const ext = path.extname(asset);
  if (ext === '.cs') return `${header}MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData:\n  assetBundleName:\n  assetBundleVariant:\n`;
  if (ext === '.asmdef') return `${header}AssemblyDefinitionImporter:\n  externalObjects: {}\n  userData:\n  assetBundleName:\n  assetBundleVariant:\n`;
  return `${header}TextScriptImporter:\n  externalObjects: {}\n  userData:\n  assetBundleName:\n  assetBundleVariant:\n`;
}
const sources = modules.flatMap(module => fs.readdirSync(path.join(root, 'unity', module)).filter(file => file.endsWith('.cs')).sort().map(file => [`unity/${module}/${file}`, `${core}/${module}/${file}`]));
const inputs = [...sources, ...documents.map(file => [file, `${data}/${path.basename(file)}`])];
const output = new Map(inputs.map(([source, target]) => [target, read(source)]));
output.set(`${core}/Hexrota.Core.asmdef`, JSON.stringify({name: 'Hexrota.Core', rootNamespace: 'Hexrota', references: [], includePlatforms: [], excludePlatforms: [], allowUnsafeCode: false, overrideReferences: false, precompiledReferences: [], autoReferenced: true, defineConstraints: [], versionDefines: [], noEngineReferences: true}, null, 2) + '\n');
const manifest = {schemaVersion: 1, generatedBy: 'node scripts/sync-unity-client.cjs', authority: 'unity/ C# modules and canonical JSON; generated destinations must not be edited', files: inputs.map(([source, destination]) => ({source, destination, sha256: hash(read(source))}))};
output.set(`${project}/SourceManifest.json`, JSON.stringify(manifest, null, 2) + '\n');
for (const destination of [...output.keys()]) {
  if (!destination.startsWith(`${project}/Assets/`)) continue;
  output.set(`${destination}.meta`, meta(destination));
  let parent = path.posix.dirname(destination);
  while (parent === `${project}/Assets/Hexrota` || parent.startsWith(`${project}/Assets/Hexrota/`)) { output.set(`${parent}.meta`, meta(parent, true)); parent = path.posix.dirname(parent); }
}
const generatedRoots = [core, data];
const stale = generatedRoots.flatMap(dir => fs.existsSync(path.join(root, dir)) ? walk(dir).filter(file => !output.has(file)) : []);
const check = process.argv.includes('--check');
let failures = 0;
for (const [file, bytes] of output) {
  const target = path.join(root, file);
  if (check) {
    if (!fs.existsSync(target) || !read(file).equals(Buffer.from(bytes))) { console.error(`OUT OF SYNC ${file}`); failures++; }
  } else { fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, bytes); }
}
for (const file of stale) {
  if (check) { console.error(`UNEXPECTED GENERATED FILE ${file}`); failures++; }
  else fs.unlinkSync(path.join(root, file));
}
if (failures) process.exitCode = 1;
else console.log(`${check ? 'Verified' : 'Synchronized'} ${sources.length} runtime C# sources + ${documents.length} canonical JSON documents (byte-for-byte); harnesses excluded.`);
