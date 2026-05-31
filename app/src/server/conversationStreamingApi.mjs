const CONVERSATION_STREAMING_ROUTES = new Set([
  'POST /api/conversation/opening/stream',
  'POST /api/conversation/stream'
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

export function canHandleConversationStreamingApiRoute(method, pathname) {
  return CONVERSATION_STREAMING_ROUTES.has(`${method} ${pathname}`);
}

function serializeStreamError(error) {
  const payload = { error: error.message };
  if (error?.errorCode) payload.error_code = error.errorCode;
  return payload;
}

export async function handleConversationStreamingApi({
  req,
  res,
  url,
  context,
  readBody,
  resolveRuntimeProviders,
  runConversationOpening,
  runConversationTurn,
  openSse,
  sendSseEvent
}) {
  const root = context.activeRoot ?? context.root;

  if (req.method === 'POST' && url.pathname === '/api/conversation/opening/stream') {
    const body = await readBody(req);
    const conversationId = assertValidConversationIdForApi(body.id, 'id');
    openSse(res);
    try {
      sendSseEvent(res, 'status', { phase: 'opening_started' });
      const providers = await resolveRuntimeProviders({
        requestedProvider: body.provider,
        context,
        onChatDelta: (delta) => sendSseEvent(res, 'assistant_delta', { delta })
      });
      const result = await runConversationOpening({
        root,
        id: conversationId,
        characterId: body.character_id ?? 'lina',
        now: new Date().toISOString(),
        onAssistantComplete: ({ content }) => sendSseEvent(res, 'assistant_complete', { content }),
        ...providers
      });
      sendSseEvent(res, 'result', result);
    } catch (error) {
      sendSseEvent(res, 'error', serializeStreamError(error));
    } finally {
      res.end();
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/conversation/stream') {
    const body = await readBody(req);
    const conversationId = assertValidConversationIdForApi(body.id, 'id');
    openSse(res);
    try {
      sendSseEvent(res, 'status', { phase: 'chat_started' });
      const providers = await resolveRuntimeProviders({
        requestedProvider: body.provider,
        context,
        onChatDelta: (delta) => sendSseEvent(res, 'assistant_delta', { delta })
      });
      const now = new Date().toISOString();
      const result = await runConversationTurn({
        root,
        id: conversationId,
        characterId: body.character_id ?? 'lina',
        playerInput: body.player_input,
        now,
        onEmotion: (emotion) => sendSseEvent(res, 'assistant_emotion', emotion),
        onAssistantComplete: ({ content, emotion }) => sendSseEvent(res, 'assistant_complete', { content, ...emotion }),
        ...providers
      });
      sendSseEvent(res, 'result', result);
    } catch (error) {
      sendSseEvent(res, 'error', serializeStreamError(error));
    } finally {
      res.end();
    }
    return true;
  }

  return false;
}
