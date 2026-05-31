import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createStorageApi } from './storage.mjs';
import { ensureCharacterMutableSurface, writeRuntimePathsManifest } from './runtimeSlotBootstrap.mjs';
import { runtimePathsManifestFilename } from './runtimePaths.mjs';
import { normalizeParameters } from './parameters.mjs';
import { faceExpressions } from './faceExpressions.mjs';

const characterCount = 50;
const visualRebuildVersion = 'visual-set-mbti-diverse-prompt-review-2026-05-07-v3';

const parameterAttitudeTypes = [
  'respect_any_superior',
  'equal_any_respect_average',
  'equal_average_respect_1_2',
  'equal_1_2_respect_1_5'
];

function pad(index) {
  return String(index).padStart(3, '0');
}

function characterIdForIndex(index) {
  return `character_${pad(index)}`;
}

function visualSetIdForIndex(index) {
  return `visual_set_${pad(index)}`;
}

function characterIndexFromId(characterId) {
  const match = /^character_(\d{3})$/.exec(String(characterId ?? '').trim());
  if (!match) throw new Error(`unknown selectable character: ${characterId}`);
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 1 || index > characterCount) throw new Error(`unknown selectable character: ${characterId}`);
  return index;
}

function publicCanonicalUrl(relativePath) {
  return `/canonical/${relativePath.split(path.sep).join('/')}`;
}

function publicCanonicalFaceUrl(visualSetId, expression = 'neutral') {
  return publicCanonicalUrl(`character_visual_sets/${visualSetId}/face_emotions/${expression}.png`);
}

function publicCanonicalSceneStandeeUrl(visualSetId, filename = 'scene_standee_character_05.png') {
  return publicCanonicalUrl(`character_visual_sets/${visualSetId}/scene_standee/${filename}`);
}

async function findSceneStandeeFilename({ root, visualSetId }) {
  const storage = createStorageApi({ root });
  const sceneStandeeDir = path.join(storage.paths.canonicalAssetsRoot, 'character_visual_sets', visualSetId, 'scene_standee');
  try {
    const entries = await fs.readdir(sceneStandeeDir);
    return entries.find((entry) => entry.endsWith('.png')) ?? 'scene_standee_character_05.png';
  } catch {
    return 'scene_standee_character_05.png';
  }
}

function sanitizePromptDescription(value, fallback) {
  const text = String(value ?? '').trim();
  if (!text || text.includes('undefined')) return fallback;
  return text
    .split('\n')
    .filter((line) => !line.includes('外見の基準'))
    .join('\n')
    .replace(/\s*外見の基準[:：].*$/s, '')
    .trim() || fallback;
}

function runtimeManagedProfileFields({ characterId, visualSetId, assetState }) {
  return {
    character_id: characterId,
    visual_set_id: visualSetId,
    source_image: `character_visual_sets/${visualSetId}/face_emotions/neutral.png`,
    asset_pack: 'assets_v5',
    visual_rebuild_version: visualRebuildVersion,
    available_expressions: faceExpressions,
    asset_state: {
      ...assetState,
      character_id: characterId,
      visual_set_id: visualSetId,
      expression: assetState?.expression ?? 'neutral',
      standee_variant_id: assetState?.standee_variant_id ?? 'standee_character_01',
      face_emotion_variant_id: assetState?.face_emotion_variant_id ?? 'face_neutral'
    }
  };
}

function validatedParameterAttitudeType(characterId, value) {
  const normalized = String(value ?? '').trim();
  if (!parameterAttitudeTypes.includes(normalized)) {
    throw new Error(`invalid parameter_attitude_type for ${characterId}: ${normalized || '(empty)'}`);
  }
  return normalized;
}

function normalizedCharacterParameters(characterId, parameters) {
  if (!parameters || typeof parameters !== 'object') {
    throw new Error(`missing parameters for ${characterId}`);
  }
  return normalizeParameters(parameters);
}

function normalizedSelectableCharacterProfile({ existingProfile, index }) {
  const characterId = characterIdForIndex(index);
  const visualSetId = visualSetIdForIndex(index);
  if (!existingProfile) {
    throw new Error(`missing selectable character profile: ${characterId}`);
  }
  const promptFallback = String(existingProfile.identity ?? '').trim();
  const speakingBasis = String(existingProfile.speaking_basis ?? '').trim();
  return {
    ...existingProfile,
    ...runtimeManagedProfileFields({
      characterId,
      visualSetId,
      assetState: existingProfile.asset_state
    }),
    prompt_description: sanitizePromptDescription(existingProfile.prompt_description, promptFallback),
    speaking_basis: speakingBasis,
    parameter_attitude_type: validatedParameterAttitudeType(characterId, existingProfile.parameter_attitude_type),
    parameters: normalizedCharacterParameters(characterId, existingProfile.parameters)
  };
}

async function loadSelectableCharacterProfile({ root, authoringRoot = root, index }) {
  const characterId = characterIdForIndex(index);
  const runtimeStorage = createStorageApi({ root });
  const authoringStorage = path.resolve(authoringRoot) === path.resolve(root)
    ? runtimeStorage
    : createStorageApi({ root: authoringRoot });
  const existingProfile = await runtimeStorage.readJsonIfExists(`game_data/characters/${characterId}/profile.json`)
    ?? await authoringStorage.readJsonIfExists(`game_data/characters/${characterId}/profile.json`);
  return normalizedSelectableCharacterProfile({ existingProfile, index });
}

async function ensureCharacterStorage({ root, authoringRoot = root, index }) {
  const characterId = characterIdForIndex(index);
  if (path.resolve(root) !== path.resolve(authoringRoot)) {
    const manifestPath = path.join(root, runtimePathsManifestFilename);
    const hasRuntimeManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
    if (!hasRuntimeManifest) {
      await fs.mkdir(path.join(root, 'game_data'), { recursive: true });
      await writeRuntimePathsManifest({ root, sourceRoot: authoringRoot, mutableRoot: path.join(root, 'game_data') });
    }
  }
  const runtimeStorage = createStorageApi({ root });
  const authoringStorage = path.resolve(authoringRoot) === path.resolve(root)
    ? runtimeStorage
    : createStorageApi({ root: authoringRoot });
  const existingProfile = await authoringStorage.readJsonIfExists(`game_data/characters/${characterId}/profile.json`);
  const profile = normalizedSelectableCharacterProfile({ existingProfile, index });

  const { flags, skills } = await ensureCharacterMutableSurface({ root, characterId });
  return { profile, flags, skills };
}

function buddyFlagId(characterId) {
  return `relationship.${characterId}.buddy`;
}

function enemyFlagId(characterId) {
  return `relationship.${characterId}.enemy`;
}

function currentBuddyCharacterIdFromState(state) {
  const explicit = String(state?.current_buddy_character_id ?? '').trim();
  return explicit || null;
}

function currentEnemyCharacterIdsFromState(state) {
  return new Set((Array.isArray(state?.current_enemy_character_ids) ? state.current_enemy_character_ids : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean));
}

function characterSummary({ profile, currentBuddyCharacterId, currentEnemyCharacterIds, index, sceneStandeeFilename }) {
  const visualSetId = profile.visual_set_id ?? visualSetIdForIndex(index);
  const isBuddy = profile.character_id === currentBuddyCharacterId;
  const isEnemy = currentEnemyCharacterIds.has(profile.character_id);
  const buddyFlags = isBuddy ? [buddyFlagId(profile.character_id)] : [];
  const enemyFlags = isEnemy ? [enemyFlagId(profile.character_id)] : [];
  return {
    character_id: profile.character_id,
    display_name: profile.display_name,
    school_year: profile.school_year,
    club: profile.club,
    identity: profile.identity,
    speaking_basis: profile.speaking_basis,
    prompt_description: sanitizePromptDescription(profile.prompt_description, profile.identity ?? ''),
    parameter_attitude_type: validatedParameterAttitudeType(profile.character_id, profile.parameter_attitude_type),
    parameters: normalizedCharacterParameters(profile.character_id, profile.parameters),
    visual_set_id: visualSetId,
    identity_notes: '',
    is_buddy: buddyFlags.length > 0,
    buddy_flags: buddyFlags,
    is_enemy: enemyFlags.length > 0,
    enemy_flags: enemyFlags,
    available_expressions: Array.isArray(profile.available_expressions) ? profile.available_expressions : faceExpressions,
    asset_pack: 'assets_v5',
    source_image_url: publicCanonicalFaceUrl(visualSetId, 'neutral'),
    standee_url: publicCanonicalSceneStandeeUrl(visualSetId, sceneStandeeFilename),
    face_url: publicCanonicalFaceUrl(visualSetId, 'neutral'),
    selection_icon_url: publicCanonicalFaceUrl(visualSetId, 'neutral')
  };
}

export async function listSelectableCharacters({ root, authoringRoot = root } = {}) {
  const runtimeStorage = createStorageApi({ root });
  const state = await runtimeStorage.readJsonIfExists('game_data/runtime_state.json');
  const currentBuddyCharacterId = currentBuddyCharacterIdFromState(state);
  const currentEnemyCharacterIds = currentEnemyCharacterIdsFromState(state);
  const characters = [];
  for (let index = 1; index <= characterCount; index += 1) {
    const visualSetId = visualSetIdForIndex(index);
    const profile = await loadSelectableCharacterProfile({ root, authoringRoot, index });
    const sceneStandeeFilename = await findSceneStandeeFilename({ root, visualSetId });
    characters.push(characterSummary({ profile, currentBuddyCharacterId, currentEnemyCharacterIds, index, sceneStandeeFilename }));
  }
  return characters;
}

export async function ensureSelectableCharacterStorage({ root, authoringRoot = root, characterId }) {
  return await ensureCharacterStorage({ root, authoringRoot, index: characterIndexFromId(characterId) });
}

export async function updateCharacterProfileText({ root, characterId, promptDescription, speakingBasis }) {
  const { profile } = await ensureSelectableCharacterStorage({ root, characterId });
  const storage = createStorageApi({ root });
  const nextProfile = {
    ...profile,
    visual_rebuild_version: visualRebuildVersion,
    available_expressions: faceExpressions,
    prompt_description: sanitizePromptDescription(promptDescription, profile.identity ?? ''),
    speaking_basis: String(speakingBasis ?? profile.speaking_basis ?? '').trim(),
    parameters: normalizedCharacterParameters(characterId, profile.parameters)
  };
  await storage.writeJson(`game_data/characters/${characterId}/profile.json`, nextProfile);
  return nextProfile;
}

export async function updateCharacterPromptDescription({ root, characterId, promptDescription }) {
  return updateCharacterProfileText({ root, characterId, promptDescription });
}
