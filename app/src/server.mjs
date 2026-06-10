import http from 'node:http';
import path from 'node:path';
import { buildCharacterPrompt } from './llm/promptBuilder.mjs';
import { editConversationUserMessage, finalizeConversation, getContinuityRecordStatus, pendingRecalledWorkRecordIds, resetContinuityRecords, runConversationOpening, runConversationTurn, selectRelevantWorkRecords, startInteractionSession } from './llm/conversationPipeline.mjs';
import { resolveCharacterSpeechConstraints } from './llm/characterSpeechConstraints.mjs';
import { createLmStudioProviders, loadLmStudioConfig } from './llm/lmStudioClient.mjs';
import { listSelectableCharacters, ensureSelectableCharacterStorage, updateCharacterProfileText } from './characterCatalog.mjs';
import { loadWorldSettings } from './worldSettings.mjs';
import { canHandleSaveLoadApiRoute, handleSaveLoadApi } from './server/saveLoadApi.mjs';
import { canHandleLmStudioSettingsRoute, handleLmStudioSettingsApi, ensureLmStudioConversationConfig } from './server/lmStudioSettingsApi.mjs';
import { canHandleFlagDebugRoute, handleFlagDebugApi } from './server/flagDebugApi.mjs';
import { canHandleAuthoringApiRoute, handleAuthoringApi } from './server/authoringApi.mjs';
import { canHandlePlaySessionFieldApiRoute, handlePlaySessionFieldApi } from './server/playSessionFieldApi.mjs';
import { canHandleProgressionEconomyApiRoute, handleProgressionEconomyApi } from './server/progressionEconomyApi.mjs';
import { canHandleInteractionContinuityApiRoute, handleInteractionContinuityApi } from './server/interactionContinuityApi.mjs';
import { canHandleAssetCompositeApiRoute, handleAssetCompositeApi } from './server/assetCompositeApi.mjs';
import { canHandleConversationLifecycleApiRoute, handleConversationLifecycleApi } from './server/conversationLifecycleApi.mjs';
import { canHandleConversationStreamingApiRoute, handleConversationStreamingApi } from './server/conversationStreamingApi.mjs';
import { sendJson, openSse, sendSseEvent, readBody } from './server/httpHelpers.mjs';
import { serveStatic } from './server/staticServing.mjs';
import { markGraduationEndingComplete, isGraduationEndingContext } from './graduationEnding.mjs';
import { defaultRuntimePaths } from './runtimePaths.mjs';
import { createStorageApi } from './storage.mjs';
import { resolveValidActivePlayRoot } from './playSession.mjs';

const projectRoot = defaultRuntimePaths.projectRoot;
const defaultPublicRoot = defaultRuntimePaths.publicRoot;
const defaultCanonicalAssetsRoot = defaultRuntimePaths.canonicalAssetsRoot;
const defaultCanonicalVisualSetsRoot = defaultRuntimePaths.canonicalVisualSetsRoot;
const defaultLmStudioConfigPath = path.join(defaultRuntimePaths.configRoot, 'lmstudio.json');
const defaultPort = Number(process.env.PORT ?? 4173);
const defaultHost = process.env.HOST ?? '127.0.0.1';

function storageFor(root) {
  return createStorageApi({ root });
}

async function readJson(root, relativePath) {
  return storageFor(root).readJson(relativePath);
}

async function writeJson(root, relativePath, value) {
  await storageFor(root).writeJson(relativePath, value);
}

async function readJsonIfExists(root, relativePath) {
  return storageFor(root).readJsonIfExists(relativePath);
}

async function listJson(root, relativeDir) {
  return storageFor(root).listJson(relativeDir);
}

async function listMarkdownRecords(root, relativeDir) {
  return storageFor(root).listMarkdownRecords(relativeDir);
}

function enrichEventContextWithSourceWorkRecord(eventContext, workRecords) {
  if (!eventContext || typeof eventContext !== 'object') return null;
  const sourceConversationId = String(eventContext.source_conversation_id ?? '').trim();
  const sourceWorkRecordId = sourceConversationId ? `wr_${sourceConversationId}` : '';
  const sourceWorkRecord = workRecords.find((record) => record.id === sourceWorkRecordId);
  if (!sourceWorkRecord?.body) return { ...eventContext };
  return {
    ...eventContext,
    source_work_record_id: sourceWorkRecord.id,
    source_work_record_body: sourceWorkRecord.body
  };
}

async function readCharacter(root, characterId) {
  const base = `game_data/characters/${characterId}`;
  const [profile, flags, skills] = await Promise.all([
    readJson(root, `${base}/profile.json`),
    readJson(root, `${base}/flags.json`),
    readJsonIfExists(root, `${base}/skills.json`)
  ]);
  return { profile, flags, skills: skills ?? { character_id: characterId, skills: [] } };
}

async function resolveRuntimeProviders({ requestedProvider, context, onChatDelta } = {}) {
  if (requestedProvider === 'mock') {
    return {
      chatProvider: async ({ playerInput }) => playerInput === null
        ? '……はい。まずはこの場所の様子を、落ち着いて見てみましょう。'
        : '……はい。今の話を手がかりに、目の前の状況から一つずつ確かめます。',
      conversationContinuationProvider: async () => true,
      conversationCutoffProvider: async () => '今日はここで区切りましょう。また必要になったら声をかけてください。'
    };
  }
  const config = await ensureLmStudioConversationConfig(context);
  const characterSpeechConstraints = await resolveCharacterSpeechConstraints({
    root: context.activeRoot ?? context.root,
    chatModel: config.chat_model
  });
  return { ...createLmStudioProviders({ config, onChatDelta }), characterSpeechConstraints };
}

async function runConversationFinalization({ root, conversationId, characterId, providers, finalStateTransform = null }) {
  const startedAt = new Date().toISOString();
  try {
    return await finalizeConversation({
      root,
      conversationId,
      characterId,
      now: startedAt,
      skillNecessityProvider: providers.skillNecessityProvider ?? providers.skillNecessityJudgmentProvider,
      finalStateTransform,
      ...providers
    });
  } catch (error) {
    await writeJson(root, `game_data/logs/finalization_errors/${conversationId}.json`, {
      conversation_id: conversationId,
      character_id: characterId,
      started_at: startedAt,
      failed_at: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function updateAuthoringAndActiveRoot({ context, updater }) {
  const canonicalResult = await updater(context.root);
  if (context.activeRoot && path.resolve(context.activeRoot) !== path.resolve(context.root)) {
    await updater(context.activeRoot);
  }
  return canonicalResult;
}

async function routeApi(req, res, url, context) {
  if (context.activeRootRestorePromise) {
    await context.activeRootRestorePromise;
    context.activeRootRestorePromise = null;
  }
  if (canHandleSaveLoadApiRoute(req.method, url.pathname)) {
    await handleSaveLoadApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleLmStudioSettingsRoute(req.method, url.pathname)) {
    await handleLmStudioSettingsApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleFlagDebugRoute(req.method, url.pathname)) {
    await handleFlagDebugApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleAuthoringApiRoute(req.method, url.pathname)) {
    await handleAuthoringApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandlePlaySessionFieldApiRoute(req.method, url.pathname)) {
    await handlePlaySessionFieldApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleProgressionEconomyApiRoute(req.method, url.pathname)) {
    await handleProgressionEconomyApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleInteractionContinuityApiRoute(req.method, url.pathname)) {
    await handleInteractionContinuityApi({ req, res, url, context, sendJson, readBody });
    return;
  }
  if (canHandleAssetCompositeApiRoute(req.method, url.pathname)) {
    await handleAssetCompositeApi({ req, res, url, context, sendJson });
    return;
  }
  if (canHandleConversationLifecycleApiRoute(req.method, url.pathname)) {
    await handleConversationLifecycleApi({
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
    });
    return;
  }
  if (canHandleConversationStreamingApiRoute(req.method, url.pathname)) {
    await handleConversationStreamingApi({
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
    });
    return;
  }

  return sendJson(res, { error: 'not found' }, 404);
}

export function createServer(options = {}) {
  const context = {
    root: path.resolve(options.root ?? projectRoot),
    activeRoot: options.activeRoot ? path.resolve(options.activeRoot) : null,
    publicRoot: path.resolve(options.publicRoot ?? defaultPublicRoot),
    canonicalAssetsRoot: path.resolve(options.canonicalAssetsRoot ?? defaultCanonicalAssetsRoot),
    canonicalVisualSetsRoot: path.resolve(options.canonicalVisualSetsRoot ?? defaultCanonicalVisualSetsRoot),
    worldSettingsWriteTarget: options.worldSettingsWriteTarget === 'config' ? 'config' : 'definitions',
    characterAuthoringEnabled: options.characterAuthoringEnabled !== false,
    characterAuthoringDisabledReason: options.characterAuthoringDisabledReason ?? null,
    lmStudioConfig: options.lmStudioConfig ?? null,
    lmStudioConfigPath: path.resolve(options.lmStudioConfigPath ?? process.env.MAGIC_ACADEMY_LMSTUDIO_CONFIG ?? defaultLmStudioConfigPath),
    activeRootRestorePromise: null
  };
  if (!context.activeRoot) {
    context.activeRootRestorePromise = resolveValidActivePlayRoot(context.root).then((activeRoot) => {
      context.activeRoot = activeRoot;
    });
  }
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) await routeApi(req, res, url, context);
      else await serveStatic(req, res, url, context);
    } catch (error) {
      const payload = { error: error.message };
      if (error?.errorCode) payload.error_code = error.errorCode;
      sendJson(res, payload, error?.statusCode ?? 500);
    }
  });
}

async function loadStartupLmStudioConfig(configPath) {
  try {
    return await loadLmStudioConfig(configPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function startServer(options = {}) {
  const host = options.host ?? defaultHost;
  const port = Number(options.port ?? defaultPort);
  const configPath = path.resolve(options.lmStudioConfigPath ?? process.env.MAGIC_ACADEMY_LMSTUDIO_CONFIG ?? defaultLmStudioConfigPath);
  const lmStudioConfig = options.lmStudioConfig === undefined
    ? await loadStartupLmStudioConfig(configPath)
    : options.lmStudioConfig;
  const server = createServer({
    ...options,
    lmStudioConfig,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };
    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, host);
  });
  const address = server.address();
  const startedHost = typeof address === 'object' && address?.address ? address.address : host;
  const startedPort = typeof address === 'object' && address?.port ? address.port : port;
  if (options.silent !== true) {
    console.log(`STARFALL MAGIC ACADEMY runtime listening on http://${startedHost}:${startedPort}`);
    if (!lmStudioConfig) {
      console.log(`LM Studio config not found at ${configPath}; browser shell and settings surface are available, but conversation features will require saving LM Studio settings first.`);
    }
  }
  return { server, host: startedHost, port: startedPort, url: `http://${startedHost}:${startedPort}`, lmStudioConfigPath: configPath, lmStudioConfig };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer();
}
