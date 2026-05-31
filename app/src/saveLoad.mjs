import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createStorageApi } from './storage.mjs';
import { runtimePathsManifestFilename } from './runtimePaths.mjs';
import { ensureCharacterMutableSurface, resetSlotGameDataRoot, writeRuntimePathsManifest } from './runtimeSlotBootstrap.mjs';
import {
  initializeNewPlayArea,
  isValidSlot,
  listValidSlotIds,
  readActiveSlot,
  readValidActiveSlotId,
  readSlotMeta,
  refreshSlotMetaFromRuntime,
  resolvePlayRoot,
  resolveSlotProjectRoot,
  setActiveSlot,
  writeSlotMeta
} from './playSession.mjs';

async function readJson(fullPath) {
  return JSON.parse(await fs.readFile(fullPath, 'utf8'));
}

async function writeJson(fullPath, value) {
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const SAVE_SLOT_NOTE_MAX_LENGTH = 2000;

function normalizeSaveSlotPlayerNote(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, SAVE_SLOT_NOTE_MAX_LENGTH);
}

function slotLabelFor(slotId) {
  return slotId.replaceAll('_', ' ');
}

function activeGameDataLink(root) {
  return path.join(resolvePlayRoot(root), 'game_data');
}

function activeSlotFile(root) {
  return path.join(resolvePlayRoot(root), 'active_slot.json');
}

async function activeSlotId(root) {
  const active = await readActiveSlot(root);
  return String(active?.slot_id ?? '').trim() || null;
}

async function activeSlotRoot(root) {
  const slotId = await activeSlotId(root);
  return slotId ? resolveSlotProjectRoot(root, slotId) : null;
}

async function cloneDirectory(sourcePath, targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false, verbatimSymlinks: true });
}

async function cloneCanonicalCharacterDataToSlotRoot(root, targetRoot) {
  const storage = createStorageApi({ root });
  const sourceCharactersRoot = storage.paths.characterContentRoot;
  const sourceMutableCharactersRoot = path.join(storage.paths.mutableRoot, 'characters');
  const entries = await fs.readdir(sourceCharactersRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourceCharacterDir = path.join(sourceCharactersRoot, entry.name);
    const profilePath = path.join(sourceCharacterDir, 'profile.json');
    if (!(await pathExists(profilePath))) continue;
    const mutableCharacterDir = path.join(sourceMutableCharactersRoot, entry.name);
    const targetCharacterDir = path.join(targetRoot, 'game_data/characters', entry.name);
    await ensureCharacterMutableSurface({ root: targetRoot, characterId: entry.name });

    for (const filename of ['skills.json', 'flags.json']) {
      const sourcePath = path.join(mutableCharacterDir, filename);
      if (await pathExists(sourcePath)) {
        await fs.cp(sourcePath, path.join(targetCharacterDir, filename), { force: true, verbatimSymlinks: true });
      }
    }

    for (const dirname of ['memory', 'work_records']) {
      const sourcePath = path.join(mutableCharacterDir, dirname);
      if (await pathExists(sourcePath)) {
        await fs.cp(sourcePath, path.join(targetCharacterDir, dirname), { recursive: true, force: true, verbatimSymlinks: true });
      }
    }
  }
}

async function cloneCanonicalGameDataToSlotRoot(root, targetRoot) {
  const storage = createStorageApi({ root });
  const targetGameDataRoot = path.join(targetRoot, 'game_data');
  await resetSlotGameDataRoot(targetRoot);
  await writeRuntimePathsManifest({ root: targetRoot, sourceRoot: root, mutableRoot: targetGameDataRoot });

  for (const relativePath of ['game_data/runtime_state.json', 'game_data/player_inventory.json', 'game_data/runtime/player_parameters.json']) {
    const value = await storage.readJsonIfExists(relativePath);
    if (value != null) await writeJson(path.join(targetRoot, relativePath), value);
  }

  const logsSource = path.join(storage.paths.mutableRoot, 'logs');
  if (await pathExists(logsSource)) {
    await fs.cp(logsSource, path.join(targetGameDataRoot, 'logs'), { recursive: true, force: true, verbatimSymlinks: true });
  }

  await cloneCanonicalCharacterDataToSlotRoot(root, targetRoot);
}

async function readRuntimeStateForSlot(root, slotId) {
  return await readJson(path.join(resolveSlotProjectRoot(root, slotId), 'game_data/runtime_state.json'));
}

async function updateRuntimeStateForSlot(root, slotId, updater) {
  const statePath = path.join(resolveSlotProjectRoot(root, slotId), 'game_data/runtime_state.json');
  const current = await readJson(statePath);
  const next = updater(current);
  await writeJson(statePath, next);
  return next;
}

function slotSummary(meta) {
  return {
    slot_id: meta.slot_id,
    label: meta.label,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    player_note: meta.player_note ?? '',
    current_location_id: meta.current_location_id ?? null,
    current_screen: meta.current_screen ?? null,
    graduation_completed: meta.graduation_completed === true
  };
}

async function readGraduationCompletedForSlot(root, slotId) {
  const state = await readRuntimeStateForSlot(root, slotId).catch(() => null);
  return state?.ending_completed === true;
}

function invalidSlotError(slotId) {
  const error = new Error(`invalid slot: ${slotId}`);
  error.code = 'INVALID_SLOT';
  error.errorCode = 'invalid_slot';
  error.statusCode = 400;
  return error;
}

async function assertSlotCanBeLoaded(root, slotId) {
  if (!(await isValidSlot(root, slotId))) throw invalidSlotError(slotId);
  if (await readGraduationCompletedForSlot(root, slotId)) {
    const error = new Error('graduation_completed: slot is already graduated');
    error.code = 'GRADUATION_COMPLETED';
    throw error;
  }
}

export async function createSaveSlot({ root, slotId, label, now = new Date().toISOString() }) {
  if (!root) throw new Error('root is required');
  if (!slotId) throw new Error('slotId is required');

  const sourceRoot = await activeSlotRoot(root);

  const targetRoot = resolveSlotProjectRoot(root, slotId);
  if (await pathExists(targetRoot)) throw new Error(`slot already exists: ${slotId}`);
  if (sourceRoot) {
    await cloneDirectory(sourceRoot, targetRoot);
    await writeRuntimePathsManifest({ root: targetRoot, sourceRoot: root, mutableRoot: path.join(targetRoot, 'game_data') });
  } else await cloneCanonicalGameDataToSlotRoot(root, targetRoot);
  const state = await readJson(path.join(targetRoot, 'game_data/runtime_state.json'));
  const meta = {
    slot_id: slotId,
    label: label ?? slotLabelFor(slotId),
    created_at: now,
    updated_at: now,
    player_note: '',
    current_location_id: state.current_location_id ?? null,
    current_screen: state.current_screen ?? null
  };
  await writeSlotMeta(root, slotId, meta);
  return {
    slot_id: slotId,
    label: meta.label,
    created_at: meta.created_at,
    snapshot: {
      runtime_state: state,
      logs_embedded: false
    },
    slot: meta,
    state
  };
}

export async function loadSaveSlot({ root, slotId, postLoadScreen = 'academy-room' }) {
  if (!root) throw new Error('root is required');
  if (!slotId) throw new Error('slotId is required');
  await assertSlotCanBeLoaded(root, slotId);

  const state = await updateRuntimeStateForSlot(root, slotId, (current) => ({
    ...current,
    current_screen: postLoadScreen,
    current_interaction_character_id: null,
    pending_interaction_context: null
  }));
  await setActiveSlot(root, slotId);
  const meta = await refreshSlotMetaFromRuntime(root, slotId);
  return {
    slot: meta,
    state,
    runtime_state: state,
    root: resolvePlayRoot(root)
  };
}

export async function listSaveSlots({ root }) {
  if (!root) throw new Error('root is required');
  const slots = [];
  for (const slotId of await listValidSlotIds(root)) {
    const meta = await readSlotMeta(root, slotId);
    if (!meta) continue;
    slots.push(slotSummary({
      ...meta,
      graduation_completed: await readGraduationCompletedForSlot(root, slotId)
    }));
  }
  slots.sort((a, b) => {
    const left = `${a.created_at ?? ''}:${a.slot_id}`;
    const right = `${b.created_at ?? ''}:${b.slot_id}`;
    return left.localeCompare(right);
  });
  return slots;
}

export async function describeSaveSlots({ root }) {
  if (!root) throw new Error('root is required');
  return {
    slots: await listSaveSlots({ root }),
    active_slot_id: await readValidActiveSlotId(root)
  };
}

export async function updateSaveSlotNote({ root, slotId, playerNote, now = new Date().toISOString() }) {
  if (!root) throw new Error('root is required');
  if (!slotId) throw new Error('slotId is required');
  if (!(await isValidSlot(root, slotId))) throw invalidSlotError(slotId);
  const existingMeta = await readSlotMeta(root, slotId) ?? await refreshSlotMetaFromRuntime(root, slotId);
  const nextMeta = {
    ...existingMeta,
    slot_id: slotId,
    label: existingMeta?.label ?? slotLabelFor(slotId),
    created_at: existingMeta?.created_at ?? now,
    updated_at: now,
    player_note: normalizeSaveSlotPlayerNote(playerNote)
  };
  await writeSlotMeta(root, slotId, nextMeta);
  return slotSummary(nextMeta);
}

export async function deleteSaveSlot({ root, slotId }) {
  if (!root) throw new Error('root is required');
  if (!slotId) throw new Error('slotId is required');
  if (!(await isValidSlot(root, slotId))) throw invalidSlotError(slotId);
  const slotRoot = resolveSlotProjectRoot(root, slotId);
  const activeId = await readValidActiveSlotId(root);
  await fs.rm(slotRoot, { recursive: true, force: true });

  if (activeId === slotId) {
    await fs.rm(activeGameDataLink(root), { recursive: true, force: true });
    await fs.rm(path.join(resolvePlayRoot(root), runtimePathsManifestFilename), { force: true });
    await fs.rm(activeSlotFile(root), { force: true });
  }

  return {
    deleted_slot_id: slotId,
    active_slot_id: activeId === slotId ? null : activeId,
    slots: await listSaveSlots({ root })
  };
}
