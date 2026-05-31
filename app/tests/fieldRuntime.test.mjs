import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { moveToLocation } from '../src/fieldRuntime.mjs';

async function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function splitFieldRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-field-split-'));
  await writeJson(root, 'data/definitions/game_data/locations.json', [
    {
      id: 'herbology_garden',
      screen: 'field',
      visible_situation: '庭にいる。',
      visible_situation_variants: ['庭にいる。', '夕方の庭にいる。'],
      hotspots: []
    },
    {
      id: 'front_gate_morning',
      screen: 'field',
      visible_situation: '門前にいる。',
      visible_situation_variants: ['門前にいる。', '朝の門前にいる。'],
      hotspots: []
    }
  ]);
  await writeJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'academy-map',
    visited_locations: ['herbology_garden'],
    global_flags: {},
    characters: {}
  });
  return root;
}

test('moveToLocation reads split locations/runtime state and writes mutable runtime state without creating legacy game_data files', async () => {
  const root = await splitFieldRoot();

  const result = await moveToLocation({ root, locationId: 'front_gate_morning', selectedVisibleSituation: '朝の門前にいる。' });

  assert.equal(result.location.id, 'front_gate_morning');
  assert.equal(result.location.visible_situation, '朝の門前にいる。');
  assert.equal(result.state.current_location_id, 'front_gate_morning');

  const savedState = await readJson(root, 'data/mutable/game_data/runtime_state.json');
  assert.equal(savedState.current_location_id, 'front_gate_morning');
  assert.equal(savedState.current_location_visible_situation, '朝の門前にいる。');
  assert.equal(savedState.visited_locations.includes('front_gate_morning'), true);

  await assert.rejects(fs.access(path.join(root, 'game_data/runtime_state.json')), { code: 'ENOENT' });
});
