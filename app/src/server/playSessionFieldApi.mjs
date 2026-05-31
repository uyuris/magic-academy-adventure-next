import { evaluateLocationsForState, moveToLocation } from '../fieldRuntime.mjs';
import { initializeNewPlayArea } from '../playSession.mjs';
import { createStorageApi } from '../storage.mjs';

function storageFor(root) {
  return createStorageApi({ root });
}

async function readJson(root, relativePath) {
  return storageFor(root).readJson(relativePath);
}

function sendNoActiveSlot(res, sendJson) {
  return sendJson(res, {
    error: 'No active save slot is available. Start a new game or load a valid save slot.',
    error_code: 'NO_ACTIVE_SLOT'
  }, 409);
}

export function canHandlePlaySessionFieldApiRoute(method, pathname) {
  return (
    (method === 'POST' && pathname === '/api/new-game') ||
    (method === 'GET' && pathname === '/api/state') ||
    (method === 'GET' && pathname === '/api/field') ||
    (method === 'POST' && pathname === '/api/field/move')
  );
}

export async function handlePlaySessionFieldApi({ req, res, url, context, sendJson, readBody }) {
  if (req.method === 'POST' && url.pathname === '/api/new-game') {
    const playSession = await initializeNewPlayArea({ root: context.root });
    context.activeRoot = playSession.root;
    return sendJson(res, {
      area: playSession.area,
      slot: playSession.slot,
      state: playSession.state,
      player_parameters: playSession.player_parameters
    });
  }

  if (!context.activeRoot) return sendNoActiveSlot(res, sendJson);
  const root = context.activeRoot;

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, await readJson(root, 'game_data/runtime_state.json'));
  }

  if (req.method === 'GET' && url.pathname === '/api/field') {
    const [state, locations] = await Promise.all([
      readJson(root, 'game_data/runtime_state.json'),
      readJson(root, 'game_data/locations.json')
    ]);
    const currentLocationRaw = locations.find((location) => location.id === state.current_location_id) ?? null;
    const currentLocation = currentLocationRaw
      ? evaluateLocationsForState({ state, locations: [currentLocationRaw] })[0] ?? currentLocationRaw
      : null;
    return sendJson(res, { state, current_location: currentLocation, locations: evaluateLocationsForState({ state, locations }) });
  }

  if (req.method === 'POST' && url.pathname === '/api/field/move') {
    const body = await readBody(req);
    return sendJson(res, await moveToLocation({
      root,
      locationId: body.location_id,
      selectedVisibleSituation: body.selected_visible_situation
    }));
  }
}
