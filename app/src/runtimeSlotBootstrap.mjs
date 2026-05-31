import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createStorageApi } from './storage.mjs';
import { runtimePathsManifestFilename } from './runtimePaths.mjs';

export async function resetSlotGameDataRoot(targetRoot) {
  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(targetRoot, 'game_data'), { recursive: true });
}

export async function writeRuntimePathsManifest({ root, sourceRoot, mutableRoot }) {
  const sourcePaths = createStorageApi({ root: sourceRoot }).paths;
  const manifest = {
    configRoot: sourcePaths.configRoot,
    definitionsRoot: sourcePaths.definitionsRoot,
    seedsRoot: sourcePaths.seedsRoot,
    mutableRoot: path.resolve(mutableRoot),
    characterContentRoot: sourcePaths.characterContentRoot,
    canonicalAssetsRoot: sourcePaths.canonicalAssetsRoot,
    publicRoot: sourcePaths.publicRoot,
    resourceRoot: sourcePaths.resourceRoot
  };
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, runtimePathsManifestFilename), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function ensureCharacterMutableSurface({ root, characterId, flags, skills } = {}) {
  const runtimeStorage = createStorageApi({ root });
  const normalizedCharacterId = String(characterId ?? '').trim();
  if (!normalizedCharacterId) throw new Error('characterId is required');
  const base = path.join(runtimeStorage.paths.mutableRoot, 'characters', normalizedCharacterId);
  await fs.mkdir(base, { recursive: true });

  const existingFlags = await runtimeStorage.readJsonIfExists(`game_data/characters/${normalizedCharacterId}/flags.json`);
  const nextFlags = existingFlags ?? flags ?? { character_id: normalizedCharacterId, flags: {} };
  if (!existingFlags) await runtimeStorage.writeJson(`game_data/characters/${normalizedCharacterId}/flags.json`, nextFlags);

  const existingSkills = await runtimeStorage.readJsonIfExists(`game_data/characters/${normalizedCharacterId}/skills.json`);
  const nextSkills = existingSkills ?? skills ?? { character_id: normalizedCharacterId, skills: [] };
  if (!existingSkills) await runtimeStorage.writeJson(`game_data/characters/${normalizedCharacterId}/skills.json`, nextSkills);

  await fs.mkdir(path.join(base, 'memory'), { recursive: true });
  await fs.mkdir(path.join(base, 'work_records'), { recursive: true });
  return { flags: nextFlags, skills: nextSkills };
}
