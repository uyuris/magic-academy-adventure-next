const CONVERSATION_LIFECYCLE_ROUTES = new Set([
  'POST /api/conversation/opening',
  'POST /api/conversation',
  'POST /api/conversation/edit-user-message',
  'POST /api/conversation/end'
]);

const CONVERSATION_ID_PATTERN = /^conv_[A-Za-z0-9_-]+$/;

function assertValidConversationIdForApi(value, fieldName = 'id') {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (CONVERSATION_ID_PATTERN.test(normalized)) return normalized;
  const error = new Error(`invalid ${fieldName}: ${value}`);
  error.code = 'INVALID_CONVERSATION_ID';
  error.errorCode = 'invalid_conversation_id';
  error.statusCode = 400;
  throw error;
}

export function canHandleConversationLifecycleApiRoute(method, pathname) {
  return CONVERSATION_LIFECYCLE_ROUTES.has(`${method} ${pathname}`);
}

export async function handleConversationLifecycleApi({
  req,
  res,
  url,
  context,
  sendJson,
  readBody,
  resolveRuntimeProviders,
  readJson,
  readJsonIfExists,
  writeJson,
  runConversationOpening,
  runConversationTurn,
  editConversationUserMessage,
  runConversationFinalization,
  markGraduationEndingComplete,
  isGraduationEndingContext
}) {
  const root = context.activeRoot ?? context.root;

  if (req.method === 'POST' && url.pathname === '/api/conversation/opening') {
    const body = await readBody(req);
    const conversationId = assertValidConversationIdForApi(body.id, 'id');
    const providers = await resolveRuntimeProviders({ requestedProvider: body.provider, context });
    const result = await runConversationOpening({
      root,
      id: conversationId,
      characterId: body.character_id ?? 'lina',
      now: new Date().toISOString(),
      ...providers
    });
    return sendJson(res, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/conversation') {
    const body = await readBody(req);
    const conversationId = assertValidConversationIdForApi(body.id, 'id');
    const providers = await resolveRuntimeProviders({ requestedProvider: body.provider, context });
    const now = new Date().toISOString();
    const result = await runConversationTurn({
      root,
      id: conversationId,
      characterId: body.character_id ?? 'lina',
      playerInput: body.player_input,
      now,
      ...providers
    });
    return sendJson(res, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/conversation/edit-user-message') {
    const body = await readBody(req);
    try {
      const providers = await resolveRuntimeProviders({ requestedProvider: body.provider, context });
      return sendJson(res, await editConversationUserMessage({
        root,
        characterId: body.character_id ?? 'lina',
        messageIndex: body.message_index,
        content: body.content,
        now: new Date().toISOString(),
        ...providers
      }));
    } catch (error) {
      const payload = { error: error.message };
      if (error?.errorCode) payload.error_code = error.errorCode;
      return sendJson(res, payload, error?.statusCode ?? 400);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/conversation/end') {
    const body = await readBody(req);
    const providers = await resolveRuntimeProviders({ requestedProvider: body.provider, context });
    const state = await readJson(root, 'game_data/runtime_state.json');
    const characterId = body.character_id ?? state.current_interaction_character_id ?? 'lina';
    const conversationId = assertValidConversationIdForApi(body.conversation_id ?? state.last_conversation_id, 'conversation_id');
    const conversation = conversationId ? await readJsonIfExists(root, `game_data/logs/conversations/${conversationId}.json`) : null;
    const graduationEnding = isGraduationEndingContext(state, conversation);
    const fallbackScreen = graduationEnding ? 'title' : 'academy-room';
    const transition = graduationEnding
      ? { next_screen: 'title', loading_copy_key: 'graduation-ending-complete' }
      : { next_screen: 'academy-room', loading_copy_key: 'academy-room' };
    if (!conversationId || !conversation || conversation.character_id !== characterId) {
      const nextState = { ...state, current_screen: fallbackScreen, current_interaction_character_id: null, pending_interaction_context: null };
      await writeJson(root, 'game_data/runtime_state.json', nextState);
      return sendJson(res, { skipped: true, reason: 'no_active_conversation', character_id: characterId, state: nextState, transition });
    }
    if (conversation.discarded_after_work_record_id) {
      const nextState = { ...state, current_screen: fallbackScreen, current_interaction_character_id: null, pending_interaction_context: null };
      await writeJson(root, 'game_data/runtime_state.json', nextState);
      return sendJson(res, { skipped: true, reason: 'already_finalized', conversation, state: nextState, transition });
    }
    const nextState = {
      ...state,
      current_screen: fallbackScreen,
      current_interaction_character_id: null,
      pending_interaction_context: null
    };
    await writeJson(root, 'game_data/runtime_state.json', nextState);
    const finalStateTransform = graduationEnding
      ? (stateForCompletion) => markGraduationEndingComplete({ ...(stateForCompletion ?? {}), current_screen: fallbackScreen })
      : null;
    const finalization = await runConversationFinalization({ root, conversationId, characterId, providers, finalStateTransform });
    const finalizationState = finalization.state ?? nextState;
    return sendJson(res, {
      finalization_status: 'completed',
      finalization,
      conversation: finalization.conversation ?? conversation,
      character_id: characterId,
      state: finalizationState,
      transition
    });
  }

  return false;
}
