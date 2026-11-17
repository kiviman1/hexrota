/* Refresh only the explicit 9.16 reviewed boundary after the runtime freezes.
 * Historical protection fixtures, gameplay, authored levels and audit metrics
 * are never discovered, rewritten or added to this overlay automatically. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=[
 'dist/app.js','dist/first-play.js','dist/game-save.js','dist/session-store.js',
 'dist/index.html','dist/style.css','dist/sw.js','dist/hint-worker.js','dist/obstacles.html','dist/ui-kit.html',
 'src/styles/manifest.json','src/styles/13-first-play.css','dist/onboarding-policy.js','dist/onboarding-alpha.js',
 'unity/Application/GameSessionController.cs','unity/Application/SaveMigration.cs','unity/Application/OnboardingPolicy.cs',
 'unity/OnboardingParityHarness/Program.cs','unity/OnboardingParityHarness/Hexrota.OnboardingParity.csproj','unity/OnboardingParityHarness/NuGet.Config'
];
const fixture={
 baseline:'b078da49a0a1c9632195f13aefefad812e7f92ab',
 scope:'Reviewed optional first-play policy, fresh-profile enrollment, unchanged legacy transport, automatic committed-result receipt, finite off-board gesture guide, scoped teaching HUD and cache generation. Only the explicit host/policy/presentation/save/application files below override earlier source hashes. Gameplay, authored tutorials and campaign data, economy, story content, all historical fixtures, view goldens, 40 variants/80 routes and audit metrics remain intact.',
 addedIds:['first-play-skip'],
 sha256:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))
};
const target=path.join(root,'fixtures/onboarding-9-16-protected.json'),serialized=JSON.stringify(fixture,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),serialized,'Onboarding source drift: review exact changes, then run node scripts/refresh-onboarding-protection.cjs after the runtime freezes');
else fs.writeFileSync(target,serialized);
console.log('Onboarding protection: '+files.length+' explicit reviewed sources; historical fixtures unchanged.');
