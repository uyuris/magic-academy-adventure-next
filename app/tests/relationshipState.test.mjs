import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { setRelationshipDebugState } from '../src/relationshipState.mjs';

async function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function createSplitRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-relationship-state-'));
  await writeJson(root, 'data/seeds/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'field',
    current_interaction_character_id: null,
    current_buddy_character_id: 'lina',
    current_enemy_character_ids: ['aria'],
    characters: {
      lina: { flags: { 'relationship.lina.buddy': true } },
      aria: { flags: { 'relationship.aria.enemy': true } }
    }
  });
  await writeJson(root, 'data/mutable/game_data/characters/lina/flags.json', {
    character_id: 'lina',
    flags: { 'relationship.lina.buddy': true }
  });
  await writeJson(root, 'data/mutable/game_data/characters/aria/flags.json', {
    character_id: 'aria',
    flags: { 'relationship.aria.enemy': true }
  });
  return root;
}

test('setRelationshipDebugState updates split runtime state and mutable character flag files in the migrated layout', async (t) => {
  const root = await createSplitRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const result = await setRelationshipDebugState({
    root,
    buddyCharacterId: 'aria',
    enemyCharacterIds: ['lina']
  });

  assert.equal(result.relationship.current_buddy_character_id, 'aria');
  assert.deepEqual(result.relationship.current_enemy_character_ids, ['lina']);

  const runtimeState = await readJson(root, 'data/mutable/game_data/runtime_state.json');
  const linaFlags = await readJson(root, 'data/mutable/game_data/characters/lina/flags.json');
  const ariaFlags = await readJson(root, 'data/mutable/game_data/characters/aria/flags.json');

  assert.equal(runtimeState.current_buddy_character_id, 'aria');
  assert.deepEqual(runtimeState.current_enemy_character_ids, ['lina']);
  assert.equal(linaFlags.flags['relationship.lina.buddy'], false);
  assert.equal(linaFlags.flags['relationship.lina.enemy'], true);
  assert.equal(ariaFlags.flags['relationship.aria.buddy'], true);
  assert.equal(ariaFlags.flags['relationship.aria.enemy'], false);

  await assert.rejects(fs.access(path.join(root, 'game_data/runtime_state.json')), { code: 'ENOENT' });
});
