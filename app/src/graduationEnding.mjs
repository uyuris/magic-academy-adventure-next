import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createStorageApi } from './storage.mjs';
import { startEventFlagInteraction } from './eventFlags.mjs';
import { ensureSelectableCharacterStorage } from './characterCatalog.mjs';

export const GRADUATION_ENDING_FLAG_ID = 'event.graduation_ending.ready';
export const GRADUATION_ENDING_COMPLETED_FLAG_ID = 'event.graduation_ending.completed';
export const GRADUATION_ENDING_WEEK = 50;

function storageApiFor(rootOrStorage) {
  if (rootOrStorage && typeof rootOrStorage.readJson === 'function' && typeof rootOrStorage.writeJson === 'function') {
    return rootOrStorage;
  }
  return createStorageApi({ root: rootOrStorage });
}

async function readRuntimeState(rootOrStorage) {
  return await storageApiFor(rootOrStorage).readJson('game_data/runtime_state.json');
}

async function writeRuntimeState(rootOrStorage, state) {
  await storageApiFor(rootOrStorage).writeJson('game_data/runtime_state.json', state);
}

function normalizeWeekCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeGraduationState(state) {
  return {
    ...state,
    elapsed_weeks: normalizeWeekCount(state?.elapsed_weeks),
    ending_started: state?.ending_started === true,
    ending_completed: state?.ending_completed === true,
    ending_character_id: state?.ending_character_id ?? null,
    global_flags: { ...(state?.global_flags ?? {}) },
    event_flag_sources: { ...(state?.event_flag_sources ?? {}) },
    event_completion_sources: { ...(state?.event_completion_sources ?? {}) }
  };
}

async function characterIdsWithProfiles(root) {
  const storage = createStorageApi({ root });
  const charactersDir = storage.paths.characterContentRoot;
  const entries = await fs.readdir(charactersDir, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const characterIds = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/^character_\d{3}$/.test(entry.name)) continue;
    characterIds.push(entry.name);
  }
  return characterIds.sort();
}

async function summarizeCharacterMemory(root, characterId) {
  const storage = createStorageApi({ root });
  const memoryDir = await storage.resolveReadPath(`game_data/characters/${characterId}/memory`);
  try {
    const names = (await fs.readdir(memoryDir)).filter((name) => name.endsWith('.json')).sort();
    let latestMtimeMs = 0;
    for (const name of names) {
      const stat = await fs.stat(path.join(memoryDir, name));
      latestMtimeMs = Math.max(latestMtimeMs, stat.mtimeMs);
    }
    return { characterId, count: names.length, latestMtimeMs };
  } catch (error) {
    if (error?.code === 'ENOENT') return { characterId, count: 0, latestMtimeMs: 0 };
    throw error;
  }
}

export async function selectGraduationEndingCharacterId(root) {
  const characterIds = await characterIdsWithProfiles(root);
  if (characterIds.length === 0) return null;
  const summaries = await Promise.all(characterIds.map((characterId) => summarizeCharacterMemory(root, characterId)));
  summaries.sort((left, right) => (
    right.count - left.count
    || right.latestMtimeMs - left.latestMtimeMs
    || left.characterId.localeCompare(right.characterId)
  ));
  return summaries[0]?.characterId ?? null;
}

function clearGraduationFlags(state) {
  state.global_flags[GRADUATION_ENDING_FLAG_ID] = false;
  state.global_flags[GRADUATION_ENDING_COMPLETED_FLAG_ID] = false;
  delete state.event_flag_sources[GRADUATION_ENDING_FLAG_ID];
  delete state.event_completion_sources[GRADUATION_ENDING_COMPLETED_FLAG_ID];
}

export async function setElapsedWeeksDebug({ root, elapsedWeeks }) {
  const state = normalizeGraduationState(await readRuntimeState(root));
  state.elapsed_weeks = normalizeWeekCount(elapsedWeeks);
  state.ending_started = false;
  state.ending_completed = false;
  state.ending_character_id = null;
  clearGraduationFlags(state);
  await writeRuntimeState(root, state);
  return { state };
}

export async function startNextAcademyWeek({ root, authoringRoot = root, now = new Date().toISOString() }) {
  let state = normalizeGraduationState(await readRuntimeState(root));
  state.elapsed_weeks += 1;

  if (state.elapsed_weeks < GRADUATION_ENDING_WEEK || state.ending_completed) {
    state.current_screen = 'academy-training';
    await writeRuntimeState(root, state);
    return { route: 'academy-training', state };
  }

  const characterId = state.ending_character_id ?? await selectGraduationEndingCharacterId(root);
  if (!characterId) {
    state.current_screen = 'academy-training';
    await writeRuntimeState(root, state);
    return { route: 'academy-training', state, fallback_reason: 'missing_character_profile' };
  }

  await ensureSelectableCharacterStorage({
    root,
    authoringRoot,
    characterId
  });

  state.ending_started = true;
  state.ending_completed = false;
  state.ending_character_id = characterId;
  state.global_flags[GRADUATION_ENDING_FLAG_ID] = true;
  state.global_flags[GRADUATION_ENDING_COMPLETED_FLAG_ID] = false;
  state.event_flag_sources[GRADUATION_ENDING_FLAG_ID] = {
    character_id: characterId,
    source_type: 'graduation_ending',
    achieved_at: now
  };
  delete state.event_completion_sources[GRADUATION_ENDING_COMPLETED_FLAG_ID];
  await writeRuntimeState(root, state);

  const started = await startEventFlagInteraction({
    root,
    flagId: GRADUATION_ENDING_FLAG_ID,
    screen: 'academy-conversation-session'
  });
  const nextState = normalizeGraduationState(started.state);
  nextState.elapsed_weeks = state.elapsed_weeks;
  nextState.ending_started = true;
  nextState.ending_completed = false;
  nextState.ending_character_id = characterId;
  nextState.global_flags[GRADUATION_ENDING_COMPLETED_FLAG_ID] = false;
  await writeRuntimeState(root, nextState);
  return {
    route: 'graduation-ending',
    character_id: characterId,
    ...started,
    state: nextState
  };
}

export function isGraduationEndingContext(state, conversation) {
  const pendingFlagId = state?.pending_interaction_context?.event_flag_id ?? null;
  const conversationFlagId = conversation?.event_flag_id ?? null;
  return pendingFlagId === GRADUATION_ENDING_FLAG_ID || conversationFlagId === GRADUATION_ENDING_FLAG_ID;
}

export function markGraduationEndingComplete(state) {
  const nextState = normalizeGraduationState(state);
  nextState.ending_started = true;
  nextState.ending_completed = true;
  nextState.current_screen = 'title';
  nextState.global_flags[GRADUATION_ENDING_COMPLETED_FLAG_ID] = true;
  return nextState;
}
