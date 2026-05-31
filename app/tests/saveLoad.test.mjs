import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStorageApi } from '../src/storage.mjs';
import { createSaveSlot, deleteSaveSlot, loadSaveSlot, listSaveSlots, updateSaveSlotNote } from '../src/saveLoad.mjs';
import { fixtureRoot, readJson } from './helpers.mjs';

async function writeSplitJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function splitSaveRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-save-split-'));
  await writeSplitJson(root, 'data/definitions/game_data/event_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/locations.json', [
    { id: 'herbology_garden', name: '薬草園', description: 'split save test location' }
  ]);
  await writeSplitJson(root, 'data/definitions/game_data/shop_catalog.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/stage_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/world/settings.json', {
    academy_name: '星灯魔法学院',
    player_name: '主人公',
    world_description: 'split save fixture',
    world_condition_texts: []
  });
  await writeSplitJson(root, 'data/seeds/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'field',
    global_flags: { 'story.archive_intro_done': false },
    characters: {}
  });
  await writeSplitJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'field',
    global_flags: { 'story.archive_intro_done': false },
    characters: {}
  });
  await writeSplitJson(root, 'data/mutable/game_data/player_inventory.json', { money: 0, items: [] });
  await writeSplitJson(root, 'data/mutable/game_data/runtime/player_parameters.json', {
    magic: { light: { min: 0, max: 100, label: '光魔法習熟度', value: 25 } },
    abilities: { strength: { min: 0, max: 100, label: '筋力', value: 25 } }
  });
  await writeSplitJson(root, 'content/characters/character_007/profile.json', {
    character_id: 'character_007',
    display_name: 'split save char',
    identity: 'split save identity',
    visual_set_id: 'visual_set_007',
    prompt_description: 'split save prompt',
    speaking_basis: 'split save speaking',
    available_expressions: ['neutral'],
    parameters: { magic: {}, abilities: {} }
  });
  return root;
}

async function saveFixtureRoot() {
  const root = await fixtureRoot('magic-adv-save-');
  await fs.rm(path.join(root, 'game_data/save_slots'), { recursive: true, force: true });
  return root;
}

test('createSaveSlot snapshots runtime and character flags without embedding conversation logs, and loadSaveSlot restores them', async () => {
  const root = await saveFixtureRoot();
  const saved = await createSaveSlot({ root, slotId: 'slot_001', label: '薬草園の異常前', now: '2026-05-05T06:00:00.000+09:00' });
  assert.equal(saved.slot_id, 'slot_001');
  assert.equal(saved.label, '薬草園の異常前');
  assert.equal(saved.snapshot.runtime_state.current_location_id, 'herbology_garden');
  assert.equal(saved.snapshot.logs_embedded, false);

  const state = await readJson(root, 'game_data/runtime_state.json');
  state.current_location_id = 'old_corridor';
  state.global_flags['story.archive_intro_done'] = true;
  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify(state, null, 2)}\n`);

  const restored = await loadSaveSlot({ root, slotId: 'slot_001' });
  assert.equal(restored.runtime_state.current_location_id, 'herbology_garden');
  assert.equal(restored.runtime_state.global_flags['story.archive_intro_done'], false);

  const slots = await listSaveSlots({ root });
  assert.deepEqual(slots.map((slot) => slot.slot_id), ['slot_001']);
});

test('updateSaveSlotNote stores one trimmed player note per slot without cross-slot leakage', async () => {
  const root = await saveFixtureRoot();
  await createSaveSlot({ root, slotId: 'slot_001', label: 'slot one', now: '2026-05-05T06:00:00.000+09:00' });
  await createSaveSlot({ root, slotId: 'slot_002', label: 'slot two', now: '2026-05-05T06:30:00.000+09:00' });

  const longBody = 'あ'.repeat(2105);
  const updated = await updateSaveSlotNote({
    root,
    slotId: 'slot_001',
    playerNote: `  図書塔前 / リナ会話前\n${longBody}  `,
    now: '2026-05-05T07:00:00.000+09:00'
  });
  const expected = `図書塔前 / リナ会話前\n${longBody}`.slice(0, 2000);

  assert.equal(updated.slot_id, 'slot_001');
  assert.equal(updated.player_note, expected);
  assert.equal(updated.player_note.length, 2000);
  assert.equal(updated.updated_at, '2026-05-05T07:00:00.000+09:00');

  const slotOneMeta = await readJson(root, 'game_data/play/slots/slot_001/meta.json');
  const slotTwoMeta = await readJson(root, 'game_data/play/slots/slot_002/meta.json');
  assert.equal(slotOneMeta.player_note, expected);
  assert.equal(slotTwoMeta.player_note ?? '', '');

  const slots = await listSaveSlots({ root });
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_001')?.player_note, expected);
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_001')?.player_note.length, 2000);
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_002')?.player_note ?? '', '');
});

test('listSaveSlots exposes graduation_completed from slot runtime state without disturbing other slot metadata', async () => {
  const root = await saveFixtureRoot();
  await createSaveSlot({ root, slotId: 'slot_001', label: 'graduated slot', now: '2026-05-05T06:00:00.000+09:00' });
  await createSaveSlot({ root, slotId: 'slot_002', label: 'active slot', now: '2026-05-05T06:30:00.000+09:00' });

  const slotOneState = await readJson(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json');
  slotOneState.ending_completed = true;
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json'), `${JSON.stringify(slotOneState, null, 2)}\n`);

  const slots = await listSaveSlots({ root });
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_001')?.graduation_completed, true);
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_002')?.graduation_completed, false);
  assert.equal(slots.find((slot) => slot.slot_id === 'slot_001')?.player_note ?? '', '');
});

test('listSaveSlots ignores orphan slots that have meta.json but no runtime state', async () => {
  const root = await saveFixtureRoot();
  await createSaveSlot({ root, slotId: 'slot_001', label: 'valid slot', now: '2026-05-05T06:00:00.000+09:00' });
  await fs.mkdir(path.join(root, 'game_data/play/slots/slot_002'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_002/meta.json'), `${JSON.stringify({
    slot_id: 'slot_002',
    label: 'orphan slot',
    created_at: '2026-05-05T06:05:00.000+09:00',
    updated_at: '2026-05-05T06:05:00.000+09:00',
    player_note: '',
    current_location_id: 'herbology_garden',
    current_screen: 'field'
  }, null, 2)}\n`);

  const slots = await listSaveSlots({ root });
  assert.deepEqual(slots.map((slot) => slot.slot_id), ['slot_001']);
});

test('listSaveSlots ignores malformed-meta and invalid-name slot directories instead of throwing', async () => {
  const root = await saveFixtureRoot();
  await createSaveSlot({ root, slotId: 'slot_001', label: 'valid slot', now: '2026-05-05T06:00:00.000+09:00' });
  await fs.mkdir(path.join(root, 'game_data/play/slots/not-a-slot/game_data'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots/not-a-slot/meta.json'), '{broken-json\n', 'utf8');
  await fs.mkdir(path.join(root, 'game_data/play/slots/slot_002/game_data'), { recursive: true });
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_002/game_data/runtime_state.json'), `${JSON.stringify({ graduation_completed: false }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'game_data/play/slots/slot_002/meta.json'), '{broken-json\n', 'utf8');

  const slots = await listSaveSlots({ root });
  assert.deepEqual(slots.map((slot) => slot.slot_id), ['slot_001']);
});

test('createSaveSlot snapshots split-root canonical surfaces into data/mutable play slots without creating legacy game_data/play', async (t) => {
  const root = await splitSaveRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const saved = await createSaveSlot({ root, slotId: 'slot_001', label: 'split canonical snapshot', now: '2026-05-05T06:00:00.000+09:00' });

  assert.equal(saved.slot_id, 'slot_001');
  assert.equal(saved.snapshot.runtime_state.current_location_id, 'herbology_garden');
  const slotState = await readJson(root, 'data/mutable/game_data/play/slots/slot_001/game_data/runtime_state.json');
  assert.equal(slotState.current_location_id, 'herbology_garden');
  const slotParameters = await readJson(root, 'data/mutable/game_data/play/slots/slot_001/game_data/runtime/player_parameters.json');
  assert.equal(slotParameters.magic.light.value, 25);
  const slotStorage = createStorageApi({ root: path.join(root, 'data/mutable/game_data/play/slots/slot_001') });
  const slotWorldSettings = await slotStorage.readJson('game_data/world/settings.json');
  assert.equal(slotWorldSettings.academy_name, '星灯魔法学院');

  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots/slot_001/game_data/runtime_state.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/play/active_slot.json')), { code: 'ENOENT' });
});

test('createSaveSlot succeeds without symlink privilege and still resolves canonical reads through storage', async (t) => {
  const root = await splitSaveRoot();
  const originalSymlink = fs.symlink;
  fs.symlink = async () => {
    const error = new Error('operation not permitted');
    error.code = 'EPERM';
    throw error;
  };
  t.after(async () => {
    fs.symlink = originalSymlink;
    await fs.rm(root, { recursive: true, force: true });
  });

  const saved = await createSaveSlot({ root, slotId: 'slot_001', label: 'non-privileged split slot', now: '2026-05-05T06:00:00.000+09:00' });
  const slotStorage = createStorageApi({ root: path.join(root, 'data/mutable/game_data/play/slots/slot_001') });

  assert.equal(saved.slot_id, 'slot_001');
  assert.equal(await slotStorage.resolveReadPath('game_data/world/settings.json'), path.join(root, 'data/definitions/game_data/world/settings.json'));
  assert.equal(await slotStorage.resolveReadPath('game_data/characters/character_007/profile.json'), path.join(root, 'content/characters/character_007/profile.json'));
  const runtimeState = await slotStorage.readJson('game_data/runtime_state.json');
  assert.equal(runtimeState.current_location_id, 'herbology_garden');
});

test('loadSaveSlot and split-root slot note updates stay under data/mutable play and do not recreate legacy game_data/play', async (t) => {
  const root = await splitSaveRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await createSaveSlot({ root, slotId: 'slot_001', label: 'split canonical snapshot', now: '2026-05-05T06:00:00.000+09:00' });
  await createSaveSlot({ root, slotId: 'slot_002', label: 'split second snapshot', now: '2026-05-05T06:10:00.000+09:00' });
  const updated = await updateSaveSlotNote({
    root,
    slotId: 'slot_001',
    playerNote: 'split root note',
    now: '2026-05-05T06:20:00.000+09:00'
  });
  assert.equal(updated.player_note, 'split root note');

  const slotTwoStorage = createStorageApi({ root: path.join(root, 'data/mutable/game_data/play/slots/slot_002') });
  assert.equal(
    await slotTwoStorage.resolveReadPath('game_data/runtime_state.json'),
    path.join(root, 'data/mutable/game_data/play/slots/slot_002/game_data/runtime_state.json')
  );

  const loaded = await loadSaveSlot({ root, slotId: 'slot_002' });
  assert.equal(loaded.slot.slot_id, 'slot_002');
  assert.equal(loaded.state.current_screen, 'academy-room');
  const activeSlot = await readJson(root, 'data/mutable/game_data/play/active_slot.json');
  assert.equal(activeSlot.slot_id, 'slot_002');

  const slotOneMeta = await readJson(root, 'data/mutable/game_data/play/slots/slot_001/meta.json');
  assert.equal(slotOneMeta.player_note, 'split root note');
  await assert.rejects(fs.access(path.join(root, 'game_data/play/active_slot.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots/slot_001/meta.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/play/slots/slot_002/game_data/runtime_state.json')), { code: 'ENOENT' });
});

test('deleteSaveSlot clears the active play-root manifest when deleting the active split-root slot', async (t) => {
  const root = await splitSaveRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await createSaveSlot({ root, slotId: 'slot_001', label: 'split canonical snapshot', now: '2026-05-05T06:00:00.000+09:00' });
  await loadSaveSlot({ root, slotId: 'slot_001' });

  const deleted = await deleteSaveSlot({ root, slotId: 'slot_001' });

  assert.equal(deleted.deleted_slot_id, 'slot_001');
  assert.equal(deleted.active_slot_id, null);
  await assert.rejects(fs.access(path.join(root, 'data/mutable/game_data/play/.magic-academy-runtime-paths.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'data/mutable/game_data/play/active_slot.json')), { code: 'ENOENT' });
});

test('save slot operations reject slot ids that are not in the allowed slot_* format', async () => {
  const root = await saveFixtureRoot();

  await assert.rejects(
    createSaveSlot({ root, slotId: '../escape', label: 'bad slot', now: '2026-05-05T06:00:00.000+09:00' }),
    /slot/i
  );

  await createSaveSlot({ root, slotId: 'slot_001', label: 'good slot', now: '2026-05-05T06:01:00.000+09:00' });

  await assert.rejects(
    loadSaveSlot({ root, slotId: 'slot_001/../../runtime_state' }),
    /slot/i
  );
  await assert.rejects(
    updateSaveSlotNote({ root, slotId: 'slot_001/../../runtime_state', playerNote: 'bad', now: '2026-05-05T06:02:00.000+09:00' }),
    /slot/i
  );
  await assert.rejects(
    deleteSaveSlot({ root, slotId: 'slot_001/../../runtime_state' }),
    /slot/i
  );
});
