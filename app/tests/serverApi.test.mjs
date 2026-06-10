import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureRoot, readJson, writeJson } from './helpers.mjs';
import { projectRoot } from './testPaths.mjs';
import { createServer } from '../src/server.mjs';
import { finalizeConversation } from '../src/llm/conversationPipeline.mjs';
import { handleConversationLifecycleApi } from '../src/server/conversationLifecycleApi.mjs';
import { trainingDefinitions } from '../src/training.mjs';
import { magicParameterDefinitions, abilityParameterDefinitions } from '../src/parameters.mjs';

const workspaceRoot = path.dirname(projectRoot);
const livePublicRoot = path.join(projectRoot, 'app/public');
const assetsRoot = path.join(workspaceRoot, 'magic-academy-adventure', 'assets');
const v5AssetsRoot = path.join(workspaceRoot, 'magic-academy-adventure', 'assets_v5');
const v5AdditionalAssetsRoot = path.join(workspaceRoot, 'magic-academy-adventure', 'assets_v5_additional_30');

async function withServer(t, serverOptions = {}) {
  const root = await fixtureRoot('magic-adv-server-api-');
  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    ...serverOptions
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const { port } = server.address();
  return { root, base: `http://127.0.0.1:${port}` };
}

async function writeSplitJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function splitServerRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-server-split-'));
  await writeSplitJson(root, 'data/definitions/game_data/event_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/locations.json', [{ id: 'herbology_garden', name: '薬草園' }]);
  await writeSplitJson(root, 'data/definitions/game_data/shop_catalog.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/stage_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/world/settings.json', {
    academy_name: '星灯魔法学院',
    player_name: '主人公',
    world_description: 'split server fixture',
    world_condition_texts: []
  });
  await writeSplitJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room',
    global_flags: {},
    event_flag_sources: {},
    event_completion_sources: {},
    disabled_stage_flag_judgment_flows: {},
    visited_locations: ['herbology_garden'],
    active_character_ids: [],
    last_conversation_id: null,
    characters: {},
    pending_interaction_context: null,
    training_actions_used: 0,
    training_actions_limit: 6,
    elapsed_weeks: 0,
    ending_started: false,
    ending_completed: false,
    ending_character_id: null,
    current_buddy_character_id: null,
    current_enemy_character_ids: []
  });
  await writeSplitJson(root, 'data/mutable/game_data/player_inventory.json', { money: 0, items: [] });
  await writeSplitJson(root, 'data/mutable/game_data/runtime/player_parameters.json', {
    magic: { light: { min: 0, max: 100, label: '光魔法習熟度', value: 25 } },
    abilities: { strength: { min: 0, max: 100, label: '筋力', value: 25 } }
  });
  await writeSplitJson(root, 'data/mutable/game_data/play/active_slot.json', { slot_id: 'slot_002' });
  await writeSplitJson(root, 'data/mutable/game_data/play/slots/slot_001/meta.json', {
    slot_id: 'slot_001',
    label: 'slot 001',
    created_at: '2026-05-05T06:00:00.000+09:00',
    updated_at: '2026-05-05T06:00:00.000+09:00',
    player_note: '',
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room'
  });
  await writeSplitJson(root, 'data/mutable/game_data/play/slots/slot_001/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room',
    ending_completed: false
  });
  await writeSplitJson(root, 'data/mutable/game_data/play/slots/slot_002/meta.json', {
    slot_id: 'slot_002',
    label: 'slot 002',
    created_at: '2026-05-05T06:10:00.000+09:00',
    updated_at: '2026-05-05T06:10:00.000+09:00',
    player_note: '',
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room'
  });
  await writeSplitJson(root, 'data/mutable/game_data/play/slots/slot_002/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room',
    ending_completed: false
  });
  return root;
}

async function withSplitServer(t) {
  const root = await splitServerRoot();
  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const { port } = server.address();
  return { root, base: `http://127.0.0.1:${port}` };
}

async function jsonFetch(url, options) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
    body: options?.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options?.body
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.ok, true, `${response.status} ${text}`);
  return body;
}

async function waitFor(assertion, { timeoutMs = 1500, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError;
}

function createLifecycleReqRes() {
  const req = { method: 'POST' };
  const res = {};
  return { req, res };
}

test('save and conversation APIs reject invalid filesystem-backed ids with 400 responses', async (t) => {
  const { root, base } = await withServer(t);

  const saveResponse = await fetch(`${base}/api/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slot_id: '../escape', label: 'bad slot' })
  });
  assert.equal(saveResponse.status, 400);
  assert.deepEqual(await saveResponse.json(), {
    error: 'invalid slotId: ../escape',
    error_code: 'invalid_slot_id'
  });

  const openingResponse = await fetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: '../escape', character_id: 'lina', provider: 'mock' })
  });
  assert.equal(openingResponse.status, 400);
  assert.deepEqual(await openingResponse.json(), {
    error: 'invalid id: ../escape',
    error_code: 'invalid_conversation_id'
  });

  await assert.rejects(fs.access(path.join(root, 'game_data/logs/conversations/../escape.json')), { code: 'ENOENT' });
});

test('character authoring stays enabled on browser server and is rejected on desktop-configured server', async (t) => {
  const { base: browserBase } = await withServer(t);
  const browserCharacters = await jsonFetch(`${browserBase}/api/characters`);
  assert.equal(browserCharacters.capabilities?.character_authoring?.enabled, true);
  assert.equal(browserCharacters.capabilities?.character_authoring?.reason, null);

  const { root, base: desktopBase } = await withServer(t, {
    characterAuthoringEnabled: false,
    characterAuthoringDisabledReason: 'desktop_runtime_read_only'
  });
  const desktopCharactersResponse = await fetch(`${desktopBase}/api/characters`);
  assert.equal(desktopCharactersResponse.status, 200);
  const desktopCharacters = await desktopCharactersResponse.json();
  assert.deepEqual(desktopCharacters.capabilities?.character_authoring, {
    enabled: false,
    reason: 'desktop_runtime_read_only',
    message: 'デスクトップ版ではキャラクター説明の編集は無効です。ブラウザ実行で編集してください。'
  });

  const saveResponse = await fetch(`${desktopBase}/api/characters/profile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      character_id: 'character_001',
      prompt_description: 'desktop should not write',
      speaking_basis: 'desktop should not write'
    })
  });
  assert.equal(saveResponse.status, 403);
  assert.deepEqual(await saveResponse.json(), {
    error: 'デスクトップ版ではキャラクター説明の編集は無効です。ブラウザ実行で編集してください。',
    error_code: 'character_authoring_disabled',
    reason: 'desktop_runtime_read_only'
  });

  const profile = await readJson(root, 'game_data/characters/character_001/profile.json');
  assert.notEqual(profile.prompt_description, 'desktop should not write');
  assert.notEqual(profile.speaking_basis, 'desktop should not write');
});

test('initialScreen=title serves title-active initial HTML while preserving default academy-map startup', async (t) => {
  const { base } = await withServer(t);

  const defaultResponse = await fetch(`${base}/`);
  assert.equal(defaultResponse.status, 200);
  const defaultHtml = await defaultResponse.text();
  assert.doesNotMatch(defaultHtml, /<body class="title-screen-active">/, 'default browser startup should not mark the body as title-active');
  assert.match(defaultHtml, /id="academy-map-screen" class="screen active"/, 'default browser startup should preserve academy-map as the static initial screen');
  assert.match(defaultHtml, /id="title-screen" class="screen title-hero-screen"/, 'default browser startup should keep title available but inactive in static HTML');
  assert.match(defaultHtml, /<button data-screen="academy-map" class="active">学院マップ<\/button>/, 'default browser startup should keep the academy-map debug tab active');

  const fallbackResponse = await fetch(`${base}/?initialScreen=foo`);
  assert.equal(fallbackResponse.status, 200);
  const fallbackHtml = await fallbackResponse.text();
  assert.match(fallbackHtml, /id="academy-map-screen" class="screen active"/, 'non-title initialScreen values should preserve academy-map as the static initial screen');
  assert.doesNotMatch(fallbackHtml, /id="title-screen" class="screen title-hero-screen active"/, 'non-title initialScreen values should not activate the title screen');

  const titleResponse = await fetch(`${base}/?initialScreen=title`);
  assert.equal(titleResponse.status, 200);
  const titleHtml = await titleResponse.text();
  assert.match(titleHtml, /<body class="title-screen-active">/, 'packaged title entry should mark the body for title full-screen CSS before app.js runs');
  assert.match(titleHtml, /id="title-screen" class="screen title-hero-screen active"/, 'packaged title entry should make the title screen active in the returned HTML');
  assert.doesNotMatch(titleHtml, /id="academy-map-screen" class="screen active"/, 'packaged title entry must not return academy map as the active initial screen');
  assert.match(titleHtml, /<button data-screen="title" class="active">タイトル<\/button>/, 'packaged title entry should make the title debug tab match the initial screen');
  assert.match(titleHtml, /<button data-screen="academy-map">学院マップ<\/button>/, 'packaged title entry should remove the academy-map tab active marker');
});

test('settings screen exposes LM Studio thinking effort selector with None as the disabling choice', async (t) => {
  const { base } = await withServer(t);

  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<select id="lmstudio-thinking-effort">/);
  assert.match(html, /<option value="none">None<\/option>/);
  assert.match(html, /<option value="low">Low<\/option>/);
  assert.match(html, /<option value="medium">Medium<\/option>/);
  assert.match(html, /<option value="high">High<\/option>/);
  assert.match(html, /None を選ぶと、LM Studio へのリクエストでシンキングを無効化します。/);

  const appJs = await fetch(`${base}/app.js`).then((jsResponse) => jsResponse.text());
  assert.match(appJs, /lmstudio-thinking-effort/);
  assert.match(appJs, /thinking_effort/);
  assert.match(appJs, /value\s*===\s*['"]none['"]/);
});

test('root public shell serves from app/public while generated compatibility assets resolve from canonical roots', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-public-root-'));
  const publicRoot = path.join(root, 'public');
  const canonicalAssetsRoot = path.join(root, 'canonical_assets');
  await fs.mkdir(path.join(publicRoot), { recursive: true });
  await fs.mkdir(path.join(canonicalAssetsRoot, 'title'), { recursive: true });
  await fs.writeFile(path.join(publicRoot, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="app">stable root shell</div><script type="module" src="/app.js"></script></body></html>');
  await fs.writeFile(path.join(publicRoot, 'app.js'), 'console.log("root shell");');
  await fs.writeFile(path.join(publicRoot, 'style.css'), 'body { color: rgb(1, 2, 3); }');
  await fs.writeFile(path.join(canonicalAssetsRoot, 'title', 'title.png'), 'canonical-title');

  const server = createServer({ root, publicRoot, canonicalAssetsRoot });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await fetch(`${base}/`).then((response) => response.text());
  assert.match(html, /stable root shell/);

  const assetResponse = await fetch(`${base}/generated/title/title.png`);
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get('content-type'), 'image/png');
  assert.equal(await assetResponse.text(), 'canonical-title');
});

test('retired legacy asset routes are absent from the live server surface', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-retired-asset-routes-'));
  const publicRoot = path.join(root, 'public');
  const localSourceAssetsRoot = path.join(root, 'source_assets');
  const localSourceSheetAssetsRoot = path.join(root, 'source_sheet_assets');
  const localV5AssetsRoot = path.join(root, 'v5_assets');
  const localV5AdditionalAssetsRoot = path.join(root, 'v5_additional_assets');
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.mkdir(path.join(localSourceAssetsRoot, 'ui'), { recursive: true });
  await fs.mkdir(path.join(localSourceSheetAssetsRoot, 'source_images'), { recursive: true });
  await fs.mkdir(path.join(localV5AssetsRoot, 'character_visual_sets', 'visual_set_001', 'face_emotions'), { recursive: true });
  await fs.mkdir(localV5AdditionalAssetsRoot, { recursive: true });
  await fs.writeFile(path.join(publicRoot, 'index.html'), '<!doctype html><html><body>ok</body></html>');
  await fs.writeFile(path.join(localSourceAssetsRoot, 'ui', 'dialogue_box.png'), 'legacy-source');
  await fs.writeFile(path.join(localSourceSheetAssetsRoot, 'source_images', 'character_source_sheet_chromakey.png'), 'legacy-sheet');
  await fs.writeFile(path.join(localV5AssetsRoot, 'character_visual_sets', 'visual_set_001', 'face_emotions', 'neutral.png'), 'legacy-v5');
  await fs.writeFile(path.join(localV5AdditionalAssetsRoot, 'misc.txt'), 'legacy-v5-additional');

  const server = createServer({
    root,
    publicRoot
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  for (const pathname of [
    '/source-assets/ui/dialogue_box.png',
    '/source-sheet-assets/source_images/character_source_sheet_chromakey.png',
    '/source-sheet-crops/character_001.svg?view=face&expression=neutral',
    '/v5-assets/character_visual_sets/visual_set_001/face_emotions/neutral.png',
    '/v5-additional-assets/misc.txt'
  ]) {
    const response = await fetch(`${base}${pathname}`);
    assert.equal(response.status, 404, `${pathname} should be retired from the live runtime surface`);
  }
});

test('retired character composite endpoints are absent from the live server surface', async (t) => {
  const { base } = await withServer(t);

  const recipeResponse = await fetch(`${base}/api/character-composite?character_id=lina`);
  assert.equal(recipeResponse.status, 404);

  const svgResponse = await fetch(`${base}/composites/lina.svg`);
  assert.equal(svgResponse.status, 404);
});

test('/canonical serves canonical-backed live image classes for character and non-character runtime assets', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-canonical-route-'));
  const publicRoot = path.join(root, 'public');
  const canonicalAssetsRoot = path.join(root, 'canonical_assets');
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.mkdir(path.join(canonicalAssetsRoot, 'character_visual_sets', 'visual_set_001', 'scene_standee'), { recursive: true });
  await fs.mkdir(path.join(canonicalAssetsRoot, 'character_visual_sets', 'visual_set_001', 'face_emotions'), { recursive: true });
  await fs.mkdir(path.join(canonicalAssetsRoot, 'backgrounds'), { recursive: true });
  await fs.mkdir(path.join(canonicalAssetsRoot, 'title'), { recursive: true });
  await fs.writeFile(path.join(publicRoot, 'index.html'), '<!doctype html><html><body>ok</body></html>');
  await fs.writeFile(path.join(canonicalAssetsRoot, 'character_visual_sets', 'visual_set_001', 'scene_standee', 'scene_standee_character_05.png'), 'canonical-standee');
  await fs.writeFile(path.join(canonicalAssetsRoot, 'character_visual_sets', 'visual_set_001', 'face_emotions', 'neutral.png'), 'canonical-face');
  await fs.writeFile(path.join(canonicalAssetsRoot, 'backgrounds', 'background_001.png'), 'canonical-background');
  await fs.writeFile(path.join(canonicalAssetsRoot, 'title', 'title.png'), 'canonical-title');

  const server = createServer({ root, publicRoot, canonicalAssetsRoot });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const standee = await fetch(`${base}/canonical/character_visual_sets/visual_set_001/scene_standee/scene_standee_character_05.png`).then((response) => response.text());
  const face = await fetch(`${base}/canonical/character_visual_sets/visual_set_001/face_emotions/neutral.png`).then((response) => response.text());
  const background = await fetch(`${base}/canonical/backgrounds/background_001.png`).then((response) => response.text());
  const title = await fetch(`${base}/canonical/title/title.png`).then((response) => response.text());

  assert.equal(standee, 'canonical-standee');
  assert.equal(face, 'canonical-face');
  assert.equal(background, 'canonical-background');
  assert.equal(title, 'canonical-title');
});

test('new game creates an isolated slot-owned play area with empty character state, 25-point player parameters, and an opening mentor event', async (t) => {
  const { root, base } = await withServer(t);
  await fs.writeFile(path.join(root, 'game_data/runtime/player_parameters.json'), JSON.stringify({
    magic: { light: { value: 88 } },
    abilities: { strength: { value: 77 } }
  }, null, 2));
  await fs.mkdir(path.join(root, 'game_data/characters/lina/memory'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/characters/lina/memory/old.md'), 'balance memory should stay outside play area');

  const started = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  assert.equal(started.area, 'play');
  assert.match(started.slot.slot_id, /^slot_\d{3}$/);
  assert.equal(started.state.current_screen, 'academy-map');
  assert.deepEqual(Object.keys(started.state.global_flags), ['event.opening_mentor_intro.ready']);
  assert.equal(started.state.global_flags['event.opening_mentor_intro.ready'], true);
  assert.deepEqual(started.state.characters, {});
  const openingSource = started.state.event_flag_sources['event.opening_mentor_intro.ready'];
  assert.equal(typeof openingSource.character_id, 'string');
  assert.equal(openingSource.source_type, 'new_game');

  const activeSlot = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/active_slot.json'), 'utf8'));
  assert.equal(activeSlot.slot_id, started.slot.slot_id);

  const playState = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', started.slot.slot_id, 'game_data/runtime_state.json'), 'utf8'));
  assert.equal(playState.current_screen, 'academy-map');
  assert.equal(playState.global_flags['event.opening_mentor_intro.ready'], true);
  assert.deepEqual(playState.event_flag_sources['event.opening_mentor_intro.ready'], openingSource);
  assert.deepEqual(playState.characters, {});
  const playParameters = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', started.slot.slot_id, 'game_data/runtime/player_parameters.json'), 'utf8'));
  for (const definition of [...magicParameterDefinitions, ...abilityParameterDefinitions]) {
    const group = magicParameterDefinitions.some((item) => item.key === definition.key) ? 'magic' : 'abilities';
    assert.equal(playParameters[group][definition.key].value, 25, `${definition.key} should start at 25`);
  }
  const playLinaFlags = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', started.slot.slot_id, 'game_data/characters/lina/flags.json'), 'utf8'));
  assert.deepEqual(playLinaFlags, { character_id: 'lina', flags: {} });
  const playLinaMemoryEntries = await fs.readdir(path.join(root, 'game_data/play/slots', started.slot.slot_id, 'game_data/characters/lina/memory'));
  assert.deepEqual(playLinaMemoryEntries, []);

  const balanceParameters = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime/player_parameters.json'), 'utf8'));
  assert.equal(balanceParameters.magic.light.value, 88, 'balance-tuning runtime parameters should not be overwritten');
  assert.equal(await fs.readFile(path.join(root, 'game_data/characters/lina/memory/old.md'), 'utf8'), 'balance memory should stay outside play area');

  const world = await jsonFetch(`${base}/api/world`);
  assert.equal(world.player_parameters.magic.light.value, 25, 'subsequent runtime APIs should read the play area after new game starts');
  const state = await jsonFetch(`${base}/api/state`);
  assert.equal(state.current_screen, 'academy-map');

  const eventStatus = await jsonFetch(`${base}/api/event-flags`);
  const openingEvent = eventStatus.pending_events.find((event) => event.id === 'event.opening_mentor_intro.ready');
  assert.equal(openingEvent.label, '学院案内のメンター');
  assert.equal(openingEvent.character_id, openingSource.character_id);
  assert.equal(openingEvent.interaction.location_id, 'front_gate_morning');

  const startedEvent = await jsonFetch(`${base}/api/event-flags/start`, {
    method: 'POST',
    body: { flag_id: 'event.opening_mentor_intro.ready', screen: 'academy-conversation-session' }
  });
  assert.equal(startedEvent.character_id, openingSource.character_id);
  assert.equal(startedEvent.location_id, 'front_gate_morning');
  assert.equal(startedEvent.state.current_screen, 'academy-conversation-session');
  assert.equal(startedEvent.state.current_interaction_character_id, openingSource.character_id);
  assert.equal(startedEvent.state.pending_interaction_context.event_flag_id, 'event.opening_mentor_intro.ready');
  assert.match(startedEvent.state.pending_interaction_context.opening_context, /メンター/);
  assert.equal(startedEvent.state.global_flags['event.opening_mentor_intro.completed'], true, 'opening mentor event should be consumed when it starts so it does not retrigger on later map returns');
});

test('authoring save endpoints persist canonical game_data while mirroring into active play for immediate preview', async (t) => {
  const { root, base } = await withServer(t);
  await jsonFetch(`${base}/api/characters`);
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });

  const worldDescription = '保存ボタンはプレイコピーではなく、編集元のワールド設定へ残す。';
  const savedWorld = await jsonFetch(`${base}/api/world`, {
    method: 'POST',
    body: {
      player_name: '調整者',
      world_description: worldDescription,
      player_parameters: {
        magic: { light: 61, dark: 12, fire: 13, water: 14, earth: 15, wind: 16 },
        abilities: { strength: 21, agility: 22, academics: 23, magical_power: 24, charisma: 25 }
      }
    }
  });
  assert.equal(savedWorld.world_description, worldDescription);

  const canonicalWorld = JSON.parse(await fs.readFile(path.join(root, 'game_data/world/settings.json'), 'utf8'));
  const activeWorld = await jsonFetch(`${base}/api/world`);
  assert.equal(canonicalWorld.world_description, worldDescription, 'world save should persist the canonical authoring file');
  assert.equal(activeWorld.world_description_base, worldDescription, 'active play should read the updated world description immediately after authoring save');
  const canonicalParameters = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime/player_parameters.json'), 'utf8'));
  assert.equal(canonicalParameters.magic.light.value, 61);
  assert.equal(activeWorld.player_parameters.magic.light.value, 61, 'active play should read updated player parameters immediately after authoring save');

  await jsonFetch(`${base}/api/characters`);
  const editedPrompt = 'フィールド保存ボタンはキャラ説明を編集元profileへ残す。';
  const editedSpeaking = '調整用の話し方も編集元profileへ残す。';
  await jsonFetch(`${base}/api/characters/profile`, {
    method: 'POST',
    body: { character_id: 'character_020', prompt_description: editedPrompt, speaking_basis: editedSpeaking }
  });
  const canonicalProfile = JSON.parse(await fs.readFile(path.join(root, 'game_data/characters/character_020/profile.json'), 'utf8'));
  assert.equal(canonicalProfile.prompt_description, editedPrompt, 'character save should persist the canonical authoring profile');
  assert.equal(canonicalProfile.speaking_basis, editedSpeaking);

  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'character_020', source_type: 'field' }
  });
  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=character_020&player_input=${encodeURIComponent('確認')}`);
  assert.match(preview.prompt, new RegExp(worldDescription));
  assert.match(preview.prompt, new RegExp(editedPrompt));
});

test('desktop-config world settings mode persists /api/world edits under app/config instead of canonical definitions', async (t) => {
  const { root, base } = await withServer(t, { worldSettingsWriteTarget: 'config' });
  const original = await jsonFetch(`${base}/api/world`);
  const marker = 'desktop-config-write-marker';
  const updated = await jsonFetch(`${base}/api/world`, {
    method: 'POST',
    body: {
      player_name: original.player_name,
      world_description: `${original.world_description}\n${marker}`,
      player_parameters: original.player_parameters
    }
  });
  assert.match(updated.world_description, new RegExp(marker));
  const configWorld = JSON.parse(await fs.readFile(path.join(root, 'app/config/world/settings.json'), 'utf8'));
  const canonicalWorld = JSON.parse(await fs.readFile(path.join(root, 'game_data/world/settings.json'), 'utf8'));
  assert.match(configWorld.world_description, new RegExp(marker), 'desktop mode should persist writable settings under app/config');
  assert.doesNotMatch(canonicalWorld.world_description, new RegExp(marker), 'desktop mode should not mutate canonical definitions');
});

test('server API tests use an explicit baseline runtime location instead of copied live state', async (t) => {
  const { base } = await withServer(t);
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const field = await jsonFetch(`${base}/api/field`);
  assert.equal(field.state.current_location_id, 'herbology_garden');
  assert.equal(field.state.current_screen, 'academy-map');
  assert.deepEqual(field.state.visited_locations, ['herbology_garden']);
});

test('LM Studio settings API normalizes localhost/lan editing, persists config, updates the live server config object, and proxies model discovery', async (t) => {
  const root = await fixtureRoot('magic-adv-server-lmstudio-settings-');
  const configPath = path.join(root, 'config/lmstudio.json');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  let requestedModelsUrl = null;
  const lmStudioModelServer = createHttpServer((req, res) => {
    requestedModelsUrl = req.url;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'gemma-4-27b-it', object: 'model' },
        { id: 'qwen3-32b', object: 'model' }
      ]
    }));
  });
  await new Promise((resolve) => lmStudioModelServer.listen(0, '127.0.0.1', resolve));
  const modelServerPort = lmStudioModelServer.address().port;
  const liveLmStudioConfig = {
    provider: 'lmstudio',
    base_url: 'http://127.0.0.1:1234/v1',
    chat_model: 'gemma-4-31b-it',
    reflection_model: 'gemma-4-31b-it',
    timeout_ms: 120000,
    stream: true,
    mock_provider_enabled: true
  };
  await fs.writeFile(configPath, `${JSON.stringify(liveLmStudioConfig, null, 2)}\n`, 'utf8');
  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfig: liveLmStudioConfig,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => lmStudioModelServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const initial = await jsonFetch(`${base}/api/settings/lmstudio`);
  assert.equal(initial.connection_mode, 'localhost');
  assert.equal(initial.host, '127.0.0.1');
  assert.equal(initial.port, 1234);
  assert.equal(initial.base_url, 'http://127.0.0.1:1234/v1');
  assert.equal(initial.model, 'gemma-4-31b-it');
  assert.equal(initial.chat_model, 'gemma-4-31b-it');
  assert.equal(initial.reflection_model, 'gemma-4-31b-it');
  assert.equal(initial.thinking_effort, null);
  assert.equal(liveLmStudioConfig.thinking_effort, null, 'GET should normalize the live config object used by the running server');

  const discoveredModels = await jsonFetch(`${base}/api/settings/lmstudio/models`, {
    method: 'POST',
    body: { connection_mode: 'localhost', host: 'ignored.example', port: modelServerPort }
  });
  assert.equal(requestedModelsUrl, '/v1/models');
  assert.deepEqual(discoveredModels.models, [
    { id: 'gemma-4-27b-it', label: 'gemma-4-27b-it' },
    { id: 'qwen3-32b', label: 'qwen3-32b' }
  ]);

  const updatedLan = await jsonFetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    body: { connection_mode: 'lan', host: '192.168.11.3', port: 2244, model: 'qwen3-32b', thinking_effort: 'low' }
  });
  assert.equal(updatedLan.connection_mode, 'lan');
  assert.equal(updatedLan.host, '192.168.11.3');
  assert.equal(updatedLan.port, 2244);
  assert.equal(updatedLan.base_url, 'http://192.168.11.3:2244/v1');
  assert.equal(updatedLan.model, 'qwen3-32b');
  assert.equal(updatedLan.chat_model, 'qwen3-32b');
  assert.equal(updatedLan.reflection_model, 'qwen3-32b');
  assert.equal(updatedLan.thinking_effort, 'low');
  assert.equal(liveLmStudioConfig.base_url, 'http://192.168.11.3:2244/v1', 'PATCH should update the live config object used by the running server');
  assert.equal(liveLmStudioConfig.chat_model, 'qwen3-32b', 'PATCH should update the live chat model');
  assert.equal(liveLmStudioConfig.reflection_model, 'qwen3-32b', 'PATCH should update the live reflection model');
  assert.equal(liveLmStudioConfig.thinking_effort, 'low', 'PATCH should update the live thinking effort');
  const persistedLan = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persistedLan.base_url, 'http://192.168.11.3:2244/v1');
  assert.equal(persistedLan.chat_model, 'qwen3-32b', 'selected model should be persisted as chat_model');
  assert.equal(persistedLan.reflection_model, 'qwen3-32b', 'selected model should be persisted as reflection_model');
  assert.equal(persistedLan.thinking_effort, 'low', 'selected thinking effort should be persisted');

  const updatedLocalhost = await jsonFetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    body: { connection_mode: 'localhost', host: 'ignored.example', port: 1235, model: 'gemma-4-27b-it', thinking_effort: null }
  });
  assert.equal(updatedLocalhost.connection_mode, 'localhost');
  assert.equal(updatedLocalhost.host, '127.0.0.1');
  assert.equal(updatedLocalhost.port, 1235);
  assert.equal(updatedLocalhost.base_url, 'http://127.0.0.1:1235/v1');
  assert.equal(updatedLocalhost.model, 'gemma-4-27b-it');
  assert.equal(updatedLocalhost.thinking_effort, null);

  const invalidPortResponse = await fetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connection_mode: 'lan', host: '192.168.11.3', port: 70000, model: 'qwen3-32b' })
  });
  assert.equal(invalidPortResponse.status, 400);
  const invalidPortBody = JSON.parse(await invalidPortResponse.text());
  assert.match(invalidPortBody.error, /port/i);

  const missingHostResponse = await fetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connection_mode: 'lan', host: '   ', port: 1234, model: 'qwen3-32b' })
  });
  assert.equal(missingHostResponse.status, 400);
  const missingHostBody = JSON.parse(await missingHostResponse.text());
  assert.match(missingHostBody.error, /host/i);

  const missingModelResponse = await fetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connection_mode: 'localhost', port: 1234, model: '   ' })
  });
  assert.equal(missingModelResponse.status, 400);
  const missingModelBody = JSON.parse(await missingModelResponse.text());
  assert.match(missingModelBody.error, /model/i);

  const invalidThinkingEffortResponse = await fetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connection_mode: 'localhost', port: 1234, model: 'qwen3-32b', thinking_effort: 'ultra' })
  });
  assert.equal(invalidThinkingEffortResponse.status, 400);
  const invalidThinkingEffortBody = JSON.parse(await invalidThinkingEffortResponse.text());
  assert.match(invalidThinkingEffortBody.error, /thinking_effort/i);
});

test('LM Studio settings API lazy-loads config from lmStudioConfigPath when the server entrypoint does not preload it', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-lazy-load-');
  const configPath = path.join(root, 'runtime-config', 'lmstudio.json');
  const initialConfig = {
    provider: 'lmstudio',
    base_url: 'http://127.0.0.1:1234/v1',
    chat_model: 'gemma-4-31b-it',
    reflection_model: 'gemma-4-31b-it',
    timeout_ms: 120000,
    stream: true,
    mock_provider_enabled: true
  };
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(initialConfig, null, 2)}\n`, 'utf8');

  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  const initial = await jsonFetch(`${base}/api/settings/lmstudio`);
  assert.equal(initial.base_url, 'http://127.0.0.1:1234/v1');
  assert.equal(initial.model, 'gemma-4-31b-it');
  assert.equal(initial.thinking_effort, null);

  const updated = await jsonFetch(`${base}/api/settings/lmstudio`, {
    method: 'PATCH',
    body: { connection_mode: 'lan', host: '192.168.11.3', port: 2244, model: 'qwen3-32b', thinking_effort: 'high' }
  });
  assert.equal(updated.connection_mode, 'lan');
  assert.equal(updated.base_url, 'http://192.168.11.3:2244/v1');
  assert.equal(updated.model, 'qwen3-32b');
  assert.equal(updated.thinking_effort, 'high');

  const persisted = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persisted.base_url, 'http://192.168.11.3:2244/v1');
  assert.equal(persisted.chat_model, 'qwen3-32b');
  assert.equal(persisted.reflection_model, 'qwen3-32b');
  assert.equal(persisted.thinking_effort, 'high');
});

test('conversation opening returns a structured connection-unavailable error when LM Studio config lazy-loads but the API is unreachable', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-opening-lazy-load-');
  const configPath = path.join(root, 'runtime-config', 'lmstudio.json');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify({
    provider: 'lmstudio',
    base_url: 'http://127.0.0.1:9/v1',
    chat_model: 'gemma-4-31b-it',
    reflection_model: 'gemma-4-31b-it',
    timeout_ms: 250,
    stream: false,
    mock_provider_enabled: true
  }, null, 2)}\n`, 'utf8');

  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina' })
  });
  assert.equal(response.status, 503);
  const body = JSON.parse(await response.text());
  assert.equal(body.error_code, 'LMSTUDIO_CONNECTION_UNAVAILABLE');
  assert.match(body.error ?? '', /LM Studioの接続が確認できません/);
});

test('conversation opening returns a structured config-required error when LM Studio config is unavailable', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-opening-config-required-');
  const configPath = path.join(root, 'runtime-config', 'missing-lmstudio.json');

  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina' })
  });
  assert.equal(response.status, 503);
  const body = JSON.parse(await response.text());
  assert.equal(body.error_code, 'LMSTUDIO_CONFIG_REQUIRED');
  assert.match(body.error ?? '', /LM Studio/i);
});

test('conversation opening returns a structured config-required error when LM Studio chat model is missing', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-opening-incomplete-config-');
  const configPath = path.join(root, 'runtime-config', 'lmstudio.json');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify({
    provider: 'lmstudio',
    base_url: 'http://127.0.0.1:9/v1',
    reflection_model: 'gemma-4-31b-it',
    timeout_ms: 250,
    stream: false,
    mock_provider_enabled: true
  }, null, 2)}\n`, 'utf8');

  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina' })
  });
  assert.equal(response.status, 503);
  const body = JSON.parse(await response.text());
  assert.equal(body.error_code, 'LMSTUDIO_CONFIG_REQUIRED');
  assert.match(body.error ?? '', /LM Studioの設定が必要です/);
});

test('interaction start only bootstraps mutable storage for the selected character', async (t) => {
  const { root, base } = await withServer(t);

  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'character_007', source_type: 'field' }
  });

  await fs.access(path.join(root, 'game_data/characters/character_007/profile.json'));
  await fs.access(path.join(root, 'game_data/characters/character_007/flags.json'));
  await fs.access(path.join(root, 'game_data/characters/character_007/skills.json'));
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/character_008/flags.json')));
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/character_008/skills.json')));
});

test('character catalog response does not materialize selectable-character mutable storage on disk', async (t) => {
  const { root, base } = await withServer(t);

  const catalog = await jsonFetch(`${base}/api/characters`);
  assert.equal(catalog.characters.length, 50);

  await fs.access(path.join(root, 'game_data/characters/character_001/profile.json'));
  await fs.access(path.join(root, 'game_data/characters/character_050/profile.json'));
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/character_001/flags.json')));
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/character_050/flags.json')));
});

test('server exposes 50 v5 selectable characters and persists prompt-description edits', async (t) => {
  const { root, base } = await withServer(t);
  const catalog = await jsonFetch(`${base}/api/characters`);
  assert.equal(catalog.characters.length, 50);
  assert.equal(catalog.characters[6].character_id, 'character_007');
  assert.match(catalog.characters[6].source_image_url, /^\/canonical\/character_visual_sets\/visual_set_007\/face_emotions\/neutral\.png$/);
  assert.match(catalog.characters[6].face_url, /^\/canonical\/character_visual_sets\/visual_set_007\/face_emotions\/neutral\.png$/);
  assert.equal(catalog.characters[20].character_id, 'character_021');
  assert.match(catalog.characters[20].source_image_url, /^\/canonical\/character_visual_sets\/visual_set_021\/face_emotions\/neutral\.png$/);
  assert.match(catalog.characters[20].selection_icon_url, /^\/canonical\/character_visual_sets\/visual_set_021\/face_emotions\/neutral\.png$/);

  const edited = '図書塔の鍵束を管理する、静かな観察者。プロンプト編集の反映確認用。';
  await jsonFetch(`${base}/api/characters/profile`, {
    method: 'POST',
    body: { character_id: 'character_007', prompt_description: edited }
  });
  const profile = JSON.parse(await fs.readFile(path.join(root, 'game_data/characters/character_007/profile.json'), 'utf8'));
  assert.equal(profile.prompt_description, edited);

  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'character_007', source_type: 'field' }
  });
  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=character_007&player_input=${encodeURIComponent('話せる？')}`);
  assert.match(preview.prompt, new RegExp(edited));

  const sourceImage = await fetch(`${base}${catalog.characters[6].source_image_url}`);
  assert.equal(sourceImage.status, 200);
  assert.equal(sourceImage.headers.get('content-type'), 'image/png');
  const generatedFace = await fetch(`${base}${catalog.characters[6].face_url}`);
  assert.equal(generatedFace.status, 200);
  assert.equal(generatedFace.headers.get('content-type'), 'image/png');
});

test('prompt preview does not reread selectable character storage bootstrap files after first ensure', async (t) => {
  const { base } = await withServer(t);
  const watchedSuffixes = [
    '/game_data/characters/character_001/profile.json',
    '/game_data/characters/character_001/flags.json',
    '/game_data/characters/character_001/skills.json'
  ];
  const readCounts = new Map(watchedSuffixes.map((suffix) => [suffix, 0]));
  const originalReadFile = fs.readFile;
  fs.readFile = async function patchedReadFile(targetPath, ...args) {
    const normalized = String(targetPath).split(path.sep).join('/');
    for (const suffix of watchedSuffixes) {
      if (normalized.endsWith(suffix)) readCounts.set(suffix, readCounts.get(suffix) + 1);
    }
    return originalReadFile.call(this, targetPath, ...args);
  };
  t.after(() => {
    fs.readFile = originalReadFile;
  });

  await jsonFetch(`${base}/api/prompt-preview?character_id=character_001&player_input=${encodeURIComponent('能力を見て')}`);

  assert.equal(readCounts.get('/game_data/characters/character_001/profile.json'), 1, 'prompt preview should read profile.json only once while bootstrapping a selectable character');
  assert.equal(readCounts.get('/game_data/characters/character_001/flags.json'), 1, 'prompt preview should read flags.json only once while bootstrapping a selectable character');
  assert.equal(readCounts.get('/game_data/characters/character_001/skills.json'), 1, 'prompt preview should read skills.json only once while bootstrapping a selectable character');
});

test('server world settings expose editable player name and zero-default player parameters in prompt preview', async (t) => {
  const { base } = await withServer(t);
  const initialWorld = await jsonFetch(`${base}/api/world`);
  assert.equal(initialWorld.player_name, '主人公');
  assert.equal(initialWorld.player_parameters.magic.light.value, 0);
  assert.equal(initialWorld.player_parameters.abilities.magical_power.value, 0);

  const savedWorld = await jsonFetch(`${base}/api/world`, {
    method: 'POST',
    body: {
      player_name: 'うゆりす',
      world_description: initialWorld.world_description,
      player_parameters: {
        magic: { light: 60, dark: 4, fire: 12, water: 99, earth: 101, wind: -1 },
        abilities: { strength: 45, agility: 67, academics: 89, magical_power: 23, charisma: 10 }
      }
    }
  });
  assert.equal(savedWorld.player_name, 'うゆりす');
  assert.equal(savedWorld.player_parameters.magic.earth.value, 100);
  assert.equal(savedWorld.player_parameters.magic.wind.value, 0);
  assert.equal(savedWorld.player_parameters.abilities.academics.value, 89);

  await jsonFetch(`${base}/api/characters`);
  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=character_001&player_input=${encodeURIComponent('能力を見て')}`);
  assert.doesNotMatch(preview.prompt, /プレイヤーの名前:/);
  assert.doesNotMatch(preview.prompt, /うゆりすの発言:/);
  assert.match(preview.prompt, /プレイヤーの発言: 能力を見て/);
  assert.match(preview.prompt, /キャラクター自身のパラメーター:/);
  assert.match(preview.prompt, /プレイヤーのパラメーター:/);
  assert.match(preview.prompt, /水魔法習熟度: 99\/100/);
  assert.match(preview.prompt, /風魔法習熟度: 0\/100/);
  assert.match(preview.prompt, /学力: 89\/100/);
});

test('prompt preview resolves character speech constraints from LM Studio chat_model without leaking model metadata', async (t) => {
  const { base } = await withServer(t, {
    lmStudioConfig: {
      base_url: 'http://127.0.0.1:9/v1',
      chat_model: 'google/gemma-4-31b',
      reflection_model: 'reflection-model',
      stream: false,
      timeout_ms: 5000,
      thinking_effort: null
    }
  });

  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=lina&player_input=${encodeURIComponent('星図を見たい')}`);
  const worldIndex = preview.prompt.indexOf('ワールド設定:');
  const constraintsIndex = preview.prompt.indexOf('キャラクター発話上の禁止事項:');
  const stageIndex = preview.prompt.indexOf('舞台:');

  assert.ok(worldIndex >= 0, 'prompt preview should include world settings');
  assert.ok(constraintsIndex > worldIndex, 'prompt preview should place speech constraints after world settings');
  assert.ok(stageIndex > constraintsIndex, 'prompt preview should place speech constraints before the stage');
  assert.match(preview.prompt, /「最高」、「最悪」、「最低」、「完璧」、「正解」、「特等席」、「記録」、「あなたなら」、「贅沢」/);
  assert.doesNotMatch(preview.prompt, /Gemma4|LLM固有|モデル固有|このモデル|モデルの癖|profile_id|match_models|chat_model|reflection_model|provider/);

  const mockPreview = await jsonFetch(`${base}/api/prompt-preview?provider=mock&character_id=lina&player_input=${encodeURIComponent('星図を見たい')}`);
  assert.doesNotMatch(mockPreview.prompt, /キャラクター発話上の禁止事項:/);
});

test('training catalog covers every generated card image with weekday affinities and one drawback each', () => {
  const expectedTrainingIds = [
    'artifact_appraisal',
    'barrier_weaving',
    'broom_flight',
    'earth_barrier',
    'elemental_sparring',
    'familiar_bonding',
    'flame_focus',
    'healing_practice',
    'library_study',
    'mana_control',
    'physical_drills',
    'potion_brewing',
    'ritual_research',
    'rune_calligraphy',
    'salon_practice',
    'shadow_control',
    'spirit_listening',
    'star_observation',
    'water_meditation',
    'wind_step'
  ];
  assert.deepEqual(trainingDefinitions.map((training) => training.id).sort(), expectedTrainingIds, 'training catalog should expose one action per generated card image');
  assert.equal(new Set(trainingDefinitions.map((training) => training.id)).size, trainingDefinitions.length, 'training ids should be unique');
  assert.equal(trainingDefinitions.every((training) => training.increases.length > 0), true, 'every training should report probabilistic gains');
  assert.equal(trainingDefinitions.every((training) => training.element && training.decrease?.chance === 0.5 && training.decrease?.amount === 1), true, 'every training should have an elemental weekday affinity and a 50% one-point drawback');
  assert.equal(trainingDefinitions.some((training) => training.increases.some((effect) => effect.group === 'magic')), true, 'catalog should include magic-focused training');
  assert.equal(trainingDefinitions.some((training) => training.increases.some((effect) => effect.group === 'abilities')), true, 'catalog should include ability-focused training');
});

test('training endpoint uses six weekday turns with elemental double bonus, drawbacks, and returns to academy map after Wind day', async (t) => {
  const { base } = await withServer(t);
  const before = await jsonFetch(`${base}/api/world`);
  await jsonFetch(`${base}/api/world`, {
    method: 'POST',
    body: {
      player_name: before.player_name,
      world_description: before.world_description,
      player_parameters: {
        magic: { light: 10, dark: 10, fire: 10, water: 10, earth: 10, wind: 10 },
        abilities: { strength: 10, agility: 10, academics: 10, magical_power: 10, charisma: 10 }
      }
    }
  });

  const first = await jsonFetch(`${base}/api/training/run`, {
    method: 'POST',
    body: { training_id: 'healing_practice', random_seed: 16 }
  });

  assert.equal(first.training.id, 'healing_practice');
  assert.deepEqual(first.training_day, { index: 0, id: 'light_day', name: '光曜', element: 'light', element_label: '光' });
  assert.equal(first.training_progress.actions_used, 1);
  assert.equal(first.training_progress.actions_limit, 6);
  assert.equal(first.training_progress.remaining_actions, 5);
  assert.equal(first.training_progress.completed, false);
  assert.equal(first.training_progress.next_day.name, '闇曜');
  assert.equal(first.state.current_screen, 'training');

  const light = first.effects.find((effect) => effect.group === 'magic' && effect.key === 'light');
  assert.equal(light.weekday_bonus, true, '光曜 should double the light-themed training effect');
  assert.equal(light.bonus_multiplier, 2);
  assert.equal(light.amount, 2, 'successful matching elemental gain should be doubled to +2');
  assert.equal(light.before, 10);
  assert.equal(light.after, 12);

  const magicalPower = first.effects.find((effect) => effect.group === 'abilities' && effect.key === 'magical_power');
  assert.equal(magicalPower.weekday_bonus, true, 'weekday affinity should double every positive effect in the chosen training');
  assert.equal(magicalPower.bonus_multiplier, 2);
  assert.equal(magicalPower.amount, 2);

  const drawback = first.effects.find((effect) => effect.direction === 'decrease');
  assert.equal(drawback.label, '闇魔法習熟度');
  assert.equal(drawback.chance, 0.5);
  assert.equal(drawback.amount, -1);
  assert.equal(drawback.before, 10);
  assert.equal(drawback.after, 9);

  let result = first;
  for (const [index, weekday] of ['闇曜', '火曜', '水曜', '土曜', '風曜'].entries()) {
    result = await jsonFetch(`${base}/api/training/run`, {
      method: 'POST',
      body: { training_id: 'healing_practice', random_seed: 20 + index }
    });
    assert.equal(result.training_day.name, weekday);
    assert.equal(result.training_progress.actions_used, index + 2);
  }

  assert.equal(result.training_progress.completed, true);
  assert.equal(result.training_progress.remaining_actions, 0);
  assert.equal(result.training_progress.next_day, null);
  assert.equal(result.state.current_screen, 'academy-map');
  assert.equal(result.state.training_actions_used, 0, 'academy map return should reset the next training display to 光曜 0 / 6');
  assert.equal(result.state.training_actions_limit, 6);

  const after = await jsonFetch(`${base}/api/world`);
  assert.deepEqual(after.player_parameters, result.world.player_parameters);
});

test('academy 鍛錬 screen keeps weekday progress instead of resetting to 光曜 on each action', async (t) => {
  const { root, base } = await withServer(t);
  const state = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime_state.json'), 'utf8'));
  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify({
    ...state,
    current_screen: 'academy-training',
    training_actions_used: 2,
    training_actions_limit: 6
  }, null, 2)}\n`, 'utf8');

  const result = await jsonFetch(`${base}/api/training/run`, {
    method: 'POST',
    body: { training_id: 'healing_practice', random_seed: 16 }
  });

  assert.equal(result.training_day.name, '火曜');
  assert.equal(result.training_progress.actions_used, 3);
  assert.equal(result.training_progress.next_day.name, '水曜');
  assert.equal(result.state.current_screen, 'academy-training');
  assert.equal(result.state.training_actions_used, 3);
});

test('training skip endpoint completes the week without changing player parameters after academy week start', async (t) => {
  const { base } = await withServer(t);
  const before = await jsonFetch(`${base}/api/world`);

  const started = await jsonFetch(`${base}/api/academy/week/start`, {
    method: 'POST',
    body: {}
  });

  assert.equal(started.route, 'academy-training');
  assert.equal(started.state.current_screen, 'academy-training');

  const skipped = await jsonFetch(`${base}/api/training/skip`, {
    method: 'POST',
    body: {}
  });

  assert.equal(skipped.training.id, 'skip_training');
  assert.equal(skipped.training_progress.completed, true);
  assert.equal(skipped.training_progress.actions_used, 6);
  assert.equal(skipped.training_progress.remaining_actions, 0);
  assert.deepEqual(skipped.effects, []);
  assert.equal(skipped.state.current_screen, 'academy-map');
  assert.equal(skipped.state.training_actions_used, 0);

  const after = await jsonFetch(`${base}/api/world`);
  assert.deepEqual(after.player_parameters, before.player_parameters);
  assert.deepEqual(skipped.world.player_parameters, before.player_parameters);
});

test('academy week start uses repository root as authoring source while mutating the active play slot', async (t) => {
  const root = await splitServerRoot();
  await fs.mkdir(path.join(root, 'content/characters/character_001'), { recursive: true });
  await fs.copyFile(
    path.join(projectRoot, 'content/characters/character_001/profile.json'),
    path.join(root, 'content/characters/character_001/profile.json')
  );
  await fs.copyFile(
    path.join(projectRoot, 'data/definitions/game_data/event_flags.json'),
    path.join(root, 'data/definitions/game_data/event_flags.json')
  );
  await fs.copyFile(
    path.join(projectRoot, 'data/definitions/game_data/locations.json'),
    path.join(root, 'data/definitions/game_data/locations.json')
  );
  await writeSplitJson(root, 'data/mutable/game_data/play/slots/slot_002/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room',
    global_flags: {},
    event_flag_sources: {},
    event_completion_sources: {},
    disabled_stage_flag_judgment_flows: {},
    visited_locations: ['herbology_garden'],
    active_character_ids: [],
    last_conversation_id: null,
    characters: {},
    pending_interaction_context: null,
    training_actions_used: 0,
    training_actions_limit: 6,
    elapsed_weeks: 49,
    ending_started: false,
    ending_completed: false,
    ending_character_id: null,
    current_buddy_character_id: null,
    current_enemy_character_ids: []
  });

  const server = createServer({
    root,
    assetsRoot,
    v5AssetsRoot,
    v5AdditionalAssetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const started = await jsonFetch(`${base}/api/academy/week/start`, {
    method: 'POST',
    body: {}
  });

  assert.equal(started.route, 'graduation-ending');
  assert.equal(started.character_id, 'character_001');
  assert.equal(started.state.ending_started, true);
  assert.equal(started.state.ending_completed, false);
  assert.equal(started.state.ending_character_id, 'character_001');
  assert.equal(started.state.pending_interaction_context.event_flag_id, 'event.graduation_ending.ready');

  const savedState = JSON.parse(await fs.readFile(path.join(root, 'data/mutable/game_data/play/slots/slot_002/game_data/runtime_state.json'), 'utf8'));
  assert.equal(savedState.elapsed_weeks, 50);
  assert.equal(savedState.ending_character_id, 'character_001');
  assert.equal(savedState.pending_interaction_context.event_flag_id, 'event.graduation_ending.ready');
  await assert.rejects(fs.access(path.join(root, 'data/mutable/characters/character_001/profile.json')), { code: 'ENOENT' });
});

test('training updates player parameters without baking conditional world lore into the editable base description', async (t) => {
  const { root, base } = await withServer(t);
  const state = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime_state.json'), 'utf8'));
  state.global_flags = {
    ...state.global_flags,
    'knowledge.runaway_cleaning_golem_discussed': true,
    'event.cleaning_golem_shutdown.completed': false
  };
  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/world/settings.json'), `${JSON.stringify({
    academy_name: '星灯魔法学院',
    player_name: '主人公',
    world_description: '基本説明。',
    world_condition_texts: [
      {
        id: 'knowledge.runaway_cleaning_golem_discussed.world_text',
        required_global_flags: ['knowledge.runaway_cleaning_golem_discussed'],
        excluded_global_flags: ['event.cleaning_golem_shutdown.completed'],
        text: '廊下を巡回する自動掃除ゴーレムが、命令を誤解して暴走しているらしい。'
      }
    ]
  }, null, 2)}\n`, 'utf8');

  const before = await jsonFetch(`${base}/api/world`);
  assert.equal(before.world_description_base, '基本説明。');
  assert.match(before.world_description, /自動掃除ゴーレム/);

  await jsonFetch(`${base}/api/training/run`, {
    method: 'POST',
    body: { training_id: 'healing_practice', random_seed: 16 }
  });

  const persisted = JSON.parse(await fs.readFile(path.join(root, 'game_data/world/settings.json'), 'utf8'));
  assert.equal(persisted.world_description, '基本説明。');
  assert.doesNotMatch(persisted.world_description, /自動掃除ゴーレム/);
  const after = await jsonFetch(`${base}/api/world`);
  assert.match(after.world_description, /自動掃除ゴーレム/);
  assert.notEqual(after.player_parameters.magic.light.value, before.player_parameters.magic.light.value);
});

test('prompt preview includes pending recalled work records selected after the previous reply', async (t) => {
  const { root, base } = await withServer(t);
  const pendingId = 'wr_pending_preview_recall';
  await fs.writeFile(path.join(root, 'game_data/characters/lina/work_records', `${pendingId}.md`), '# 深夜の鍵束について話した\n\nID: wr_pending_preview_recall\n\n## Summary\n\n主人公は深夜の鍵束の音が北階段から聞こえたとリナに伝え、リナはその記録を次の会話で参照する必要がある。\n', 'utf8');
  await fs.mkdir(path.join(root, 'game_data/logs/conversations'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/logs/conversations/conv_pending_preview.json'), JSON.stringify({
    id: 'conv_pending_preview',
    character_id: 'lina',
    character_name: 'リナ・クラウゼ',
    created_at: '2026-05-06T06:50:00.000+09:00',
    updated_at: '2026-05-06T06:51:00.000+09:00',
    source_type: 'field',
    location_id: 'herbology_garden',
    time_slot: 'after_school',
    pending_recalled_work_record_ids: [pendingId],
    messages: [
      { role: 'user', content: 'さっきの記録を思い出して' },
      { role: 'assistant', content: '次の発言に備えて記録を接続します。' }
    ]
  }, null, 2), 'utf8');
  const state = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime_state.json'), 'utf8'));
  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), JSON.stringify({
    ...state,
    current_screen: 'interaction',
    current_interaction_character_id: 'lina',
    last_conversation_id: 'conv_pending_preview'
  }, null, 2), 'utf8');

  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=lina&player_input=${encodeURIComponent('これは検索語が合わない次発言')}`);

  assert.match(preview.prompt, /この場で参照する過去の記録:\n- wr pending preview recall/);
  assert.match(preview.prompt, /主人公は深夜の鍵束の音が北階段から聞こえた/);
});

test('prompt preview replaces the most recent memories with their matching work records like the live conversation path', async (t) => {
  const { root, base } = await withServer(t);
  const memoryDir = path.join(root, 'game_data/characters/lina/memory');
  const workRecordDir = path.join(root, 'game_data/characters/lina/work_records');
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(workRecordDir, { recursive: true });

  for (const index of [1, 2, 3, 4, 5]) {
    await fs.writeFile(path.join(memoryDir, `mem_preview_recent_${index}.json`), JSON.stringify({
      id: `mem_preview_recent_${index}`,
      character_id: 'lina',
      visibility: 'character_known',
      type: 'relationship_change',
      text: `PREVIEW-MEMORY-${index}`,
      source_conversation_id: `conv_preview_recent_${index}`,
      work_record_id: `wr_preview_recent_${index}`
    }, null, 2), 'utf8');
    await fs.writeFile(path.join(workRecordDir, `wr_preview_recent_${index}.md`), `# preview recent ${index}\n\nID: wr_preview_recent_${index}\n\n## Summary\n\nPREVIEW-WORK-${index}\n`, 'utf8');
  }
  await fs.writeFile(path.join(memoryDir, 'mem_preview_recent_6_hidden.json'), JSON.stringify({
    id: 'mem_preview_recent_6_hidden',
    character_id: 'lina',
    visibility: 'hidden_story',
    type: 'relationship_change',
    text: 'PREVIEW-HIDDEN-MEMORY-6',
    source_conversation_id: 'conv_preview_recent_6',
    work_record_id: 'wr_preview_hidden_recent_6'
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workRecordDir, 'wr_preview_hidden_recent_6.md'), '# hidden preview recent 6\n\nID: wr_preview_hidden_recent_6\n\n## Summary\n\nPREVIEW-HIDDEN-WORK-6\n', 'utf8');

  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=lina&player_input=${encodeURIComponent('今日は別件だけ確認したい')}`);

  assert.match(preview.prompt, /PREVIEW-MEMORY-1/);
  assert.match(preview.prompt, /PREVIEW-MEMORY-2/);
  assert.doesNotMatch(preview.prompt, /PREVIEW-MEMORY-3/);
  assert.doesNotMatch(preview.prompt, /PREVIEW-MEMORY-4/);
  assert.doesNotMatch(preview.prompt, /PREVIEW-MEMORY-5/);
  assert.match(preview.prompt, /PREVIEW-WORK-3/);
  assert.match(preview.prompt, /PREVIEW-WORK-4/);
  assert.match(preview.prompt, /PREVIEW-WORK-5/);
  assert.doesNotMatch(preview.prompt, /PREVIEW-HIDDEN-MEMORY-6/);
  assert.doesNotMatch(preview.prompt, /PREVIEW-HIDDEN-WORK-6/);
});


test('server exposes character-local continuity records and delete actions for the selected character', async (t) => {
  const { root, base } = await withServer(t);
  await jsonFetch(`${base}/api/characters`);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'character_007', source_type: 'field' }
  });
  const opening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  const ending = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  assert.equal(ending.finalization_status, 'completed');
  assert.equal(ending.state.current_screen, 'academy-room');

  const status = await jsonFetch(`${base}/api/records/status?character_id=character_007`);
  assert.equal(status.records.memory.items.length, 1);
  assert.equal(status.records.skills.items.length, 1);
  assert.equal(status.records.work_records.items.length, 1);
  assert.equal(status.records.memory.items.length, 1);
  assert.equal(status.records.memory.items[0].source_conversation_id, opening.conversation.id);
  assert.equal(status.records.skills.items.length, 1);
  assert.equal(status.records.skills.items[0].source_conversation_id, opening.conversation.id);
  assert.equal(status.records.work_records.items.length, 1);
  assert.equal(status.records.work_records.items[0].id, `wr_${opening.conversation.id}`);
  assert.match(status.responsibilities.work_records, /20文以下/);
  await fs.access(path.join(root, 'game_data/characters/character_007/memory'));
  await fs.access(path.join(root, 'game_data/characters/character_007/work_records'));
  await fs.access(path.join(root, 'game_data/characters/character_007/skills.json'));

  const deleteMemory = await jsonFetch(`${base}/api/records/reset`, {
    method: 'POST',
    body: { character_id: 'character_007', target: 'memory' }
  });
  assert.equal(deleteMemory.status.records.memory.count, 0);
  assert.equal(deleteMemory.status.records.skills.count, 1);
  assert.equal(deleteMemory.status.records.work_records.count, 1);

  const deleteSkills = await jsonFetch(`${base}/api/records/reset`, {
    method: 'POST',
    body: { character_id: 'character_007', target: 'skills' }
  });
  assert.equal(deleteSkills.status.records.skills.count, 0);

  const deleteWorkRecords = await jsonFetch(`${base}/api/records/reset`, {
    method: 'POST',
    body: { character_id: 'character_007', target: 'work_records' }
  });
  assert.equal(deleteWorkRecords.status.records.work_records.count, 0);
});

test('split-root continuity status/reset stay missing-dir tolerant and do not materialize legacy game_data character continuity paths', async (t) => {
  const { root, base } = await withSplitServer(t);

  const status = await jsonFetch(`${base}/api/records/status?character_id=lina`);
  assert.equal(status.records.memory.count, 0);
  assert.equal(status.records.skills.count, 0);
  assert.equal(status.records.work_records.count, 0);
  assert.equal(status.last_finalization, null);

  const reset = await jsonFetch(`${base}/api/records/reset`, {
    method: 'POST',
    body: { character_id: 'lina', target: 'all' }
  });
  assert.deepEqual(reset.reset_targets, ['memory', 'skills', 'work_records']);
  assert.equal(reset.status.records.memory.count, 0);
  assert.equal(reset.status.records.skills.count, 0);
  assert.equal(reset.status.records.work_records.count, 0);

  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/memory')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/work_records')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/skills.json')), { code: 'ENOENT' });
});

test('split-root prompt preview reads authored profile plus mutable flags without materializing legacy continuity directories', async (t) => {
  const { root, base } = await withSplitServer(t);
  await writeSplitJson(root, 'content/characters/lina/profile.json', {
    character_id: 'lina',
    display_name: 'リナ・クラウゼ',
    school_year: '2年生',
    club: '薬草学研究会',
    identity: '星図と温室の噂話をつなげて考える少女。',
    prompt_description: '星図と温室の噂話をつなげて考える少女。',
    speaking_basis: '落ち着いた口調で、観察した事実を順序立てて話す。'
  });
  await writeSplitJson(root, 'data/mutable/game_data/characters/lina/flags.json', {
    character_id: 'lina',
    flags: {
      'knowledge.lina.player_checked_garden_label': true,
      'relationship.lina.trust': 5
    }
  });
  await writeSplitJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-room',
    current_interaction_character_id: 'lina',
    global_flags: {},
    event_flag_sources: {},
    event_completion_sources: {},
    disabled_stage_flag_judgment_flows: {},
    visited_locations: ['herbology_garden'],
    active_character_ids: ['lina'],
    last_conversation_id: null,
    characters: { lina: { flags: { 'relationship.lina.trust': 5 } } },
    pending_interaction_context: null,
    training_actions_used: 0,
    training_actions_limit: 6,
    elapsed_weeks: 0,
    ending_started: false,
    ending_completed: false,
    ending_character_id: null,
    current_buddy_character_id: null,
    current_enemy_character_ids: []
  });

  const preview = await jsonFetch(`${base}/api/prompt-preview?character_id=lina&player_input=${encodeURIComponent('温室の札について相談したい。')}`);
  assert.equal(preview.character_id, 'lina');
  assert.match(preview.prompt, /リナ・クラウゼ/);
  assert.match(preview.prompt, /星図と温室の噂話をつなげて考える少女/);
  assert.match(preview.prompt, /温室の札について相談したい/);

  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/memory')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/work_records')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/skills.json')), { code: 'ENOENT' });
});

test('conversation end endpoint is safe when there is no active conversation or the session is already finalized', async (t) => {
  const { root, base } = await withServer(t);
  const noSession = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  assert.equal(noSession.skipped, true);
  assert.equal(noSession.reason, 'no_active_conversation');
  assert.equal(noSession.state.current_screen, 'academy-room');

  await jsonFetch(`${base}/api/characters`);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'character_007', source_type: 'field' }
  });
  const opening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  const finalized = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  assert.equal(finalized.finalization_status, 'completed');
  assert.equal(finalized.state.current_screen, 'academy-room');
  assert.equal(finalized.conversation.id, opening.conversation.id);
  const log = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/conversations', `${opening.conversation.id}.json`), 'utf8'));
  assert.equal(log.discarded_after_work_record_id, `wr_${opening.conversation.id}`);
  const finalizedAgain = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'character_007', provider: 'mock' }
  });
  assert.equal(finalizedAgain.skipped, true);
  assert.equal(finalizedAgain.reason, 'already_finalized');
  assert.equal(finalizedAgain.conversation.id, finalized.conversation.id);
  assert.equal(finalizedAgain.state.current_screen, 'academy-room');
});

test('conversation lifecycle does not mark graduation ending complete before finalization succeeds', async () => {
  const writes = [];
  await assert.rejects(() => handleConversationLifecycleApi({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://example.test/api/conversation/end'),
    context: { root: '/tmp/runtime' },
    sendJson: () => {
      throw new Error('sendJson should not be called after finalization failure');
    },
    readBody: async () => ({ character_id: 'lina', conversation_id: 'conv_grad_test' }),
    resolveRuntimeProviders: async () => ({ provider: 'mock' }),
    readJson: async (_root, relativePath) => {
      if (relativePath === 'game_data/runtime_state.json') {
        return {
          current_screen: 'interaction',
          current_interaction_character_id: 'lina',
          pending_interaction_context: { event_flag_id: 'event.graduation_ending.ready' },
          last_conversation_id: 'conv_grad_test',
          ending_started: true,
          ending_completed: false,
          ending_character_id: 'lina',
          global_flags: { 'event.graduation_ending.ready': true }
        };
      }
      throw new Error(`unexpected readJson path: ${relativePath}`);
    },
    readJsonIfExists: async (_root, relativePath) => {
      if (relativePath === 'game_data/logs/conversations/conv_grad_test.json') {
        return { id: 'conv_grad_test', character_id: 'lina' };
      }
      throw new Error(`unexpected readJsonIfExists path: ${relativePath}`);
    },
    writeJson: async (_root, relativePath, value) => {
      writes.push({ relativePath, value: structuredClone(value) });
    },
    runConversationOpening: async () => {
      throw new Error('unused');
    },
    runConversationTurn: async () => {
      throw new Error('unused');
    },
    editConversationUserMessage: async () => {
      throw new Error('unused');
    },
    runConversationFinalization: async () => {
      throw new Error('finalization_failed');
    },
    markGraduationEndingComplete: (state) => ({ ...state, ending_completed: true }),
    isGraduationEndingContext: () => true
  }), /finalization_failed/);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].relativePath, 'game_data/runtime_state.json');
  assert.equal(writes[0].value.ending_completed, false);
  assert.equal(writes[0].value.current_interaction_character_id, null);
  assert.equal(writes[0].value.pending_interaction_context, null);
});

test('conversation lifecycle skip paths do not manufacture graduation ending completion', async () => {
  const { req, res } = createLifecycleReqRes();
  const writes = [];
  let payload = null;
  await handleConversationLifecycleApi({
    req,
    res,
    url: new URL('http://example.test/api/conversation/end'),
    context: { root: '/tmp/runtime' },
    sendJson: (_res, body) => {
      payload = body;
      return body;
    },
    readBody: async () => ({ character_id: 'lina', conversation_id: 'conv_missing' }),
    resolveRuntimeProviders: async () => ({ provider: 'mock' }),
    readJson: async (_root, relativePath) => {
      if (relativePath === 'game_data/runtime_state.json') {
        return {
          current_screen: 'interaction',
          current_interaction_character_id: 'lina',
          pending_interaction_context: { event_flag_id: 'event.graduation_ending.ready' },
          last_conversation_id: 'conv_missing',
          ending_started: true,
          ending_completed: false,
          ending_character_id: 'lina',
          global_flags: { 'event.graduation_ending.ready': true }
        };
      }
      throw new Error(`unexpected readJson path: ${relativePath}`);
    },
    readJsonIfExists: async () => null,
    writeJson: async (_root, relativePath, value) => {
      writes.push({ relativePath, value: structuredClone(value) });
    },
    runConversationOpening: async () => {
      throw new Error('unused');
    },
    runConversationTurn: async () => {
      throw new Error('unused');
    },
    editConversationUserMessage: async () => {
      throw new Error('unused');
    },
    runConversationFinalization: async () => {
      throw new Error('unused');
    },
    markGraduationEndingComplete: (state) => ({ ...state, ending_completed: true }),
    isGraduationEndingContext: () => true
  });

  assert.equal(payload.skipped, true);
  assert.equal(payload.reason, 'no_active_conversation');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value.ending_completed, false);
  assert.equal(writes[0].value.current_interaction_character_id, null);
  assert.equal(writes[0].value.pending_interaction_context, null);
});

test('conversation lifecycle delegates graduation completion into finalization instead of writing it afterward', async () => {
  const { req, res } = createLifecycleReqRes();
  const writes = [];
  let payload = null;
  let finalizationArgs = null;
  await handleConversationLifecycleApi({
    req,
    res,
    url: new URL('http://example.test/api/conversation/end'),
    context: { root: '/tmp/runtime' },
    sendJson: (_res, body) => {
      payload = body;
      return body;
    },
    readBody: async () => ({ character_id: 'lina', conversation_id: 'conv_grad_success' }),
    resolveRuntimeProviders: async () => ({ provider: 'mock' }),
    readJson: async (_root, relativePath) => {
      if (relativePath === 'game_data/runtime_state.json') {
        return {
          current_screen: 'interaction',
          current_interaction_character_id: 'lina',
          pending_interaction_context: { event_flag_id: 'event.graduation_ending.ready' },
          last_conversation_id: 'conv_grad_success',
          ending_started: true,
          ending_completed: false,
          ending_character_id: 'lina',
          global_flags: { 'event.graduation_ending.ready': true }
        };
      }
      throw new Error(`unexpected readJson path: ${relativePath}`);
    },
    readJsonIfExists: async (_root, relativePath) => {
      if (relativePath === 'game_data/logs/conversations/conv_grad_success.json') {
        return { id: 'conv_grad_success', character_id: 'lina' };
      }
      throw new Error(`unexpected readJsonIfExists path: ${relativePath}`);
    },
    writeJson: async (_root, relativePath, value) => {
      writes.push({ relativePath, value: structuredClone(value) });
    },
    runConversationOpening: async () => {
      throw new Error('unused');
    },
    runConversationTurn: async () => {
      throw new Error('unused');
    },
    editConversationUserMessage: async () => {
      throw new Error('unused');
    },
    runConversationFinalization: async (args) => {
      finalizationArgs = args;
      return {
        conversation: { id: 'conv_grad_success', character_id: 'lina', discarded_after_work_record_id: 'wr_conv_grad_success' },
        state: {
          current_screen: 'title',
          current_interaction_character_id: null,
          pending_interaction_context: null,
          ending_started: true,
          ending_completed: true,
          ending_character_id: 'lina',
          global_flags: {
            'event.graduation_ending.ready': true,
            'event.graduation_ending.completed': true
          }
        }
      };
    },
    markGraduationEndingComplete: (state) => ({
      ...state,
      ending_completed: true,
      current_screen: 'title',
      global_flags: {
        ...(state.global_flags ?? {}),
        'event.graduation_ending.completed': true
      }
    }),
    isGraduationEndingContext: () => true
  });

  assert.equal(typeof finalizationArgs?.finalStateTransform, 'function');
  assert.equal(finalizationArgs.finalStateTransform({
    current_screen: 'academy-room',
    ending_started: true,
    ending_completed: false,
    global_flags: { 'event.graduation_ending.ready': true }
  }).ending_completed, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].relativePath, 'game_data/runtime_state.json');
  assert.equal(writes[0].value.ending_completed, false);
  assert.equal(payload.finalization_status, 'completed');
  assert.equal(payload.state.ending_completed, true);
  assert.equal(payload.state.current_screen, 'title');
});

test('background finalization preserves a newer graduation ending interaction state', async (t) => {
  const root = await fixtureRoot('magic-adv-finalize-race-');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, 'game_data/logs/conversations'), { recursive: true });

  const state = await readJson(root, 'game_data/runtime_state.json');
  state.current_screen = 'interaction';
  state.current_location_id = 'herbology_garden';
  state.current_location_visible_situation = '薬草温室の奥で、香りの強い苗が風に揺れている。';
  state.current_interaction_character_id = 'lina';
  state.last_conversation_id = 'conv_a';
  await writeJson(root, 'game_data/runtime_state.json', state);
  await writeJson(root, 'game_data/logs/conversations/conv_a.json', {
    id: 'conv_a',
    character_id: 'lina',
    character_name: 'リナ・クラウゼ',
    created_at: '2026-05-17T08:00:00.000+09:00',
    updated_at: '2026-05-17T08:05:00.000+09:00',
    source_type: 'field',
    location_id: 'herbology_garden',
    time_slot: 'after_school',
    prompt: 'old prompt',
    messages: [
      { role: 'assistant', content: '温室の話をしよう。' },
      { role: 'user', content: 'うん。' }
    ]
  });

  let injected = false;
  const result = await finalizeConversation({
    root,
    conversationId: 'conv_a',
    characterId: 'lina',
    memoryUpdateProvider: async () => ({ memory_record: { text: '温室で話した。', tags: [] } }),
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'NO' }),
    skillUpdateProvider: async () => ({ skipped: true, reason: 'test' }),
    workRecordProvider: async () => ({ work_record: { title: '温室の会話', summary: '温室で短く話した。', tags: [] }, flag_update_candidates: [] }),
    stageFlagJudgmentProvider: async () => ({ raw_answer: '[]', accepted_flags: [], rejected_flags: [] }),
    eventFlagJudgmentProvider: async () => ({ raw_answer: '[]', accepted_flags: [], rejected_flags: [] }),
    eventCompletionJudgmentProvider: async () => ({ raw_answer: '[]', accepted_flags: [], rejected_flags: [] }),
    eventParticipantOverrideJudgmentProvider: async () => ({ raw_answer: '[]', accepted_overrides: [], rejected_overrides: [] }),
    moneyDeltaProvider: async () => '0',
    buddyAgreementProvider: async () => 'NO',
    enemyHostilityProvider: async () => 'NO',
    destinationStageProvider: async () => {
      if (!injected) {
        injected = true;
        const newer = await readJson(root, 'game_data/runtime_state.json');
        await writeJson(root, 'game_data/runtime_state.json', {
          ...newer,
          current_screen: 'academy-conversation-session',
          current_location_id: 'front_gate_morning',
          current_location_visible_situation: '朝の正門で、卒業を見送る空気が静かに満ちている。',
          current_interaction_character_id: 'lina',
          last_conversation_id: 'conv_ending',
          ending_started: true,
          ending_completed: false,
          ending_character_id: 'lina',
          global_flags: {
            ...(newer.global_flags ?? {}),
            'event.graduation_ending.ready': true
          },
          event_flag_sources: {
            ...(newer.event_flag_sources ?? {}),
            'event.graduation_ending.ready': {
              character_id: 'lina',
              source_type: 'graduation_ending',
              achieved_at: '2026-05-17T08:06:00.000+09:00'
            }
          },
          pending_interaction_context: {
            source_type: 'event_flag',
            event_flag_id: 'event.graduation_ending.ready',
            event_label: '卒業エンディング',
            source_conversation_id: null,
            opening_context: 'これまでの出来事を振り返る卒業エンディング会話。'
          }
        });
      }
      return 'NONE';
    }
  });

  assert.equal(result.state.current_screen, 'academy-conversation-session');
  assert.equal(result.state.current_location_id, 'front_gate_morning');
  assert.equal(result.state.current_location_visible_situation, '朝の正門で、卒業を見送る空気が静かに満ちている。');
  assert.equal(result.state.current_interaction_character_id, 'lina');
  assert.equal(result.state.last_conversation_id, 'conv_ending');
  assert.equal(result.state.pending_interaction_context?.event_flag_id, 'event.graduation_ending.ready');
  assert.equal(result.state.global_flags['event.graduation_ending.ready'], true);

  const persisted = await readJson(root, 'game_data/runtime_state.json');
  assert.equal(persisted.current_screen, 'academy-conversation-session');
  assert.equal(persisted.current_location_id, 'front_gate_morning');
  assert.equal(persisted.last_conversation_id, 'conv_ending');
  assert.equal(persisted.pending_interaction_context?.event_flag_id, 'event.graduation_ending.ready');
});

test('server exposes generated background files and field locations for every background manifest entry', async (t) => {
  const { base } = await withServer(t);
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const field = await jsonFetch(`${base}/api/field`);
  const manifest = await jsonFetch(`${base}/generated/backgrounds/manifest.json`);

  assert.equal(field.locations.length, manifest.backgrounds.length);
  const cafeteria = field.locations.find((location) => location.background_manifest_id === 'student_cafeteria_magic_lamps');
  assert.equal(cafeteria.id, 'student_cafeteria_magic_lamps');
  assert.equal(cafeteria.display_name, '学生食堂');
  assert.equal(cafeteria.background_url, '/canonical/backgrounds/background_012.png');

  const generatedBackground = await fetch(`${base}${cafeteria.background_url}`);
  assert.equal(generatedBackground.status, 200);
  assert.equal(generatedBackground.headers.get('content-type'), 'image/png');
});

test('server exposes generated field backgrounds through repo-local canonical assets', async (t) => {
  const { base } = await withServer(t);
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const field = await jsonFetch(`${base}/api/field`);
  const location = field.locations.find((item) => item.id === 'herbology_garden');
  assert.equal(location.background_manifest_id, 'herbology_greenhouse');
  assert.match(location.background_url, /\/canonical\/backgrounds\/background_006\.png$/);
  assert.equal(location.background_source_image_url, location.background_url);

  for (const assetPath of [
    location.background_url,
    location.background_source_image_url
  ]) {
    const response = await fetch(`${base}${assetPath}`);
    assert.equal(response.status, 200, assetPath);
    assert.equal(response.headers.get('content-type'), 'image/png');
  }
});

test('server exposes live character and location render contracts through canonical-backed assets', async (t) => {
  const { base } = await withServer(t);
  const catalog = await jsonFetch(`${base}/api/characters`);
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const field = await jsonFetch(`${base}/api/field`);

  const character = catalog.characters.find((entry) => entry.standee_url && entry.face_url && entry.selection_icon_url);
  assert.ok(character, 'playable character catalog should include at least one fully renderable character');
  assert.match(character.standee_url, /^\/canonical\/character_visual_sets\/.+\/(?:standees|scene_standee)\//);
  assert.match(character.face_url, /^\/canonical\/character_visual_sets\/.+\/face_emotions\/.*\.png$/);
  assert.match(character.selection_icon_url, /^\/canonical\/character_visual_sets\/.+\/face_emotions\/.*\.png$/);

  const currentLocation = field.locations.find((location) => location.id === field.state.current_location_id);
  assert.ok(currentLocation, 'field API should include the current location detail inside locations');
  assert.equal(typeof currentLocation.display_name, 'string');
  assert.ok(currentLocation.display_name.length > 0);
  assert.match(currentLocation.visible_situation, /薬草|温室/);
  assert.match(currentLocation.background_url, /\/canonical\/backgrounds\/.*\.png$/);

  for (const assetPath of [character.standee_url, character.face_url, character.selection_icon_url, currentLocation.background_url]) {
    const response = await fetch(`${base}${assetPath}`);
    assert.equal(response.status, 200, assetPath);
    assert.equal(response.headers.get('content-type'), 'image/png');
  }
});

test('server creates LLM-generated opening utterance and resets continuity records by target', async (t) => {
  const { root, base } = await withServer(t);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'lina', source_type: 'field' }
  });
  const opening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: 'lina', provider: 'mock' }
  });
  assert.equal(opening.conversation.messages.length, 1);
  assert.equal(opening.conversation.messages[0].role, 'assistant');
  assert.doesNotMatch(opening.conversation.messages[0].content, /この葉、普通の病気ではなさそうです/);
  assert.equal(opening.state.current_screen, 'interaction');

  const ending = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'lina', provider: 'mock' }
  });
  assert.equal(ending.finalization_status, 'completed');
  assert.equal(ending.state.current_screen, 'academy-room');
  await fs.access(path.join(root, 'game_data/characters/lina/work_records', `wr_${opening.conversation.id}.md`));

  const reset = await jsonFetch(`${base}/api/records/reset`, {
    method: 'POST',
    body: { character_id: 'lina', target: 'all' }
  });
  assert.deepEqual(reset.reset_targets, ['memory', 'skills', 'work_records']);
  assert.equal((await fs.readdir(path.join(root, 'game_data/characters/lina/work_records'))).length, 0);
  const skills = JSON.parse(await fs.readFile(path.join(root, 'game_data/characters/lina/skills.json'), 'utf8'));
  assert.equal(skills.skills.some((skill) => skill.type === 'self_change'), false);
});

function parseSse(text) {
  return text.trim().split('\n\n').filter(Boolean).map((block) => {
    const event = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
    const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
    return { event, data: data ? JSON.parse(data) : null };
  });
}

test('server keeps one active conversation across repeated non-stream and stream sends without explicit ids', async (t) => {
  const { root, base } = await withServer(t);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'lina', source_type: 'field' }
  });

  const first = await jsonFetch(`${base}/api/conversation`, {
    method: 'POST',
    body: { character_id: 'lina', player_input: '最初の発言だよ', provider: 'mock' }
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const second = await jsonFetch(`${base}/api/conversation`, {
    method: 'POST',
    body: { character_id: 'lina', player_input: 'さっきの続きで聞くね', provider: 'mock' }
  });

  assert.equal(second.conversation.id, first.conversation.id);
  assert.equal(second.conversation.messages.length, 4);
  assert.deepEqual(second.conversation.messages.map((message) => message.role), ['user', 'assistant', 'user', 'assistant']);
  const secondLog = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/conversations', `${first.conversation.id}.json`), 'utf8'));
  assert.match(secondLog.prompt, /直前までの会話:/);
  assert.match(secondLog.prompt, /プレイヤー: 最初の発言だよ/);
  assert.match(secondLog.prompt, /リナ・クラウゼ: ……はい。今の話を手がかりに/);

  const streamed = await fetch(`${base}/api/conversation/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina', player_input: 'さらに続けるね', provider: 'mock' })
  });
  assert.equal(streamed.status, 200);
  const events = parseSse(await streamed.text());
  const result = events.find((item) => item.event === 'result')?.data;
  assert.equal(result.conversation.id, first.conversation.id);
  assert.equal(result.conversation.messages.length, 6);
  assert.equal(result.conversation.messages.at(-2).content, 'さらに続けるね');
});

test('server starts a distinct opening conversation after leaving and re-entering interaction', async (t) => {
  const { base } = await withServer(t);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'lina', source_type: 'field' }
  });
  const firstOpening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: 'lina', provider: 'mock' }
  });
  await jsonFetch(`${base}/api/field/move`, {
    method: 'POST',
    body: { location_id: 'old_corridor' }
  }).catch(() => null);
  await jsonFetch(`${base}/api/interaction/start`, {
    method: 'POST',
    body: { character_id: 'lina', source_type: 'field' }
  });
  const secondOpening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: 'lina', provider: 'mock' }
  });

  assert.notEqual(secondOpening.conversation.id, firstOpening.conversation.id);
  assert.equal(secondOpening.conversation.messages.length, 1);
  assert.equal(secondOpening.conversation.messages[0].role, 'assistant');
});

test('server POST endpoints run conversation, ignore deprecated event files, and save/load against the selected runtime root', async (t) => {
  const { root, base } = await withServer(t);

  const turn = await jsonFetch(`${base}/api/conversation`, {
    method: 'POST',
    body: { character_id: 'lina', player_input: '棚札の順番を一緒に調べよう', provider: 'mock' }
  });
  assert.equal(turn.conversation.character_id, 'lina');
  assert.equal(turn.state.last_conversation_id, turn.conversation.id);
  assert.equal(turn.state.current_screen, 'interaction');
  assert.equal(turn.state.current_interaction_character_id, 'lina');
  assert.equal(turn.validator, undefined);
  await fs.access(path.join(root, 'game_data/logs/conversations', `${turn.conversation.id}.json`));
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/work_records', `wr_${turn.conversation.id}.md`)));

  const finalizedTurn = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: 'lina', provider: 'mock' }
  });
  assert.equal(finalizedTurn.conversation.id, turn.conversation.id);
  assert.equal(finalizedTurn.finalization_status, 'completed');
  assert.equal(finalizedTurn.state.current_screen, 'academy-room');
  await waitFor(async () => fs.access(path.join(root, 'game_data/characters/lina/work_records', `wr_${turn.conversation.id}.md`)));
  const validator = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/validator', `${turn.conversation.id}.json`), 'utf8'));
  assert.equal(validator.accepted_memory.length, 1);

  const saved = await jsonFetch(`${base}/api/save`, {
    method: 'POST',
    body: { slot_id: 'slot_api_1', label: 'API smoke slot' }
  });
  assert.equal(saved.slot_id, 'slot_api_1');
  const slots = await jsonFetch(`${base}/api/save-slots`);
  assert.deepEqual(slots.map((slot) => slot.slot_id), ['slot_api_1']);

  await fs.mkdir(path.join(root, 'game_data/events'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'game_data/events/evt_field_arrival_test.json'),
    `${JSON.stringify({
      id: 'evt_field_arrival_test',
      title: 'Deprecated field arrival test',
      location_id: 'old_corridor',
      time_slots: ['after_school'],
      priority: 60,
      screen: 'event',
      trigger: { all: [{ flag: 'story.archive_intro_done', op: 'eq', value: false }] },
      effects_on_complete: []
    }, null, 2)}\n`,
    'utf8'
  );
  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const moved = await jsonFetch(`${base}/api/field/move`, {
    method: 'POST',
    body: { location_id: 'old_corridor' }
  });
  assert.equal(moved.location.id, 'old_corridor');
  assert.equal(moved.state.current_location_id, 'old_corridor');
  assert.equal(moved.state.current_screen, 'field');
  assert.deepEqual(moved.state.visited_locations.slice(0, 2), ['herbology_garden', 'old_corridor']);
  assert.equal(new Set(moved.state.visited_locations).size, moved.state.visited_locations.length);

  const afterMoveField = await jsonFetch(`${base}/api/field`);
  assert.equal(afterMoveField.state.current_location_id, 'old_corridor');

  const obsoleteEndpoint = await fetch(`${base}/api/events/complete`, { method: 'POST' });
  assert.equal(obsoleteEndpoint.status, 404);

  const fieldCandidates = await jsonFetch(`${base}/api/field`);
  assert.equal(fieldCandidates.locations.length, 30);
  assert.equal(fieldCandidates.locations.some((location) => location.id === 'sealed_ritual_room'), true);
  assert.equal(fieldCandidates.locations.some((location) => location.background_manifest_id === 'front_gate_morning'), true);
  assert.equal(fieldCandidates.locations.flatMap((location) => location.hotspots ?? []).some((hotspot) => hotspot.target?.startsWith('event:')), false);
  assert.equal(fieldCandidates.locations.flatMap((location) => location.hotspots ?? []).some((hotspot) => hotspot.target?.startsWith('interaction:')), false);

  const directStageMove = await jsonFetch(`${base}/api/field/move`, {
    method: 'POST',
    body: { location_id: 'astronomy_tower_observatory' }
  });
  assert.equal(directStageMove.location.id, 'astronomy_tower_observatory');
  assert.equal(directStageMove.state.current_screen, 'field');

  const loaded = await jsonFetch(`${base}/api/load`, {
    method: 'POST',
    body: { slot_id: 'slot_api_1' }
  });
  assert.equal(loaded.runtime_state.global_flags['story.archive_intro_done'], false);
});

test('slot load keeps character continuity isolated per slot and lands on academy-training', async (t) => {
  const { root, base } = await withServer(t);

  const first = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotA = first.slot.slot_id;
  await fs.mkdir(path.join(root, 'game_data/play/slots', slotA, 'game_data/characters/lina/memory'), { recursive: true });
  await fs.mkdir(path.join(root, 'game_data/play/slots', slotA, 'game_data/characters/lina/work_records'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots', slotA, 'game_data/characters/lina/memory', 'slot-a-memory.json'), `${JSON.stringify({ id: 'slot-a-memory', text: 'slot A only' }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/play/slots', slotA, 'game_data/characters/lina/skills.json'), `${JSON.stringify({ character_id: 'lina', skills: [{ id: 'slot_a_skill', type: 'self_change', description: 'slot A skill' }] }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/play/slots', slotA, 'game_data/characters/lina/work_records', 'wr_slot_a.md'), '# slot A work record\n', 'utf8');

  const second = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotB = second.slot.slot_id;
  assert.notEqual(slotB, slotA);

  const slotBMemoryEntries = await fs.readdir(path.join(root, 'game_data/play/slots', slotB, 'game_data/characters/lina/memory'));
  assert.deepEqual(slotBMemoryEntries, []);
  const slotBSkills = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', slotB, 'game_data/characters/lina/skills.json'), 'utf8'));
  assert.deepEqual(slotBSkills.skills, []);

  const slotALoad = await jsonFetch(`${base}/api/slots/load`, { method: 'POST', body: { slot_id: slotA } });
  assert.equal(slotALoad.state.current_screen, 'academy-room');
  assert.equal(slotALoad.slot.slot_id, slotA);

  const slotARecords = await jsonFetch(`${base}/api/records/status?character_id=lina`);
  assert.equal(slotARecords.records.memory.items.some((item) => item.id === 'slot-a-memory'), true);
  assert.equal(slotARecords.records.skills.items.some((item) => item.id === 'slot_a_skill'), true);
  assert.equal(slotARecords.records.work_records.items.some((item) => item.id === 'wr_slot_a'), true);

  const listedWithSlotAActive = await jsonFetch(`${base}/api/slots`);
  assert.equal(listedWithSlotAActive.active_slot_id, slotA);
  assert.equal(listedWithSlotAActive.slots.some((slot) => slot.slot_id === slotA), true);

  await jsonFetch(`${base}/api/slots/load`, { method: 'POST', body: { slot_id: slotB } });
  const slotBRecords = await jsonFetch(`${base}/api/records/status?character_id=lina`);
  assert.equal(slotBRecords.records.memory.items.some((item) => item.id === 'slot-a-memory'), false);
  assert.equal(slotBRecords.records.skills.items.some((item) => item.id === 'slot_a_skill'), false);
  assert.equal(slotBRecords.records.work_records.items.some((item) => item.id === 'wr_slot_a'), false);

  const listedWithSlotBActive = await jsonFetch(`${base}/api/slots`);
  assert.equal(listedWithSlotBActive.active_slot_id, slotB);
});

test('slot load API refuses graduated slots and exposes graduation_completed in slot summaries', async (t) => {
  const { root, base } = await withServer(t);

  const first = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const graduatedSlotId = first.slot.slot_id;
  const second = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const activeSlotId = second.slot.slot_id;

  const graduatedStatePath = path.join(root, 'game_data/play/slots', graduatedSlotId, 'game_data/runtime_state.json');
  const graduatedState = JSON.parse(await fs.readFile(graduatedStatePath, 'utf8'));
  graduatedState.ending_completed = true;
  await fs.writeFile(graduatedStatePath, `${JSON.stringify(graduatedState, null, 2)}\n`, 'utf8');

  const listed = await jsonFetch(`${base}/api/slots`);
  assert.equal(listed.slots.find((slot) => slot.slot_id === graduatedSlotId)?.graduation_completed, true);
  assert.equal(listed.slots.find((slot) => slot.slot_id === activeSlotId)?.graduation_completed, false);
  assert.equal(listed.active_slot_id, activeSlotId);

  const response = await fetch(`${base}/api/slots/load`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slot_id: graduatedSlotId })
  });
  const body = JSON.parse(await response.text());
  assert.equal(response.status, 409);
  assert.match(body.error ?? '', /graduation_completed|graduated/i);

  const activeAfterRefusal = await jsonFetch(`${base}/api/slots`);
  assert.equal(activeAfterRefusal.active_slot_id, activeSlotId);
});

test('starting the next academy week increments elapsed weeks and branches into the graduation ending at week 50', async (t) => {
  const { root, base } = await withServer(t);

  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const runtimeStatePath = path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json');
  const runtimeState = JSON.parse(await fs.readFile(runtimeStatePath, 'utf8'));
  runtimeState.current_screen = 'academy-room';
  runtimeState.elapsed_weeks = 48;
  await fs.writeFile(runtimeStatePath, `${JSON.stringify(runtimeState, null, 2)}\n`, 'utf8');

  const week49 = await jsonFetch(`${base}/api/academy/week/start`, { method: 'POST', body: {} });
  assert.equal(week49.route, 'academy-training');
  assert.equal(week49.state.elapsed_weeks, 49);
  assert.equal(week49.state.current_screen, 'academy-training');

  await fs.mkdir(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_007/memory'), { recursive: true });
  await fs.mkdir(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_008/memory'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_007/memory/mem_1.json'), `${JSON.stringify({ id: 'mem_1', text: 'older memory' }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_008/memory/mem_1.json'), `${JSON.stringify({ id: 'mem_1', text: 'memory 1' }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_008/memory/mem_2.json'), `${JSON.stringify({ id: 'mem_2', text: 'memory 2' }, null, 2)}\n`, 'utf8');

  const week50 = await jsonFetch(`${base}/api/academy/week/start`, { method: 'POST', body: {} });
  assert.equal(week50.route, 'graduation-ending');
  assert.equal(week50.state.elapsed_weeks, 50);
  assert.equal(week50.state.current_screen, 'academy-conversation-session');
  assert.equal(week50.state.current_interaction_character_id, 'character_008');
  assert.equal(week50.state.ending_started, true);
  assert.equal(week50.state.ending_completed, false);
  assert.equal(week50.state.ending_character_id, 'character_008');
  assert.equal(week50.state.pending_interaction_context.event_flag_id, 'event.graduation_ending.ready');
  assert.equal(week50.state.pending_interaction_context.opening_context, '会話ではこれまでの関係や記憶を振り返ること。');
});

test('ending conversation returns to title after graduation loading and marks the ending complete', async (t) => {
  const { root, base } = await withServer(t);

  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const runtimeStatePath = path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json');
  const runtimeState = JSON.parse(await fs.readFile(runtimeStatePath, 'utf8'));
  runtimeState.current_screen = 'academy-room';
  runtimeState.elapsed_weeks = 49;
  await fs.writeFile(runtimeStatePath, `${JSON.stringify(runtimeState, null, 2)}\n`, 'utf8');
  await fs.mkdir(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_008/memory'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_001/game_data/characters/character_008/memory/mem_1.json'), `${JSON.stringify({ id: 'mem_1', text: 'memory 1' }, null, 2)}\n`, 'utf8');

  const week50 = await jsonFetch(`${base}/api/academy/week/start`, { method: 'POST', body: {} });
  const opening = await jsonFetch(`${base}/api/conversation/opening`, {
    method: 'POST',
    body: { character_id: week50.character_id, provider: 'mock' }
  });
  assert.equal(opening.conversation.event_flag_id, 'event.graduation_ending.ready');

  const ending = await jsonFetch(`${base}/api/conversation/end`, {
    method: 'POST',
    body: { character_id: week50.character_id, provider: 'mock' }
  });
  assert.equal(ending.finalization_status, 'completed');
  assert.equal(ending.state.current_screen, 'title');
  assert.equal(ending.state.ending_completed, true);
  assert.equal(ending.transition.next_screen, 'title');
  assert.equal(ending.transition.loading_copy_key, 'graduation-ending-complete');

  await waitFor(async () => {
    const state = JSON.parse(await fs.readFile(runtimeStatePath, 'utf8'));
    assert.equal(state.global_flags['event.graduation_ending.completed'], true);
    assert.equal(state.current_screen, 'title');
  });
});

test('debug weeks endpoint updates elapsed weeks and clears graduation lifecycle state', async (t) => {
  const { root, base } = await withServer(t);

  await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const runtimeStatePath = path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json');
  const runtimeState = JSON.parse(await fs.readFile(runtimeStatePath, 'utf8'));
  Object.assign(runtimeState, {
    elapsed_weeks: 50,
    ending_started: true,
    ending_completed: true,
    ending_character_id: 'character_008',
    global_flags: {
      ...(runtimeState.global_flags ?? {}),
      'event.graduation_ending.ready': true,
      'event.graduation_ending.completed': true
    },
    event_flag_sources: {
      ...(runtimeState.event_flag_sources ?? {}),
      'event.graduation_ending.ready': { character_id: 'character_008' }
    },
    event_completion_sources: {
      ...(runtimeState.event_completion_sources ?? {}),
      'event.graduation_ending.completed': { source_type: 'test' }
    }
  });
  await fs.writeFile(runtimeStatePath, `${JSON.stringify(runtimeState, null, 2)}\n`, 'utf8');

  const updated = await jsonFetch(`${base}/api/debug/weeks`, {
    method: 'POST',
    body: { elapsed_weeks: 42 }
  });
  assert.equal(updated.state.elapsed_weeks, 42);
  assert.equal(updated.state.ending_started, false);
  assert.equal(updated.state.ending_completed, false);
  assert.equal(updated.state.ending_character_id, null);
  assert.equal(updated.state.global_flags['event.graduation_ending.ready'], false);
  assert.equal(updated.state.global_flags['event.graduation_ending.completed'], false);
});

test('slot deletion removes only the selected slot and keeps the others intact', async (t) => {
  const { root, base } = await withServer(t);

  const first = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotA = first.slot.slot_id;
  await fs.writeFile(path.join(root, 'game_data/play/slots', slotA, 'marker.txt'), 'slot-a', 'utf8');

  const second = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotB = second.slot.slot_id;
  await fs.writeFile(path.join(root, 'game_data/play/slots', slotB, 'marker.txt'), 'slot-b', 'utf8');

  const listedBefore = await jsonFetch(`${base}/api/slots`);
  assert.deepEqual(listedBefore.slots.map((slot) => slot.slot_id), [slotA, slotB]);

  const removed = await fetch(`${base}/api/slots/${slotB}`, { method: 'DELETE' });
  assert.equal(removed.ok, true);

  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots', slotB)));
  assert.equal(await fs.readFile(path.join(root, 'game_data/play/slots', slotA, 'marker.txt'), 'utf8'), 'slot-a');

  const listedAfter = await jsonFetch(`${base}/api/slots`);
  assert.deepEqual(listedAfter.slots.map((slot) => slot.slot_id), [slotA]);
});

test('slot note API updates only the targeted slot and returns the note in slot listings', async (t) => {
  const { root, base } = await withServer(t);

  const first = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotA = first.slot.slot_id;
  const second = await jsonFetch(`${base}/api/new-game`, { method: 'POST', body: {} });
  const slotB = second.slot.slot_id;

  const longBody = '風'.repeat(2105);
  const updated = await jsonFetch(`${base}/api/slots/${slotA}/note`, {
    method: 'PATCH',
    body: { player_note: `  中庭噴水 / バディー更新前\n${longBody}  ` }
  });
  const expected = `中庭噴水 / バディー更新前\n${longBody}`.slice(0, 2000);

  assert.equal(updated.slot.slot_id, slotA);
  assert.equal(updated.slot.player_note, expected);
  assert.equal(updated.slot.player_note.length, 2000);
  assert.equal(updated.active_slot_id, slotB, 'editing a note should not switch the active slot');

  const slotAMeta = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', slotA, 'meta.json'), 'utf8'));
  const slotBMeta = JSON.parse(await fs.readFile(path.join(root, 'game_data/play/slots', slotB, 'meta.json'), 'utf8'));
  assert.equal(slotAMeta.player_note, expected);
  assert.equal(slotBMeta.player_note ?? '', '');

  const listed = await jsonFetch(`${base}/api/slots`);
  assert.equal(listed.slots.find((slot) => slot.slot_id === slotA)?.player_note, expected);
  assert.equal(listed.slots.find((slot) => slot.slot_id === slotA)?.player_note.length, 2000);
  assert.equal(listed.slots.find((slot) => slot.slot_id === slotB)?.player_note ?? '', '');
});

test('slot APIs on split-root fixtures keep active_slot_id and slot loading under data/mutable play without consulting legacy game_data/play', async (t) => {
  const { root, base } = await withSplitServer(t);

  const listedBefore = await jsonFetch(`${base}/api/slots`);
  assert.equal(listedBefore.active_slot_id, 'slot_002');
  assert.deepEqual(listedBefore.slots.map((slot) => slot.slot_id), ['slot_001', 'slot_002']);

  const updated = await jsonFetch(`${base}/api/slots/slot_001/note`, {
    method: 'PATCH',
    body: { player_note: 'split root note' }
  });

  assert.equal(updated.slot.slot_id, 'slot_001');
  assert.equal(updated.slot.player_note, 'split root note');
  assert.equal(updated.active_slot_id, 'slot_002');

  const loaded = await jsonFetch(`${base}/api/slots/load`, {
    method: 'POST',
    body: { slot_id: 'slot_001' }
  });
  assert.equal(loaded.slot.slot_id, 'slot_001');
  assert.equal(loaded.state.current_screen, 'academy-room');

  const activeSlot = JSON.parse(await fs.readFile(path.join(root, 'data/mutable/game_data/play/active_slot.json'), 'utf8'));
  assert.equal(activeSlot.slot_id, 'slot_001');
  const slotMeta = JSON.parse(await fs.readFile(path.join(root, 'data/mutable/game_data/play/slots/slot_001/meta.json'), 'utf8'));
  assert.equal(slotMeta.player_note, 'split root note');

  await assert.rejects(fs.access(path.join(root, 'game_data/play/active_slot.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots/slot_001/meta.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json')), { code: 'ENOENT' });
});
