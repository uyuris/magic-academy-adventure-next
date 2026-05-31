import { createSaveSlot, deleteSaveSlot, describeSaveSlots, listSaveSlots, loadSaveSlot, updateSaveSlotNote } from '../saveLoad.mjs';

const slotNoteRoutePattern = /^\/api\/slots\/[^/]+\/note$/;
const slotDeleteRoutePattern = /^\/api\/slots\/[^/]+$/;

export function canHandleSaveLoadApiRoute(method, pathname) {
  if (method === 'GET' && (pathname === '/api/save-slots' || pathname === '/api/slots')) return true;
  if (method === 'POST' && (pathname === '/api/save' || pathname === '/api/load' || pathname === '/api/slots/load')) return true;
  if (method === 'PATCH' && slotNoteRoutePattern.test(pathname)) return true;
  if (method === 'DELETE' && slotDeleteRoutePattern.test(pathname)) return true;
  return false;
}

export async function handleSaveLoadApi({ req, res, url, context, sendJson, readBody }) {
  if (!canHandleSaveLoadApiRoute(req.method, url.pathname)) return false;

  if (req.method === 'GET' && url.pathname === '/api/save-slots') {
    sendJson(res, await listSaveSlots({ root: context.root }));
    return true;
  }
  if (req.method === 'GET' && url.pathname === '/api/slots') {
    sendJson(res, await describeSaveSlots({ root: context.root }));
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/save') {
    const body = await readBody(req);
    sendJson(res, await createSaveSlot({ root: context.root, slotId: body.slot_id, label: body.label, now: new Date().toISOString() }));
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/load') {
    const body = await readBody(req);
    const loaded = await loadSaveSlot({ root: context.root, slotId: body.slot_id });
    context.activeRoot = loaded.root;
    sendJson(res, loaded);
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/slots/load') {
    const body = await readBody(req);
    try {
      const loaded = await loadSaveSlot({ root: context.root, slotId: body.slot_id });
      context.activeRoot = loaded.root;
      sendJson(res, loaded);
    } catch (error) {
      const status = error?.statusCode ?? (error?.code === 'GRADUATION_COMPLETED' ? 409 : 400);
      const payload = { error: error.message };
      if (error?.errorCode) payload.error_code = error.errorCode;
      sendJson(res, payload, status);
    }
    return true;
  }
  if (req.method === 'PATCH' && slotNoteRoutePattern.test(url.pathname)) {
    const body = await readBody(req);
    const slotId = decodeURIComponent(url.pathname.replace(/^\/api\/slots\//, '').replace(/\/note$/, ''));
    let slot;
    try {
      slot = await updateSaveSlotNote({ root: context.root, slotId, playerNote: body.player_note, now: new Date().toISOString() });
    } catch (error) {
      const payload = { error: error.message };
      if (error?.errorCode) payload.error_code = error.errorCode;
      sendJson(res, payload, error?.statusCode ?? 400);
      return true;
    }
    const slotsDescription = await describeSaveSlots({ root: context.root });
    sendJson(res, {
      slot,
      slots: slotsDescription.slots,
      active_slot_id: slotsDescription.active_slot_id
    });
    return true;
  }
  if (req.method === 'DELETE' && slotDeleteRoutePattern.test(url.pathname)) {
    const slotId = decodeURIComponent(url.pathname.replace(/^\/api\/slots\//, ''));
    let deleted;
    try {
      deleted = await deleteSaveSlot({ root: context.root, slotId });
    } catch (error) {
      const payload = { error: error.message };
      if (error?.errorCode) payload.error_code = error.errorCode;
      sendJson(res, payload, error?.statusCode ?? 400);
      return true;
    }
    if (deleted.active_slot_id === null) context.activeRoot = null;
    sendJson(res, deleted);
    return true;
  }
  return false;
}
