import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { projectRoot, runtimePublicReferenceRoot } from './testPaths.mjs';

test('normal browser startup stays on academy map while packaged startup can request the title screen explicitly', async () => {
  const html = await readFile(path.join(runtimePublicReferenceRoot, 'index.html'), 'utf8');
  const js = await readFile(path.join(runtimePublicReferenceRoot, 'app.js'), 'utf8');

  assert.match(html, /id="academy-map-screen" class="screen active"/, 'normal startup should still leave academy map as the initial active screen in static HTML');
  assert.match(js, /new URLSearchParams\(window\.location\.search\)/, 'front-end should inspect query parameters for packaged-only startup overrides');
  assert.match(js, /return initialScreen === 'title' \? 'title' : null;/, 'front-end should recognize an explicit title-screen startup override');
  assert.match(js, /showScreen\('title'\)/, 'front-end should be able to route into the title screen from startup override logic');
  assert.match(js, /Promise\.all\(\[[\s\S]*refreshSaveSlots\(\),[\s\S]*refresh\(\)[\s\S]*\]\)\.then\(\(\)\s*=>\s*applyInitialScreenOverride\(\)\)/, 'startup override should apply only after the normal refresh boot completes');
});

test('electron packaging declares a real app icon and centralizes packaged title entry policy for launch and activate', async () => {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const electronMain = await readFile(path.join(projectRoot, 'electron/main.mjs'), 'utf8');
  const windowLifecycle = await readFile(path.join(projectRoot, 'app/src/electron/windowLifecycle.mjs'), 'utf8');
  const windowsTargets = packageJson.build?.win?.target ?? [];
  const nsisTarget = windowsTargets.find((target) => target?.target === 'nsis');

  assert.equal(packageJson.build?.icon, 'assets/app-icons/sera-neutral.icns', 'packaging should declare the generated Sera-neutral icns file as the app icon');
  assert.equal(packageJson.scripts?.['electron:mac'], 'electron-builder --mac dmg zip', 'package scripts should expose a dedicated macOS packaging command');
  assert.equal(packageJson.scripts?.['electron:win'], 'electron-builder --win nsis --x64', 'package scripts should expose a dedicated Windows packaging command');
  assert.equal(packageJson.build?.win?.icon, 'assets/app-icons/sera-neutral.ico', 'Windows packaging should declare the generated Sera-neutral ico file as the app icon');
  assert.ok(nsisTarget, 'Windows packaging should declare an explicit NSIS target');
  assert.deepEqual(nsisTarget.arch, ['x64'], 'Windows packaging should constrain the first shipping target to x64');
  assert.match(windowLifecycle, /export function resolveMainWindowEntryUrl/, 'window lifecycle should define a dedicated helper for main-window entry URL policy');
  assert.match(windowLifecycle, /return isPackaged \? new URL\('\/\?initialScreen=title', runtimeUrl\)\.toString\(\) : runtimeUrl;/, 'helper should add the title-screen query only for packaged entry');
  assert.match(electronMain, /resolveMainWindowEntryUrl\(\{ runtimeUrl: started\.url, isPackaged: app\.isPackaged \}\)/, 'initial launch should use the centralized entry URL policy');
  assert.match(electronMain, /resolveMainWindowEntryUrl\(\{ runtimeUrl, isPackaged: app\.isPackaged \}\)/, 'activate reopen should use the same centralized entry URL policy');
  await access(path.join(projectRoot, packageJson.build.icon));
  await access(path.join(projectRoot, packageJson.build.win.icon));
});
