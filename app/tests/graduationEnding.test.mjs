import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { setElapsedWeeksDebug, startNextAcademyWeek, selectGraduationEndingCharacterId } from '../src/graduationEnding.mjs';

async function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function splitGraduationRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-graduation-split-'));
  await writeJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    elapsed_weeks: 10,
    ending_started: true,
    ending_completed: true,
    ending_character_id: 'lina',
    current_screen: 'graduation-ending',
    global_flags: {
      'event.graduation_ending.ready': true,
      'event.graduation_ending.completed': true
    },
    event_flag_sources: {
      'event.graduation_ending.ready': { character_id: 'lina', source_type: 'graduation_ending', achieved_at: '2026-01-01T00:00:00.000Z' }
    },
    event_completion_sources: {
      'event.graduation_ending.completed': { character_id: 'lina', source_type: 'graduation_ending', achieved_at: '2026-01-01T00:00:00.000Z' }
    }
  });
  return root;
}

async function splitGraduationSelectionRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-graduation-select-'));
  await writeJson(root, 'content/characters/character_001/profile.json', {
    character_id: 'character_001',
    display_name: 'ひとりめ'
  });
  await writeJson(root, 'content/characters/character_002/profile.json', {
    character_id: 'character_002',
    display_name: 'ふたりめ'
  });
  await writeJson(root, 'data/mutable/game_data/characters/character_001/memory/2026-01-01.json', {
    id: 'm1',
    summary: 'older memory'
  });
  await writeJson(root, 'data/mutable/game_data/characters/character_002/memory/2026-01-01.json', {
    id: 'm2',
    summary: 'newer memory 1'
  });
  await writeJson(root, 'data/mutable/game_data/characters/character_002/memory/2026-01-02.json', {
    id: 'm3',
    summary: 'newer memory 2'
  });
  return root;
}

test('graduation ending character selection reads split content/mutable surfaces without consulting legacy game_data/characters', async (t) => {
  const root = await splitGraduationSelectionRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const selectedCharacterId = await selectGraduationEndingCharacterId(root);

  assert.equal(selectedCharacterId, 'character_002');
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/character_001/profile.json')), { code: 'ENOENT' });
});

test('graduationEnding debug/week progression reads and writes split mutable runtime state without creating legacy game_data files', async () => {
  const root = await splitGraduationRoot();

  const debugResult = await setElapsedWeeksDebug({ root, elapsedWeeks: 12 });
  assert.equal(debugResult.state.elapsed_weeks, 12);
  assert.equal(debugResult.state.ending_started, false);
  assert.equal(debugResult.state.global_flags['event.graduation_ending.ready'], false);

  const nextWeekResult = await startNextAcademyWeek({ root, now: '2026-05-18T02:00:00.000Z' });
  assert.equal(nextWeekResult.route, 'academy-training');
  assert.equal(nextWeekResult.state.elapsed_weeks, 13);
  assert.equal(nextWeekResult.state.current_screen, 'academy-training');

  const savedState = await readJson(root, 'data/mutable/game_data/runtime_state.json');
  assert.equal(savedState.elapsed_weeks, 13);
  assert.equal(savedState.current_screen, 'academy-training');
  assert.equal(savedState.ending_started, false);
  assert.equal(savedState.ending_completed, false);

  await assert.rejects(fs.access(path.join(root, 'game_data/runtime_state.json')), { code: 'ENOENT' });
});

test('startNextAcademyWeek enters graduation ending from active play root while initializing selectable storage from explicit authoring root', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-graduation-active-play-'));
  const playRoot = path.join(root, 'data/mutable/game_data/play');
  const mutableRoot = path.join(playRoot, 'slots/slot_001/game_data');
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(root, 'content/characters/character_001'), { recursive: true });
  await fs.copyFile(
    new URL('../../content/characters/character_001/profile.json', import.meta.url),
    path.join(root, 'content/characters/character_001/profile.json')
  );
  await writeJson(mutableRoot, 'runtime_state.json', {
    version: 1,
    elapsed_weeks: 49,
    ending_started: false,
    ending_completed: false,
    ending_character_id: null,
    current_screen: 'academy-room',
    global_flags: {},
    event_flag_sources: {},
    event_completion_sources: {},
    pending_interaction_context: null,
    current_interaction_character_id: null
  });
  await writeJson(playRoot, '.magic-academy-runtime-paths.json', {
    configRoot: path.join(root, 'app/config'),
    definitionsRoot: path.join(root, 'data/definitions/game_data'),
    seedsRoot: path.join(root, 'data/seeds/game_data'),
    mutableRoot,
    characterContentRoot: path.join(root, 'content/characters'),
    canonicalAssetsRoot: path.join(root, 'assets/canonical'),
    publicRoot: path.join(root, 'app/public'),
    resourceRoot: root
  });
  await fs.mkdir(path.join(root, 'data/definitions/game_data'), { recursive: true });
  await fs.copyFile(
    new URL('../../data/definitions/game_data/event_flags.json', import.meta.url),
    path.join(root, 'data/definitions/game_data/event_flags.json')
  );
  await fs.copyFile(
    new URL('../../data/definitions/game_data/locations.json', import.meta.url),
    path.join(root, 'data/definitions/game_data/locations.json')
  );

  const result = await startNextAcademyWeek({
    root: playRoot,
    authoringRoot: root,
    now: '2026-05-26T00:00:00.000Z'
  });

  assert.equal(result.route, 'graduation-ending');
  assert.equal(result.character_id, 'character_001');
  assert.equal(result.state.elapsed_weeks, 50);
  assert.equal(result.state.ending_started, true);
  assert.equal(result.state.ending_completed, false);
  assert.equal(result.state.ending_character_id, 'character_001');
  assert.equal(result.state.global_flags['event.graduation_ending.ready'], true);
  assert.equal(result.state.pending_interaction_context.event_flag_id, 'event.graduation_ending.ready');

  const savedState = await readJson(mutableRoot, 'runtime_state.json');
  assert.equal(savedState.ending_character_id, 'character_001');
  assert.equal(savedState.pending_interaction_context.event_flag_id, 'event.graduation_ending.ready');
  await assert.rejects(fs.access(path.join(root, 'data/mutable/characters/character_001/profile.json')), { code: 'ENOENT' });
});
