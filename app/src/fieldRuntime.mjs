import { createStorageApi } from './storage.mjs';

function storageApiFor(rootOrStorage) {
  if (rootOrStorage && typeof rootOrStorage.readJson === 'function' && typeof rootOrStorage.writeJson === 'function') {
    return rootOrStorage;
  }
  return createStorageApi({ root: rootOrStorage });
}

async function readJson(rootOrStorage, relativePath) {
  return await storageApiFor(rootOrStorage).readJson(relativePath);
}

async function writeJson(rootOrStorage, relativePath, value) {
  await storageApiFor(rootOrStorage).writeJson(relativePath, value);
}


function readFlag(state, flag) {
  if (Object.prototype.hasOwnProperty.call(state.global_flags ?? {}, flag)) return state.global_flags[flag];
  for (const character of Object.values(state.characters ?? {})) {
    if (Object.prototype.hasOwnProperty.call(character.flags ?? {}, flag)) return character.flags[flag];
  }
  return undefined;
}

function conditionMatches(state, condition) {
  const actual = readFlag(state, condition.flag);
  if (condition.op === 'eq') return actual === condition.value;
  if (condition.op === 'neq') return actual !== condition.value;
  throw new Error(`unsupported location condition op: ${condition.op}`);
}

function conditionGroupMatches(state, group) {
  const all = group?.all ?? [];
  return all.every((condition) => conditionMatches(state, condition));
}

function evaluateHotspotForState({ state, hotspot }) {
  if (hotspot.visible_if && !conditionGroupMatches(state, hotspot.visible_if)) return null;
  const enabled = hotspot.enabled_if ? conditionGroupMatches(state, hotspot.enabled_if) : true;
  return {
    ...hotspot,
    disabled: !enabled,
    ...(enabled ? {} : { disabled_reason: hotspot.disabled_reason ?? 'まだ移動条件を満たしていません。' })
  };
}

function locationDescriptionVariants(location) {
  return Array.from(new Set([
    location.visible_situation,
    ...(location.visible_situation_variants ?? []),
    ...(location.description_variants ?? [])
  ].map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function applySelectedLocationSituation(location, state) {
  const selected = String(state.current_location_visible_situation ?? '').trim();
  if (!selected || location.id !== state.current_location_id) return location;
  if (!locationDescriptionVariants(location).includes(selected)) return location;
  return { ...location, visible_situation: selected };
}

export function evaluateLocationsForState({ state, locations }) {
  return locations
    .filter((location) => !location.screen || location.screen === 'field')
    .map((location) => ({
      ...applySelectedLocationSituation(location, state),
      hotspots: (location.hotspots ?? [])
        .map((hotspot) => evaluateHotspotForState({ state, hotspot }))
        .filter(Boolean)
    }));
}

export function resolveSelectedLocationSituation({ location, selectedVisibleSituation }) {
  const selected = String(selectedVisibleSituation ?? '').trim();
  if (!selected) return location.visible_situation ?? '';
  const variants = locationDescriptionVariants(location);
  if (!variants.includes(selected)) {
    throw new Error(`selectedVisibleSituation must match a description variant for ${location.id}`);
  }
  return selected;
}

export async function moveToLocation({ root, locationId, selectedVisibleSituation = null }) {
  if (!root) throw new Error('root is required');
  if (!locationId) throw new Error('locationId is required');

  const [state, locations] = await Promise.all([
    readJson(root, 'game_data/runtime_state.json'),
    readJson(root, 'game_data/locations.json')
  ]);
  const location = locations.find((item) => item.id === locationId);
  if (!location) throw new Error(`unknown location: ${locationId}`);
  if (location.screen && location.screen !== 'field') throw new Error(`location is not a field location: ${locationId}`);

  const currentLocationExists = locations.some((item) => item.id === state.current_location_id);
  if (!currentLocationExists) throw new Error(`unknown current location: ${state.current_location_id}`);
  const selectedSituation = resolveSelectedLocationSituation({ location, selectedVisibleSituation });

  const nextState = JSON.parse(JSON.stringify(state));
  nextState.current_location_id = location.id;
  nextState.current_location_visible_situation = selectedSituation;
  nextState.current_screen = 'field';
  nextState.current_interaction_character_id = null;
  nextState.pending_interaction_context = null;
  const visited = nextState.visited_locations ?? [];
  nextState.visited_locations = visited.includes(location.id) ? visited : [...visited, location.id];
  await writeJson(root, 'game_data/runtime_state.json', nextState);
  return { location: { ...location, visible_situation: selectedSituation }, state: nextState };
}
