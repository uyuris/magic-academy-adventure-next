import { createStorageApi } from './storage.mjs';

async function readJson(storage, relativePath) {
  return storage.readJson(relativePath);
}

async function writeJson(storage, relativePath, value) {
  await storage.writeJson(relativePath, value);
}

async function readJsonIfExists(storage, relativePath) {
  return storage.readJsonIfExists(relativePath);
}

function cleanCharacterId(value) {
  const id = String(value ?? '').trim();
  return id || null;
}

function uniqueCharacterIds(values = []) {
  const ids = [];
  for (const value of values) {
    const id = cleanCharacterId(value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function buddyFlagId(characterId) {
  return `relationship.${characterId}.buddy`;
}

function enemyFlagId(characterId) {
  return `relationship.${characterId}.enemy`;
}

function setRuntimeCharacterFlag(state, characterId, flagId, value) {
  state.characters ??= {};
  state.characters[characterId] ??= { flags: {} };
  state.characters[characterId].flags ??= {};
  state.characters[characterId].flags[flagId] = value;
}

async function setCharacterFileFlag(storage, characterId, flagId, value) {
  const relativePath = `game_data/characters/${characterId}/flags.json`;
  const current = await readJsonIfExists(storage, relativePath) ?? { character_id: characterId, flags: {} };
  current.character_id ??= characterId;
  current.flags ??= {};
  current.flags[flagId] = value;
  await writeJson(storage, relativePath, current);
}

export async function setRelationshipDebugState({ root, buddyCharacterId = null, enemyCharacterIds = [] }) {
  const storage = createStorageApi({ root });
  const state = await readJson(storage, 'game_data/runtime_state.json');
  const nextBuddyCharacterId = cleanCharacterId(buddyCharacterId);
  const nextEnemyCharacterIds = uniqueCharacterIds(enemyCharacterIds);
  const previousBuddyIds = uniqueCharacterIds([
    state.current_buddy_character_id,
    ...Object.entries(state.characters ?? {})
      .filter(([characterId, entry]) => entry?.flags?.[buddyFlagId(characterId)] === true)
      .map(([characterId]) => characterId)
  ]);
  const previousEnemyIds = uniqueCharacterIds([
    ...(Array.isArray(state.current_enemy_character_ids) ? state.current_enemy_character_ids : []),
    ...Object.entries(state.characters ?? {})
      .filter(([characterId, entry]) => entry?.flags?.[enemyFlagId(characterId)] === true)
      .map(([characterId]) => characterId)
  ]);

  const buddyTouchedIds = uniqueCharacterIds([...previousBuddyIds, nextBuddyCharacterId]);
  const enemyTouchedIds = uniqueCharacterIds([...previousEnemyIds, ...nextEnemyCharacterIds]);
  for (const characterId of buddyTouchedIds) {
    setRuntimeCharacterFlag(state, characterId, buddyFlagId(characterId), characterId === nextBuddyCharacterId);
  }
  for (const characterId of enemyTouchedIds) {
    setRuntimeCharacterFlag(state, characterId, enemyFlagId(characterId), nextEnemyCharacterIds.includes(characterId));
  }
  state.current_buddy_character_id = nextBuddyCharacterId;
  state.current_enemy_character_ids = nextEnemyCharacterIds;

  await writeJson(storage, 'game_data/runtime_state.json', state);
  for (const characterId of uniqueCharacterIds([...buddyTouchedIds, ...enemyTouchedIds])) {
    await setCharacterFileFlag(storage, characterId, buddyFlagId(characterId), characterId === nextBuddyCharacterId);
    await setCharacterFileFlag(storage, characterId, enemyFlagId(characterId), nextEnemyCharacterIds.includes(characterId));
  }

  return {
    state,
    relationship: {
      current_buddy_character_id: state.current_buddy_character_id,
      current_enemy_character_ids: state.current_enemy_character_ids
    }
  };
}
