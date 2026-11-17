#!/usr/bin/env node
'use strict';
// Executes real runtime adapters and core under .NET. Does NOT emulate Unity.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
let sdk, version;
for (const candidate of [...new Set([process.env.DOTNET_PATH, 'dotnet', '/workspace/.dotnet/dotnet', path.join(os.homedir(), '.dotnet/dotnet')].filter(Boolean))]) {
  const result = spawnSync(candidate, ['--version'], {cwd: root, encoding: 'utf8'});
  if (result.status === 0 && /^8\./.test(result.stdout.trim())) { sdk = candidate; version = result.stdout.trim(); break; }
}
if (!sdk) throw new Error('A real .NET 8 SDK is required. No JavaScript/Unity substitute is permitted.');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'hexrota-unity-host-'));
const startedAt = new Date().toISOString();
const logs = [];
function run(args) {
  const result = spawnSync(sdk, args, {cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, env: {...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1'}});
  logs.push(result.stdout || '', result.stderr || '');
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.error || result.status !== 0) throw new Error(`Real .NET runtime host failed: ${result.error || `exit ${result.status}`}`);
  return result.stdout;
}
let result;
try {
  run(['build', 'unity-client/HostTests/Hexrota.UnityClient.HostTests.csproj', '-c', 'Release', '-o', output, '--nologo', '-p:RestoreLockedMode=true']);
  const stdout = run([path.join(output, 'Hexrota.UnityClient.HostTests.dll'), path.join(root, 'unity-client/Assets/Hexrota/Resources')]);
  const line = stdout.split(/\r?\n/).find(line => line.startsWith('HOST_RESULT '));
  if (!line) throw new Error('Missing actual C# host result');
  result = JSON.parse(line.slice('HOST_RESULT '.length));
  if (process.argv.includes('--report')) {
    const directory = path.join(root, 'reports/unity-9-11'); fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, 'runtime-host.json'), JSON.stringify({schemaVersion: 1, command: 'node scripts/check-unity-runtime.cjs --report', startedAt, finishedAt: new Date().toISOString(), sdkVersion: version, compiler: 'C# 7.3 with warnings as errors', result}, null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'runtime-host.log'), logs.join(''));
  }
} finally { fs.rmSync(output, {recursive: true, force: true}); }
