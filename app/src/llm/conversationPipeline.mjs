import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildCharacterPrompt } from './promptBuilder.mjs';
import { buildContinuityPromptContext, mergeWorkRecordsById } from './continuityPromptContext.mjs';
import { faceExpressionChoicesText, faceExpressionSet } from '../faceExpressions.mjs';
import { loadWorldSettings } from '../worldSettings.mjs';
import { validateConversationRecordUpdates } from './validator.mjs';
import {
  applyAcceptedStageFlags,
  collectAcceptedStageFlagRewards,
  defaultStageFlagJudgmentProvider,
  judgeStageFlagsAfterConversation
} from '../stageFlags.mjs';
import {
  applyAcceptedEventCompletions,
  applyAcceptedEventFlags,
  applyAcceptedEventParticipantOverrides,
  defaultEventCompletionJudgmentProvider,
  defaultEventFlagJudgmentProvider,
  defaultEventParticipantOverrideJudgmentProvider,
  judgeEventCompletionsAfterConversation,
  judgeEventFlagsAfterConversation,
  judgeEventParticipantOverridesAfterConversation
} from '../eventFlags.mjs';
import { loadInventory, applyPlayerMoneyDelta, grantInventoryRewards } from '../economy.mjs';
import { createStorageApi } from '../storage.mjs';

const CONTINUITY_RECORD_LIMIT = 100;
const RECALLED_WORK_RECORD_PROMPT_TURNS = 10;
const ALLOWED_FACE_EXPRESSIONS = faceExpressionSet;
const CONVERSATION_EDIT_ITEM_ID = 'eternel_cube';
const CONVERSATION_ID_PATTERN = /^conv_[A-Za-z0-9_-]+$/;

function storageFor(root) {
  return createStorageApi({ root });
}

async function readJson(root, relativePath) {
  return storageFor(root).readJson(relativePath);
}

async function readJsonIfExists(root, relativePath) {
  return storageFor(root).readJsonIfExists(relativePath);
}

async function readSkillsFile(root, characterId) {
  return await readJsonIfExists(root, `game_data/characters/${characterId}/skills.json`) ?? { character_id: characterId, skills: [] };
}

async function writeJson(root, relativePath, value) {
  await storageFor(root).writeJson(relativePath, value);
}

async function writeText(root, relativePath, value) {
  const fullPath = storageFor(root).resolveWritePath(relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, value, 'utf8');
}

async function listDirEntries(root, relativeDir, suffix) {
  const fullDir = await storageFor(root).resolveReadPath(relativeDir);
  try {
    const entries = await fs.readdir(fullDir);
    return entries.filter((entry) => entry.endsWith(suffix)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function listJson(root, relativeDir) {
  return storageFor(root).listJson(relativeDir);
}

async function listMarkdownRecords(root, relativeDir) {
  return storageFor(root).listMarkdownRecords(relativeDir);
}

async function pruneFilesToLimit(root, relativeDir, suffix, limit = CONTINUITY_RECORD_LIMIT) {
  const storage = storageFor(root);
  const entries = await listDirEntries(root, relativeDir, suffix);
  const excess = entries.length - limit;
  if (excess <= 0) return [];
  const removed = entries.slice(0, excess);
  await Promise.all(removed.map((entry) => fs.rm(storage.resolveWritePath(path.join(relativeDir, entry)), { force: true })));
  return removed;
}

function applyFlagUpdate(target, candidate) {
  if (candidate.op === 'set') target[candidate.flag] = candidate.value;
  else if (candidate.op === 'increment') target[candidate.flag] = (Number(target[candidate.flag]) || 0) + candidate.value;
  else throw new Error(`unsupported accepted flag op: ${candidate.op}`);
}

function applyAcceptedFlags(state, validator) {
  const next = JSON.parse(JSON.stringify(state));
  for (const candidate of validator.accepted_flags) {
    const characterFlags = next.characters?.[candidate.character_id]?.flags;
    if (characterFlags && Object.prototype.hasOwnProperty.call(characterFlags, candidate.flag)) {
      applyFlagUpdate(characterFlags, candidate);
    } else {
      applyFlagUpdate(next.global_flags, candidate);
    }
  }
  return next;
}

function academyElapsedWeeksSnapshot(state) {
  const elapsedWeeks = Number(state?.elapsed_weeks);
  return Number.isFinite(elapsedWeeks) ? Math.max(0, Math.trunc(elapsedWeeks)) : 0;
}

function academyWeekNumberFromElapsedWeeks(elapsedWeeks) {
  return Math.max(1, Math.trunc(elapsedWeeks) + 1);
}

function academyWeekSnapshotFromState(state) {
  const academyElapsedWeeksAtStart = academyElapsedWeeksSnapshot(state);
  return {
    academy_elapsed_weeks_at_start: academyElapsedWeeksAtStart,
    academy_week_number: academyWeekNumberFromElapsedWeeks(academyElapsedWeeksAtStart)
  };
}

function academyWeekSnapshotForConversation({ conversation, state }) {
  const fallback = academyWeekSnapshotFromState(state);
  const weekNumber = Number(conversation?.academy_week_number);
  const elapsedWeeksAtStart = Number(conversation?.academy_elapsed_weeks_at_start);
  return {
    academy_week_number: Number.isInteger(weekNumber) && weekNumber >= 1 ? weekNumber : fallback.academy_week_number,
    academy_elapsed_weeks_at_start: Number.isInteger(elapsedWeeksAtStart) && elapsedWeeksAtStart >= 0
      ? elapsedWeeksAtStart
      : fallback.academy_elapsed_weeks_at_start
  };
}

function renderWorkRecordMarkdown({ id, draft }) {
  const academyWeekNumber = Number.isInteger(draft.academy_week_number) && draft.academy_week_number >= 1
    ? draft.academy_week_number
    : 1;
  return `# ${draft.title}\n\nID: ${id}\n\n## 第${academyWeekNumber}週のサマリー\n\n${draft.summary}\n`;
}

function clampSentences(text, maxSentences) {
  const source = String(text ?? '').trim();
  if (!source) return source;
  const sentenceMatches = source.match(/[^。.!?！？]+[。.!?！？]+|[^。.!?！？]+$/gu) ?? [];
  return sentenceMatches.slice(0, maxSentences).join('').trim();
}

function normalizeMemoryRecordForSave({ memoryUpdate, conversation, workRecordId }) {
  const memoryRecord = {
    ...(memoryUpdate.memory_record ?? memoryUpdate),
    visibility: 'character_known',
    source_conversation_id: conversation.id,
    work_record_id: workRecordId
  };
  return { ...memoryRecord, text: clampSentences(memoryRecord.text, 5) };
}

async function defaultChatProvider({ playerInput } = {}) {
  if (playerInput === null) return '……はい。まずはこの場所の様子を、落ち着いて見てみましょう。';
  return '……はい。今の話を手がかりに、目の前の状況から一つずつ確かめます。';
}

function makeConversationId(now) {
  const stamp = now.replace(/[^0-9A-Za-z]/g, '').replace(/Z$/, '').slice(0, 18);
  return `conv_${stamp}_${randomUUID().slice(0, 8)}`;
}

function invalidConversationIdError(conversationId) {
  const error = new Error(`invalid conversationId: ${conversationId}`);
  error.code = 'INVALID_CONVERSATION_ID';
  error.errorCode = 'invalid_conversation_id';
  error.statusCode = 400;
  return error;
}

function assertValidConversationId(conversationId) {
  const normalized = String(conversationId ?? '').trim();
  if (!normalized) throw invalidConversationIdError(conversationId);
  if (!CONVERSATION_ID_PATTERN.test(normalized)) throw invalidConversationIdError(conversationId);
  return normalized;
}

function conversationLogPath(conversationId) {
  return `game_data/logs/conversations/${assertValidConversationId(conversationId)}.json`;
}

function firstUserText(conversation) {
  return conversation.messages.find((message) => message.role === 'user')?.content ?? '会話した';
}

function firstAssistantText(conversation) {
  return conversation.messages.find((message) => message.role === 'assistant')?.content ?? 'リナが応答した';
}

export function buildEmotionChoicePrompt({ profile, currentConversation = [], playerInput }) {
  if (!profile?.display_name) throw new Error('profile.display_name is required');
  const conversationText = currentConversation.length === 0 ? '- なし' : currentConversation.map((message) => {
    const speaker = message.role === 'assistant' ? profile.display_name : 'プレイヤー';
    return `- ${speaker}: ${message.content}`;
  }).join('\n');
  return [
    `次のプレイヤー入力を受け取った直後の${profile.display_name}の感情を、顔アイコン用に1つだけ選ぶ。`,
    `使えるexpression: ${faceExpressionChoicesText}`,
    '返答本文はまだ書かない。JSONのexpressionだけを返す。',
    '',
    '直前までの会話:',
    conversationText,
    '',
    `プレイヤーの発言: ${playerInput ?? ''}`
  ].join('\n');
}

function normalizeEmotionChoice(choice) {
  const rawExpression = typeof choice === 'string' ? choice : choice?.expression ?? choice?.emotion ?? choice?.face_emotion_variant_id;
  const expression = String(rawExpression ?? 'neutral').replace(/^face_/, '');
  const normalized = ALLOWED_FACE_EXPRESSIONS.has(expression) ? expression : 'neutral';
  return { expression: normalized, face_emotion_variant_id: `face_${normalized}` };
}

async function defaultEmotionProvider() {
  return { expression: 'neutral' };
}

async function defaultWorkRecordRecallProvider() {
  return { work_record_ids: [] };
}

async function defaultConversationContinuationProvider() {
  return true;
}

async function defaultConversationCutoffProvider({ profile } = {}) {
  return `${profile?.display_name ?? '相手'}は、ここで会話を切り上げることにした。`;
}

function normalizeBooleanChoice(choice, defaultValue = true) {
  const raw = typeof choice === 'object' && choice !== null
    ? choice.continue_conversation ?? choice.continueConversation ?? choice.value ?? choice.answer
    : choice;
  if (typeof raw === 'boolean') return raw;
  const text = String(raw ?? '').trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return defaultValue;
}

async function defaultPromptPrewarmProvider() {
  return '';
}

function uniqueExistingWorkRecordIds(ids, allWorkRecords, limit = Infinity) {
  const existingIds = new Set(allWorkRecords.map((record) => record.id));
  const result = [];
  for (const rawId of ids ?? []) {
    const id = String(rawId ?? '').trim();
    if (!id || !existingIds.has(id) || result.includes(id)) continue;
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

function linkedWorkRecordIdsFromContinuity({ memories = [], skills = [] }) {
  return Array.from(new Set([
    ...memories.map((memory) => memory.work_record_id),
    ...skills.map((skill) => skill.work_record_id)
  ].filter(Boolean)));
}

function normalizePendingRecalledWorkRecords(conversation, allWorkRecords) {
  const existingIds = new Set(allWorkRecords.map((record) => record.id));
  const byId = new Map();
  for (const rawEntry of conversation?.pending_recalled_work_records ?? []) {
    const id = String(rawEntry?.id ?? rawEntry?.work_record_id ?? '').trim();
    if (!id || !existingIds.has(id)) continue;
    const turnsRemaining = Math.trunc(Number(rawEntry?.turns_remaining ?? rawEntry?.remaining_turns ?? 0));
    if (turnsRemaining <= 0) continue;
    byId.set(id, { id, turns_remaining: turnsRemaining });
  }
  for (const id of uniqueExistingWorkRecordIds(conversation?.pending_recalled_work_record_ids ?? [], allWorkRecords)) {
    if (!byId.has(id)) byId.set(id, { id, turns_remaining: RECALLED_WORK_RECORD_PROMPT_TURNS });
  }
  return Array.from(byId.values());
}

export function pendingRecalledWorkRecordIds(conversation, allWorkRecords) {
  return normalizePendingRecalledWorkRecords(conversation, allWorkRecords).map((entry) => entry.id);
}

function updatePendingRecalledWorkRecordsAfterTurn({ pendingEntries, recalledIds }) {
  const next = new Map();
  for (const entry of pendingEntries ?? []) {
    const turnsRemaining = Math.trunc(Number(entry.turns_remaining ?? 0));
    if (turnsRemaining > 1) next.set(entry.id, { id: entry.id, turns_remaining: turnsRemaining - 1 });
  }
  for (const id of recalledIds ?? []) {
    next.set(id, { id, turns_remaining: RECALLED_WORK_RECORD_PROMPT_TURNS });
  }
  return Array.from(next.values());
}

async function defaultMemoryUpdateProvider({ conversation, workRecordId, now }) {
  return {
    memory_record: {
      id: `mem_${conversation.id}`,
      character_id: conversation.character_id,
      visibility: 'character_known',
      type: 'relationship_change',
      text: `リナは、主人公が「${firstUserText(conversation)}」と声をかけたことで、主人公が薬草園の異常を一緒に確かめようとしている相手だと受け止めた。`,
      source_conversation_id: conversation.id,
      work_record_id: workRecordId,
      created_at: now,
      tags: [conversation.character_id, 'relationship_change', 'conversation']
    }
  };
}

async function defaultSkillNecessityProvider() {
  return { necessary: true, raw_answer: 'true' };
}

async function defaultSkillUpdateProvider({ conversation, workRecordId, now }) {
  return {
    skill_record: {
      id: `skill_${conversation.id}`,
      character_id: conversation.character_id,
      visibility: 'character_known',
      type: 'self_change',
      name: '会話からの自己変化',
      description: `リナは主人公との会話を通じて、気になる点を一人で抱え込まず相手に確認を求める意識を少し強めた。`,
      source_conversation_id: conversation.id,
      work_record_id: workRecordId,
      created_at: now,
      tags: [conversation.character_id, 'self_change', 'conversation']
    }
  };
}

async function defaultWorkRecordProvider({ conversation, workRecordId }) {
  return {
    work_record: {
      id: workRecordId,
      character_id: conversation.character_id,
      source_conversation_id: conversation.id,
      title: '放課後の薬草園で棚札の確認について話した',
      summary: `主人公はリナに「${firstUserText(conversation)}」と話しかけ、薬草園の棚札を一緒に確認しようとした。リナは「${firstAssistantText(conversation)}」と返し、記録と現場を落ち着いて見比べようとした。二人の間には、違和感をその場で確認する会話の流れが生まれた。`,
      flag_update_candidates: [
        { character_id: conversation.character_id, flag: `knowledge.${conversation.character_id}.player_checked_garden_label`, op: 'set', value: true }
      ],
      warnings: []
    }
  };
}

async function defaultMoneyDeltaProvider() {
  return '0';
}

async function defaultBuddyAgreementProvider() {
  return 'false';
}

async function defaultEnemyHostilityProvider() {
  return 'false';
}

async function defaultDestinationStageProvider() {
  return 'none';
}

function buildConversationFinalizationPrompt({ conversation, workRecordId, finalInstruction }) {
  return [
    '次の会話セッションだけを根拠に、会話終了後の処理を1つ実行する。',
    '根拠はここに示す会話セッションだけ。',
    '',
    JSON.stringify({
      conversation_id: conversation.id,
      character_id: conversation.character_id,
      character_name: conversation.character_name ?? null,
      work_record_id: workRecordId,
      source_type: conversation.source_type,
      location_id: conversation.location_id,
      time_slot: conversation.time_slot,
      messages: conversation.messages
    }, null, 2),
    '',
    finalInstruction
  ].join('\n');
}

function buildMoneyDeltaPrompt({ conversation, workRecordId, currentMoney }) {
  return buildConversationFinalizationPrompt({
    conversation,
    workRecordId,
    finalInstruction: [
      '会話前後で増減したユーザーの所持金を判定する。',
      'ユーザーが得た金額は正の整数、支払った金額は負の整数、所持金の移動が成立していなければ0。',
      '回答は数値のみ。説明、単位、JSON、Markdownコードブロック、ラベルは出力しない。'
    ].join('\n')
  });
}

function buildBuddyAgreementPrompt({ conversation, workRecordId }) {
  return buildConversationFinalizationPrompt({
    conversation,
    workRecordId,
    finalInstruction: [
      '会話相手と主人公がバディになる合意が相互に成立したかを判定する。',
      'trueにするのは、主人公側がバディになる意思を示し、会話相手側もその場で明確に承諾した場合だけ。',
      '片方だけの希望、将来の約束、冗談、曖昧な協力、単なる仲良し表現ではfalse。',
      '回答はtrueもしくはfalseのみを返す。',
      'JSON、Markdownコードブロック、理由、補足、ラベルは出力しない。'
    ].join('\n')
  });
}

function buildEnemyHostilityPrompt({ conversation, workRecordId }) {
  return buildConversationFinalizationPrompt({
    conversation,
    workRecordId,
    finalInstruction: [
      '会話相手と主人公の敵対関係が相互に成立したかを判定する。',
      'trueにするのは、主人公側と会話相手側のどちらも、相手を敵・脅威・明確な対立相手として扱う意思をその場で示した場合だけ。',
      '一方的な怒り、軽い口論、競争、警戒、冗談、将来の可能性、単なる不仲表現ではfalse。',
      '回答はtrueもしくはfalseのみを返す。',
      'JSON、Markdownコードブロック、理由、補足、ラベルは出力しない。'
    ].join('\n')
  });
}

function selectableDestinationLocations({ locations, currentLocationId }) {
  return (locations ?? [])
    .filter((location) => location?.screen === 'field')
    .filter((location) => location.id !== currentLocationId)
    .map((location) => ({
      location_id: String(location.id ?? '').trim(),
      location_name: String(location.display_name ?? location.id ?? '').trim()
    }))
    .filter((location) => location.location_id && location.location_name);
}

function buildDestinationStagePrompt({ conversation, workRecordId, destinations }) {
  const destinationTable = (destinations ?? []).length === 0
    ? '- なし'
    : destinations.map((destination) => `${destination.location_name}: ${destination.location_id}`).join('\n');
  return buildConversationFinalizationPrompt({
    conversation,
    workRecordId,
    finalInstruction: [
      'この会話のあと、主人公と会話相手が二人で次に向かう場所について、会話内で具体的に合意したかを判定する。',
      '今度行く、来週行くなど、将来その場所へ一緒に行く予定について具体的に合意して会話が終わった場合も、向かう場所への合意が成立したものとして扱う。',
      '返答は対応表にあるlocation_idを1つだけ返す。',
      '会話内で合意が成立していない、候補が複数あって一意でない、行き先が対応表にない、今いる場所に留まるだけ、冗談や曖昧な提案に留まる場合は none を返す。',
      'JSON、Markdownコードブロック、理由、補足、ラベルは出力しない。',
      '移動可能な移動先の名称とlocation_idの対応表:',
      destinationTable
    ].join('\n')
  });
}

function parseMoneyDeltaAnswer(answer) {
  const raw = String(answer ?? '').trim();
  if (!/^[-+]?\d+$/u.test(raw)) return 0;
  return Math.trunc(Number(raw));
}

function parseBooleanOnlyAnswer(answer) {
  return String(answer ?? '').trim().toLowerCase() === 'true';
}

function parseDestinationStageAnswer(answer, destinations) {
  const normalized = String(answer ?? '').trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === 'none') return null;
  const destinationMap = new Map((destinations ?? []).map((destination) => [destination.location_id, destination]));
  return destinationMap.get(normalized) ?? null;
}

function buddyFlagId(characterId) {
  return `relationship.${characterId}.buddy`;
}

function enemyFlagId(characterId) {
  return `relationship.${characterId}.enemy`;
}

function applyDestinationStageToState(state, { conversation, location, now }) {
  if (!location?.location_id) return structuredClone(state);
  const next = structuredClone(state);
  const flagId = `event.destination_stage.${conversation.id}.ready`;
  const completedFlagId = `event.destination_stage.${conversation.id}.completed`;
  next.global_flags ??= {};
  next.event_flag_sources ??= {};
  next.global_flags[flagId] = true;
  next.event_flag_sources[flagId] = {
    character_id: conversation.character_id ?? null,
    conversation_id: conversation.id,
    achieved_at: now
  };
  next.pending_destination_stage_event = {
    flag_id: flagId,
    completed_flag_id: completedFlagId,
    character_id: conversation.character_id ?? null,
    character_name: conversation.character_name ?? null,
    conversation_id: conversation.id,
    location_id: location.location_id,
    location_name: location.location_name,
    source_type: 'destination_stage',
    opening_context: '二人は会話の中で合意した場所へ移動してきた。',
    achieved_at: now
  };
  return next;
}

function applyBuddyAgreementToState(state, { characterId, established }) {
  const next = JSON.parse(JSON.stringify(state));
  next.characters ??= {};
  if (established) {
    for (const entry of Object.values(next.characters)) {
      if (!entry?.flags) continue;
      for (const key of Object.keys(entry.flags)) {
        if (key.startsWith('relationship.') && key.endsWith('.buddy')) delete entry.flags[key];
      }
    }
    next.characters[characterId] ??= { flags: {} };
    next.characters[characterId].flags ??= {};
    next.characters[characterId].flags[buddyFlagId(characterId)] = true;
    next.current_buddy_character_id = characterId;
  }
  return next;
}

function applyEnemyHostilityToState(state, { characterId, established }) {
  const next = JSON.parse(JSON.stringify(state));
  next.characters ??= {};
  const currentEnemyIds = Array.isArray(next.current_enemy_character_ids)
    ? next.current_enemy_character_ids.map((id) => String(id ?? '').trim()).filter(Boolean)
    : [];
  if (established) {
    next.characters[characterId] ??= { flags: {} };
    next.characters[characterId].flags ??= {};
    next.characters[characterId].flags[enemyFlagId(characterId)] = true;
    next.current_enemy_character_ids = [...new Set([...currentEnemyIds, characterId])];
  } else {
    next.current_enemy_character_ids = currentEnemyIds;
  }
  return next;
}

function scoreRecordForInput(record, playerInput) {
  const input = String(playerInput ?? '').toLowerCase();
  if (!input) return 0;
  const source = `${record.title}\n${record.body}\n${record.tags?.join(' ') ?? ''}`.toLowerCase();
  const tokens = Array.from(new Set(input.match(/[\p{Letter}\p{Number}_]+/gu) ?? [])).filter((token) => token.length >= 2);
  return tokens.reduce((score, token) => score + (source.includes(token) ? token.length : 0), 0);
}

export function selectRelevantWorkRecords(workRecords, playerInput, limit = 3) {
  return workRecords
    .map((record, index) => ({ record, index, score: scoreRecordForInput(record, playerInput) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit)
    .map((item) => item.record);
}

async function readConversationIfExists(root, conversationId) {
  if (!conversationId) return null;
  return readJsonIfExists(root, conversationLogPath(conversationId));
}

function resolveActiveConversation({ state, characterId, providedId, conversation }) {
  if (conversation?.discarded_after_work_record_id) return null;
  if (providedId) return conversation?.character_id === characterId && conversation.id === providedId ? conversation : null;
  if (conversation?.character_id === characterId && state.current_interaction_character_id === characterId) return conversation;
  return null;
}

function enrichEventContextWithSourceWorkRecord(eventContext, allWorkRecords) {
  if (!eventContext || typeof eventContext !== 'object') return null;
  const sourceConversationId = String(eventContext.source_conversation_id ?? '').trim();
  const sourceWorkRecordId = sourceConversationId ? `wr_${sourceConversationId}` : '';
  const sourceWorkRecord = allWorkRecords.find((record) => record.id === sourceWorkRecordId);
  if (!sourceWorkRecord?.body) return { ...eventContext };
  return {
    ...eventContext,
    source_work_record_id: sourceWorkRecord.id,
    source_work_record_body: sourceWorkRecord.body
  };
}

export async function startInteractionSession({ root, characterId = 'lina' }) {
  if (!root) throw new Error('root is required');
  const state = await readJson(root, 'game_data/runtime_state.json');
  const nextState = JSON.parse(JSON.stringify(state));
  nextState.current_screen = 'interaction';
  nextState.current_interaction_character_id = characterId;
  nextState.last_conversation_id = null;
  nextState.pending_interaction_context = null;
  await writeJson(root, 'game_data/runtime_state.json', nextState);
  return { state: nextState };
}

async function loadConversationContext({ root, characterId, state, playerInput = '' }) {
  const [locations, profile, flags, skillsFile, memories, allWorkRecords, previousConversation, world] = await Promise.all([
    readJson(root, 'game_data/locations.json'),
    readJson(root, `game_data/characters/${characterId}/profile.json`),
    readJson(root, `game_data/characters/${characterId}/flags.json`),
    readSkillsFile(root, characterId),
    listJson(root, `game_data/characters/${characterId}/memory`),
    listMarkdownRecords(root, `game_data/characters/${characterId}/work_records`),
    readConversationIfExists(root, state.last_conversation_id),
    loadWorldSettings({ root })
  ]);
  state.characters ??= {};
  state.characters[characterId] ??= { flags };
  state.characters[characterId].flags = { ...flags, ...(state.characters[characterId].flags ?? {}) };

  const activeConversation = resolveActiveConversation({ state, characterId, conversation: previousConversation });
  const currentConversation = activeConversation?.messages ?? [];
  const pendingRecallIds = pendingRecalledWorkRecordIds(activeConversation, allWorkRecords);
  const pendingRecallRecords = allWorkRecords.filter((record) => pendingRecallIds.includes(record.id));
  const selectedWorkRecords = mergeWorkRecordsById(
    selectRelevantWorkRecords(allWorkRecords, playerInput),
    pendingRecallRecords
  );
  const continuityPromptContext = buildContinuityPromptContext({
    memories,
    workRecords: selectedWorkRecords,
    allWorkRecords
  });
  const location = locations.find((item) => item.id === state.current_location_id);
  const eventContext = state.current_interaction_character_id === characterId
    ? enrichEventContextWithSourceWorkRecord(state.pending_interaction_context ?? null, allWorkRecords)
    : null;
  return {
    profile,
    location,
    world,
    skillsFile,
    memories: continuityPromptContext.memoriesForPrompt,
    activeConversation,
    currentConversation,
    selectedWorkRecords: continuityPromptContext.workRecordsForPrompt,
    eventContext
  };
}

export async function runConversationOpening({
  root,
  id,
  characterId = 'lina',
  now = new Date().toISOString(),
  chatProvider = defaultChatProvider,
  onAssistantComplete
}) {
  if (!root) throw new Error('root is required');
  const requestedConversationId = id == null ? null : assertValidConversationId(id);

  const state = await readJson(root, 'game_data/runtime_state.json');
  const context = await loadConversationContext({ root, characterId, state });
  if (!requestedConversationId && context.activeConversation?.messages?.length) return { conversation: context.activeConversation, state };

  const prompt = buildCharacterPrompt({
    profile: context.profile,
    scene: {
      academy_name: context.world?.academy_name ?? '星灯魔法学院',
      world_description: context.world?.world_description ?? '',
      player_name: context.world?.player_name ?? '主人公',
      player_parameters: context.world?.player_parameters,
      location_name: context.location?.display_name ?? state.current_location_id,
      visible_situation: state.current_location_visible_situation ?? context.location?.visible_situation ?? ''
    },
    memories: context.memories,
    skills: context.skillsFile.skills ?? [],
    workRecords: context.selectedWorkRecords,
    currentConversation: [],
    eventContext: context.eventContext,
    playerInput: null,
    openingTurn: true
  });

  const assistantText = await chatProvider({ prompt, state, profile: context.profile, playerInput: null });
  onAssistantComplete?.({ content: assistantText });
  const academyWeekSnapshot = academyWeekSnapshotFromState(state);
  const conversation = {
    id: requestedConversationId ?? assertValidConversationId(makeConversationId(now)),
    character_id: characterId,
    character_name: context.profile.display_name,
    created_at: now,
    updated_at: now,
    academy_week_number: academyWeekSnapshot.academy_week_number,
    academy_elapsed_weeks_at_start: academyWeekSnapshot.academy_elapsed_weeks_at_start,
    source_type: state.pending_interaction_context?.source_type ?? 'field',
    event_flag_id: state.pending_interaction_context?.event_flag_id ?? null,
    event_label: state.pending_interaction_context?.event_label ?? null,
    source_conversation_id: state.pending_interaction_context?.source_conversation_id ?? null,
    location_id: state.current_location_id,
    time_slot: state.time_slot,
    prompt,
    messages: [{ role: 'assistant', content: assistantText }]
  };
  await writeJson(root, conversationLogPath(conversation.id), conversation);

  const nextState = JSON.parse(JSON.stringify(state));
  nextState.last_conversation_id = conversation.id;
  nextState.current_screen = 'interaction';
  nextState.current_interaction_character_id = characterId;
  await writeJson(root, 'game_data/runtime_state.json', nextState);

  return { conversation, state: nextState };
}

export async function editConversationUserMessage({
  root,
  characterId = 'lina',
  messageIndex,
  content,
  now = new Date().toISOString(),
  chatProvider = defaultChatProvider,
  emotionProvider = defaultEmotionProvider,
  workRecordRecallProvider = defaultWorkRecordRecallProvider,
  promptPrewarmProvider = defaultPromptPrewarmProvider,
  conversationContinuationProvider = defaultConversationContinuationProvider,
  conversationCutoffProvider = defaultConversationCutoffProvider
}) {
  if (!root) throw new Error('root is required');
  const normalizedIndex = Math.trunc(Number(messageIndex));
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) throw new Error('messageIndex must be a non-negative integer');
  const playerInput = String(content ?? '').trim();
  if (!playerInput) throw new Error('content is required');

  const inventory = await loadInventory({ root });
  if (!(inventory.items ?? []).some((item) => item.item_id === CONVERSATION_EDIT_ITEM_ID && Number(item.quantity ?? 0) > 0)) {
    throw new Error('conversation_edit_item_required');
  }

  const state = await readJson(root, 'game_data/runtime_state.json');
  const previousConversation = await readConversationIfExists(root, state.last_conversation_id);
  const activeConversation = resolveActiveConversation({ state, characterId, conversation: previousConversation });
  if (!activeConversation) throw new Error('active conversation not found');
  const previousMessages = activeConversation.messages ?? [];
  if (!previousMessages[normalizedIndex] || previousMessages[normalizedIndex].role !== 'user') throw new Error('messageIndex must point to a user message');

  const rewoundConversation = {
    ...activeConversation,
    updated_at: now,
    messages: previousMessages.slice(0, normalizedIndex)
  };
  await writeJson(root, conversationLogPath(activeConversation.id), rewoundConversation);

  const result = await runConversationTurn({
    root,
    id: activeConversation.id,
    characterId,
    playerInput,
    now,
    chatProvider,
    emotionProvider,
    workRecordRecallProvider,
    promptPrewarmProvider,
    conversationContinuationProvider,
    conversationCutoffProvider
  });
  return {
    ...result,
    edited_message_index: normalizedIndex,
    rewound_from_message_count: previousMessages.length
  };
}

export async function runConversationTurn({
  root,
  id,
  characterId = 'lina',
  playerInput,
  now = new Date().toISOString(),
  chatProvider = defaultChatProvider,
  emotionProvider = defaultEmotionProvider,
  workRecordRecallProvider = defaultWorkRecordRecallProvider,
  promptPrewarmProvider = defaultPromptPrewarmProvider,
  conversationContinuationProvider = defaultConversationContinuationProvider,
  conversationCutoffProvider = defaultConversationCutoffProvider,
  onEmotion,
  onAssistantComplete
}) {
  if (!root) throw new Error('root is required');
  if (!playerInput) throw new Error('playerInput is required');
  const requestedConversationId = id == null ? null : assertValidConversationId(id);

  const state = await readJson(root, 'game_data/runtime_state.json');
  const [locations, profile, flags, skillsFile, memories, allWorkRecords, previousConversation, world] = await Promise.all([
    readJson(root, 'game_data/locations.json'),
    readJson(root, `game_data/characters/${characterId}/profile.json`),
    readJson(root, `game_data/characters/${characterId}/flags.json`),
    readSkillsFile(root, characterId),
    listJson(root, `game_data/characters/${characterId}/memory`),
    listMarkdownRecords(root, `game_data/characters/${characterId}/work_records`),
    readConversationIfExists(root, state.last_conversation_id),
    loadWorldSettings({ root })
  ]);
  state.characters ??= {};
  state.characters[characterId] ??= { flags };
  state.characters[characterId].flags = { ...flags, ...(state.characters[characterId].flags ?? {}) };

  const activeConversation = resolveActiveConversation({ state, characterId, providedId: requestedConversationId, conversation: previousConversation });
  const currentConversation = activeConversation?.messages ?? [];
  const pendingRecallEntries = normalizePendingRecalledWorkRecords(activeConversation, allWorkRecords);
  const pendingRecallIds = pendingRecallEntries.map((entry) => entry.id);
  const pendingRecallRecords = allWorkRecords.filter((record) => pendingRecallIds.includes(record.id));
  const selectedWorkRecords = mergeWorkRecordsById(
    selectRelevantWorkRecords(allWorkRecords, playerInput),
    pendingRecallRecords
  );
  const continuityPromptContext = buildContinuityPromptContext({
    memories,
    workRecords: selectedWorkRecords,
    allWorkRecords
  });
  const location = locations.find((item) => item.id === state.current_location_id);
  const promptArgs = {
    profile,
    scene: {
      academy_name: world?.academy_name ?? '星灯魔法学院',
      world_description: world?.world_description ?? '',
      player_name: world?.player_name ?? '主人公',
      player_parameters: world?.player_parameters,
      location_name: location?.display_name ?? state.current_location_id,
      visible_situation: state.current_location_visible_situation ?? location?.visible_situation ?? ''
    },
    memories: continuityPromptContext.memoriesForPrompt,
    skills: skillsFile.skills ?? [],
    workRecords: continuityPromptContext.workRecordsForPrompt,
    currentConversation,
    eventContext: state.current_interaction_character_id === characterId
      ? enrichEventContextWithSourceWorkRecord(state.pending_interaction_context ?? null, allWorkRecords)
      : null,
    playerInput
  };
  const prompt = buildCharacterPrompt(promptArgs);

  const emotionPrompt = buildCharacterPrompt({ ...promptArgs, turnType: 'emotion_choice' });
  const emotion = normalizeEmotionChoice(await emotionProvider({ prompt: emotionPrompt, state, profile, playerInput, currentConversation }));
  onEmotion?.(emotion);

  const generatedAssistantText = await chatProvider({ prompt, state, profile, playerInput, emotion });
  onAssistantComplete?.({ content: generatedAssistantText, emotion });
  const provisionalMessages = [
    ...currentConversation,
    { role: 'user', content: playerInput },
    { role: 'assistant', content: generatedAssistantText, ...emotion }
  ];
  const continuationPrompt = buildCharacterPrompt({
    ...promptArgs,
    turnType: 'conversation_continuation_judgment'
  });
  const continuationModelResponse = await conversationContinuationProvider({
    prompt: continuationPrompt,
    state,
    profile,
    playerInput,
    generatedAssistantText,
    currentConversation: provisionalMessages
  });
  const continueConversation = normalizeBooleanChoice(continuationModelResponse, true);
  const cutoffPrompt = continueConversation ? null : buildCharacterPrompt({
    ...promptArgs,
    turnType: 'conversation_cutoff_reply',
    generatedAssistantText
  });
  const cutoffAssistantText = continueConversation ? null : await conversationCutoffProvider({
    prompt: cutoffPrompt,
    state,
    profile,
    playerInput,
    emotion,
    generatedAssistantText,
    currentConversation: provisionalMessages
  });
  if (cutoffAssistantText) {
    onAssistantComplete?.({ content: cutoffAssistantText, emotion });
  }
  const nextMessages = continueConversation ? provisionalMessages : [
    ...provisionalMessages,
    { role: 'assistant', content: cutoffAssistantText, ...emotion }
  ];
  const candidateWorkRecordIds = uniqueExistingWorkRecordIds(
    linkedWorkRecordIdsFromContinuity({ memories, skills: skillsFile.skills ?? [] }),
    allWorkRecords
  );
  const recallPromptArgs = { ...promptArgs, currentConversation: nextMessages, playerInput: null };
  const recallPrompt = buildCharacterPrompt({
    ...recallPromptArgs,
    turnType: 'work_record_recall',
    candidateWorkRecordIds
  });
  const recallDecision = candidateWorkRecordIds.length > 0
    ? await workRecordRecallProvider({
      prompt: recallPrompt,
      state,
      profile,
      currentConversation: nextMessages,
      memories,
      candidateWorkRecordIds
    })
    : { work_record_ids: [] };
  const allowedRecallIds = new Set(candidateWorkRecordIds);
  const recalledWorkRecordIds = uniqueExistingWorkRecordIds(recallDecision?.work_record_ids ?? recallDecision?.workRecordIds ?? [], allWorkRecords)
    .filter((id) => allowedRecallIds.has(id));
  const recalledWorkRecords = allWorkRecords.filter((record) => recalledWorkRecordIds.includes(record.id));
  const enrichedWorkRecords = mergeWorkRecordsById(continuityPromptContext.workRecordsForPrompt, recalledWorkRecords);
  const prewarmPrompt = recalledWorkRecords.length > 0
    ? buildCharacterPrompt({
      ...recallPromptArgs,
      workRecords: enrichedWorkRecords,
      turnType: 'prefix_prewarm'
    })
    : null;
  const prewarmText = prewarmPrompt
    ? await promptPrewarmProvider({
      prompt: prewarmPrompt,
      state,
      profile,
      currentConversation: nextMessages,
      recalledWorkRecords
    })
    : null;
  const retainedPendingRecallRecords = updatePendingRecalledWorkRecordsAfterTurn({
    pendingEntries: pendingRecallEntries,
    recalledIds: recalledWorkRecordIds
  });
  const academyWeekSnapshot = academyWeekSnapshotForConversation({ conversation: activeConversation, state });
  const conversation = {
    id: activeConversation?.id ?? requestedConversationId ?? assertValidConversationId(makeConversationId(now)),
    character_id: characterId,
    character_name: activeConversation?.character_name ?? profile.display_name,
    created_at: activeConversation?.created_at ?? now,
    updated_at: now,
    academy_week_number: academyWeekSnapshot.academy_week_number,
    academy_elapsed_weeks_at_start: academyWeekSnapshot.academy_elapsed_weeks_at_start,
    source_type: activeConversation?.source_type ?? state.pending_interaction_context?.source_type ?? 'field',
    event_flag_id: activeConversation?.event_flag_id ?? state.pending_interaction_context?.event_flag_id ?? null,
    event_label: activeConversation?.event_label ?? state.pending_interaction_context?.event_label ?? null,
    source_conversation_id: activeConversation?.source_conversation_id ?? state.pending_interaction_context?.source_conversation_id ?? null,
    location_id: activeConversation?.location_id ?? state.current_location_id,
    time_slot: activeConversation?.time_slot ?? state.time_slot,
    prompt,
    conversation_continuation: {
      prompt: continuationPrompt,
      model_response: continuationModelResponse,
      continue_conversation: continueConversation,
      generated_assistant_text: generatedAssistantText,
      cutoff_prompt: cutoffPrompt,
      cutoff_assistant_text: cutoffAssistantText
    },
    work_record_recall: {
      candidate_work_record_ids: candidateWorkRecordIds,
      recalled_work_record_ids: recalledWorkRecordIds,
      prompt: recallPrompt,
      model_response: recallDecision
    },
    pending_recalled_work_record_ids: retainedPendingRecallRecords.map((entry) => entry.id),
    pending_recalled_work_records: retainedPendingRecallRecords,
    next_prompt_cache: prewarmPrompt ? {
      recalled_work_record_ids: recalledWorkRecordIds,
      prompt: prewarmPrompt,
      prewarm_text: prewarmText
    } : null,
    messages: nextMessages
  };
  await writeJson(root, conversationLogPath(conversation.id), conversation);

  const nextState = JSON.parse(JSON.stringify(state));
  nextState.last_conversation_id = conversation.id;
  nextState.current_screen = 'interaction';
  nextState.current_interaction_character_id = characterId;
  await writeJson(root, 'game_data/runtime_state.json', nextState);

  return { conversation, state: nextState };
}

async function appendSkillRecord({ root, characterId, skillRecord }) {
  const relativePath = `game_data/characters/${characterId}/skills.json`;
  const skillsFile = await readSkillsFile(root, characterId);
  const staticSkills = (skillsFile.skills ?? []).filter((skill) => skill.type !== 'self_change');
  const dynamicSkills = (skillsFile.skills ?? []).filter((skill) => skill.type === 'self_change' && skill.id !== skillRecord.id);
  const nextDynamicSkills = [...dynamicSkills, skillRecord].slice(-CONTINUITY_RECORD_LIMIT);
  const next = { ...skillsFile, skills: [...staticSkills, ...nextDynamicSkills] };
  await writeJson(root, relativePath, next);
}

async function discardConversationContent({ root, conversation, workRecordId, academyWeekSnapshot }) {
  await writeJson(root, conversationLogPath(conversation.id), {
    id: conversation.id,
    character_id: conversation.character_id,
    character_name: conversation.character_name,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    academy_week_number: academyWeekSnapshot.academy_week_number,
    academy_elapsed_weeks_at_start: academyWeekSnapshot.academy_elapsed_weeks_at_start,
    source_type: conversation.source_type ?? 'field',
    location_id: conversation.location_id,
    time_slot: conversation.time_slot,
    discarded_after_work_record_id: workRecordId,
    message_count: conversation.messages.length,
    prompt_discarded: true,
    messages: []
  });
}

function mergeConcurrentTrainingState(nextState, latestState) {
  if (!latestState || typeof latestState !== 'object') return nextState;
  const latestHasTrainingProgress = latestState.training_actions_used !== undefined || latestState.training_actions_limit !== undefined;
  if (!latestHasTrainingProgress) return nextState;
  const trainingScreens = new Set(['training', 'academy-training', 'academy-map']);
  const merged = {
    ...nextState,
    training_actions_used: latestState.training_actions_used,
    training_actions_limit: latestState.training_actions_limit ?? nextState.training_actions_limit
  };
  if (trainingScreens.has(latestState.current_screen) && latestState.current_interaction_character_id == null) {
    merged.current_screen = latestState.current_screen;
  }
  return merged;
}

function mergeConcurrentProgressionState(nextState, latestState) {
  if (!latestState || typeof latestState !== 'object') return nextState;
  const merged = { ...nextState };
  const latestElapsedWeeks = Number.isFinite(latestState.elapsed_weeks) ? latestState.elapsed_weeks : null;
  const nextElapsedWeeks = Number.isFinite(nextState.elapsed_weeks) ? nextState.elapsed_weeks : null;
  if (latestElapsedWeeks !== null || nextElapsedWeeks !== null) {
    if (latestElapsedWeeks === null) {
      merged.elapsed_weeks = nextElapsedWeeks;
    } else if (nextElapsedWeeks === null) {
      merged.elapsed_weeks = latestElapsedWeeks;
    } else {
      merged.elapsed_weeks = Math.max(nextElapsedWeeks, latestElapsedWeeks);
    }
  }
  if (merged.ending_started === undefined && latestState.ending_started !== undefined) {
    merged.ending_started = latestState.ending_started;
  }
  if (merged.ending_completed === undefined && latestState.ending_completed !== undefined) {
    merged.ending_completed = latestState.ending_completed;
  }
  if (latestState.ending_started === true) merged.ending_started = true;
  if (latestState.ending_completed === true) merged.ending_completed = true;
  if (
    latestState.ending_character_id != null
    && (latestState.ending_started === true || latestState.ending_completed === true || merged.ending_started === true || merged.ending_completed === true)
  ) {
    merged.ending_character_id = latestState.ending_character_id;
  }
  return merged;
}

function mergeConcurrentInteractionState(nextState, latestState, finalizedConversationId = null) {
  if (!latestState || typeof latestState !== 'object') return nextState;
  if (latestState.current_interaction_character_id == null) return nextState;
  if (finalizedConversationId && latestState.last_conversation_id === finalizedConversationId) return nextState;
  const merged = {
    ...nextState,
    current_screen: latestState.current_screen ?? nextState.current_screen,
    current_location_id: latestState.current_location_id ?? nextState.current_location_id,
    current_location_visible_situation: latestState.current_location_visible_situation ?? nextState.current_location_visible_situation,
    current_interaction_character_id: latestState.current_interaction_character_id,
    pending_interaction_context: latestState.pending_interaction_context ?? null,
    last_conversation_id: latestState.last_conversation_id ?? nextState.last_conversation_id
  };
  if (latestState.pending_destination_stage_event) {
    merged.pending_destination_stage_event = structuredClone(latestState.pending_destination_stage_event);
  }
  if (nextState.global_flags || latestState.global_flags) {
    merged.global_flags = {
      ...(latestState.global_flags ?? {}),
      ...(nextState.global_flags ?? {})
    };
  }
  if (nextState.event_flag_sources || latestState.event_flag_sources) {
    merged.event_flag_sources = {
      ...(latestState.event_flag_sources ?? {}),
      ...(nextState.event_flag_sources ?? {})
    };
  }
  if (nextState.event_completion_sources || latestState.event_completion_sources) {
    merged.event_completion_sources = {
      ...(latestState.event_completion_sources ?? {}),
      ...(nextState.event_completion_sources ?? {})
    };
  }
  return merged;
}

export async function finalizeConversation({
  root,
  conversationId,
  characterId = 'lina',
  now = new Date().toISOString(),
  memoryUpdateProvider = defaultMemoryUpdateProvider,
  skillNecessityProvider = defaultSkillNecessityProvider,
  skillUpdateProvider = defaultSkillUpdateProvider,
  workRecordProvider = defaultWorkRecordProvider,
  stageFlagJudgmentProvider = defaultStageFlagJudgmentProvider,
  eventFlagJudgmentProvider = defaultEventFlagJudgmentProvider,
  eventCompletionJudgmentProvider = defaultEventCompletionJudgmentProvider,
  eventParticipantOverrideJudgmentProvider = defaultEventParticipantOverrideJudgmentProvider,
  moneyDeltaProvider = defaultMoneyDeltaProvider,
  buddyAgreementProvider = defaultBuddyAgreementProvider,
  enemyHostilityProvider = defaultEnemyHostilityProvider,
  destinationStageProvider = defaultDestinationStageProvider,
  finalStateTransform = null
}) {
  if (!root) throw new Error('root is required');
  if (!conversationId) throw new Error('conversationId is required');
  const normalizedConversationId = assertValidConversationId(conversationId);

  const state = await readJson(root, 'game_data/runtime_state.json');
  const conversation = await readJson(root, conversationLogPath(normalizedConversationId));
  const locations = await readJson(root, 'game_data/locations.json');
  if (conversation.discarded_after_work_record_id) throw new Error(`conversation already finalized: ${normalizedConversationId}`);
  const workRecordId = `wr_${conversation.id}`;
  const academyWeekSnapshot = academyWeekSnapshotForConversation({ conversation, state });

  const [memoryUpdate, skillNecessity, workRecordUpdate] = await Promise.all([
    memoryUpdateProvider({ conversation, state, workRecordId, now }),
    skillNecessityProvider({ conversation, state, workRecordId, now }),
    workRecordProvider({ conversation, state, workRecordId, now })
  ]);
  const normalizedSkillNecessity = {
    necessary: skillNecessity?.necessary === true ? true : skillNecessity?.necessary === false ? false : null,
    raw_answer: String(skillNecessity?.raw_answer ?? '').trim(),
    source_conversation_id: conversation.id,
    work_record_id: workRecordId
  };
  const skillUpdate = normalizedSkillNecessity.necessary === true
    ? await skillUpdateProvider({ conversation, state, workRecordId, now })
    : {
      skipped: true,
      reason: normalizedSkillNecessity.necessary === false ? 'no_decisive_behavior_change' : 'invalid_skill_necessity_answer',
      raw_answer: normalizedSkillNecessity.raw_answer,
      source_conversation_id: conversation.id,
      work_record_id: workRecordId
    };
  await writeJson(root, `game_data/logs/memory_updates/${conversation.id}.json`, memoryUpdate);
  await writeJson(root, `game_data/logs/skill_updates/${conversation.id}.json`, skillUpdate);
  await writeJson(root, `game_data/logs/work_record_updates/${conversation.id}.json`, workRecordUpdate);

  const memoryRecord = normalizeMemoryRecordForSave({ memoryUpdate, conversation, workRecordId });
  const skillRecord = skillUpdate.skipped ? null : { ...(skillUpdate.skill_record ?? skillUpdate), visibility: 'character_known', source_conversation_id: conversation.id, work_record_id: workRecordId };
  const workRecordDraft = {
    ...(workRecordUpdate.work_record ?? workRecordUpdate),
    id: workRecordId,
    source_conversation_id: conversation.id,
    work_record_id: workRecordId,
    academy_week_number: academyWeekSnapshot.academy_week_number,
    academy_elapsed_weeks_at_start: academyWeekSnapshot.academy_elapsed_weeks_at_start
  };
  const validator = validateConversationRecordUpdates({
    sourceType: 'dialogue',
    state,
    memoryRecord,
    skillRecord,
    workRecordDraft,
    flagUpdateCandidates: workRecordDraft.flag_update_candidates ?? workRecordUpdate.flag_update_candidates ?? []
  });
  await writeJson(root, `game_data/logs/validator/${conversation.id}.json`, validator);

  const acceptedMemory = validator.accepted_memory[0] ?? null;
  const acceptedSkill = validator.accepted_skills[0] ?? null;
  if (acceptedMemory) {
    await writeJson(root, `game_data/characters/${acceptedMemory.character_id}/memory/${acceptedMemory.id}.json`, acceptedMemory);
    await pruneFilesToLimit(root, `game_data/characters/${acceptedMemory.character_id}/memory`, '.json');
  }
  if (acceptedSkill) await appendSkillRecord({ root, characterId: acceptedSkill.character_id, skillRecord: acceptedSkill });

  const stageFlagJudgment = await judgeStageFlagsAfterConversation({
    root,
    state,
    conversation,
    workRecordId,
    stageFlagJudgmentProvider,
    now
  });
  const stateAfterCommittedStageFlags = applyAcceptedStageFlags(state, stageFlagJudgment);
  if ((stageFlagJudgment.accepted?.length ?? 0) > 0) {
    await writeJson(root, 'game_data/runtime_state.json', stateAfterCommittedStageFlags);
  }
  const stageRewardUpdate = await grantInventoryRewards({
    root,
    rewards: collectAcceptedStageFlagRewards(stageFlagJudgment)
  });
  await writeJson(root, `game_data/logs/stage_reward_updates/${conversation.id}.json`, {
    conversation_id: conversation.id,
    work_record_id: workRecordId,
    granted_rewards: stageRewardUpdate.granted_rewards,
    before_inventory: stageRewardUpdate.before_inventory,
    inventory: stageRewardUpdate.inventory,
    updated_at: now
  });

  const currentInventory = stageRewardUpdate.inventory;
  const eventFlagJudgment = await judgeEventFlagsAfterConversation({
    root,
    state: applyAcceptedStageFlags(applyAcceptedFlags(state, validator), stageFlagJudgment),
    inventory: currentInventory,
    conversation,
    workRecordId,
    eventFlagJudgmentProvider,
    now
  });
  const stateAfterStageAndEvent = applyAcceptedEventFlags(applyAcceptedStageFlags(applyAcceptedFlags(state, validator), stageFlagJudgment), eventFlagJudgment);
  const eventParticipantOverrideJudgment = await judgeEventParticipantOverridesAfterConversation({
    root,
    state: stateAfterStageAndEvent,
    inventory: currentInventory,
    conversation,
    workRecordId,
    eventParticipantOverrideJudgmentProvider,
    now
  });
  const stateAfterParticipantOverrides = applyAcceptedEventParticipantOverrides(stateAfterStageAndEvent, eventParticipantOverrideJudgment);
  const eventCompletionJudgment = await judgeEventCompletionsAfterConversation({
    root,
    state: stateAfterParticipantOverrides,
    conversation,
    workRecordId,
    eventCompletionJudgmentProvider,
    now
  });
  const moneyDeltaPrompt = buildMoneyDeltaPrompt({ conversation, workRecordId, currentMoney: currentInventory.money });
  const rawMoneyDelta = await moneyDeltaProvider({
    prompt: moneyDeltaPrompt,
    conversation,
    state,
    workRecordId,
    now,
    currentMoney: currentInventory.money
  });
  const moneyDelta = parseMoneyDeltaAnswer(rawMoneyDelta);
  const moneyUpdatePath = `game_data/logs/money_updates/${conversation.id}.json`;
  const appliedMoney = await applyPlayerMoneyDelta({ root, conversationId: conversation.id, delta: moneyDelta });
  const priorMoneyUpdate = appliedMoney.already_applied
    ? await readJsonIfExists(root, moneyUpdatePath)
    : null;
  const moneyUpdate = {
    conversation_id: conversation.id,
    work_record_id: workRecordId,
    raw_answer: String(rawMoneyDelta ?? '').trim(),
    delta: priorMoneyUpdate?.delta ?? appliedMoney.delta,
    before_money: priorMoneyUpdate?.before_money ?? appliedMoney.before_money,
    after_money: priorMoneyUpdate?.after_money ?? appliedMoney.after_money,
    already_applied: appliedMoney.already_applied === true,
    prompt: moneyDeltaPrompt,
    updated_at: now
  };
  await writeJson(root, moneyUpdatePath, moneyUpdate);

  const buddyPrompt = buildBuddyAgreementPrompt({ conversation, workRecordId });
  const rawBuddyAgreement = await buddyAgreementProvider({
    prompt: buddyPrompt,
    conversation,
    state,
    workRecordId,
    now,
    characterId: conversation.character_id,
    characterName: conversation.character_name ?? null
  });
  const buddyEstablished = parseBooleanOnlyAnswer(rawBuddyAgreement);
  const buddyUpdate = {
    conversation_id: conversation.id,
    work_record_id: workRecordId,
    character_id: conversation.character_id,
    character_name: conversation.character_name ?? null,
    flag: buddyFlagId(conversation.character_id),
    established: buddyEstablished,
    raw_answer: String(rawBuddyAgreement ?? '').trim(),
    prompt: buddyPrompt,
    updated_at: now
  };
  await writeJson(root, `game_data/logs/buddy_updates/${conversation.id}.json`, buddyUpdate);

  const enemyPrompt = buildEnemyHostilityPrompt({ conversation, workRecordId });
  const rawEnemyHostility = await enemyHostilityProvider({
    prompt: enemyPrompt,
    conversation,
    state,
    workRecordId,
    now,
    characterId: conversation.character_id,
    characterName: conversation.character_name ?? null
  });
  const enemyEstablished = parseBooleanOnlyAnswer(rawEnemyHostility);
  const enemyUpdate = {
    conversation_id: conversation.id,
    work_record_id: workRecordId,
    character_id: conversation.character_id,
    character_name: conversation.character_name ?? null,
    flag: enemyFlagId(conversation.character_id),
    established: enemyEstablished,
    raw_answer: String(rawEnemyHostility ?? '').trim(),
    prompt: enemyPrompt,
    updated_at: now
  };
  await writeJson(root, `game_data/logs/enemy_updates/${conversation.id}.json`, enemyUpdate);

  const destinationCandidates = selectableDestinationLocations({
    locations,
    currentLocationId: conversation.location_id ?? state.current_location_id ?? null
  });
  const destinationStagePrompt = buildDestinationStagePrompt({
    conversation,
    workRecordId,
    destinations: destinationCandidates
  });
  const rawDestinationStage = await destinationStageProvider({
    prompt: destinationStagePrompt,
    conversation,
    state,
    workRecordId,
    now,
    destinations: destinationCandidates
  });
  const agreedDestination = parseDestinationStageAnswer(rawDestinationStage, destinationCandidates);
  const destinationStageUpdate = {
    conversation_id: conversation.id,
    work_record_id: workRecordId,
    raw_answer: String(rawDestinationStage ?? '').trim(),
    prompt: destinationStagePrompt,
    location_id: agreedDestination?.location_id ?? null,
    location_name: agreedDestination?.location_name ?? null,
    flag_id: agreedDestination ? `event.destination_stage.${conversation.id}.ready` : null,
    completed_flag_id: agreedDestination ? `event.destination_stage.${conversation.id}.completed` : null,
    updated_at: now
  };
  await writeJson(root, `game_data/logs/destination_stage_updates/${conversation.id}.json`, destinationStageUpdate);

  let nextState = applyEnemyHostilityToState(applyBuddyAgreementToState(applyAcceptedEventCompletions(stateAfterParticipantOverrides, eventCompletionJudgment), {
    characterId: conversation.character_id,
    established: buddyEstablished
  }), {
    characterId: conversation.character_id,
    established: enemyEstablished
  });
  nextState.last_conversation_id = conversation.id;
  nextState.current_screen = 'academy-room';
  nextState.current_interaction_character_id = null;
  nextState.pending_interaction_context = null;
  if (agreedDestination) {
    nextState = applyDestinationStageToState(nextState, {
      conversation,
      location: agreedDestination,
      now
    });
  }
  if (typeof finalStateTransform === 'function') {
    nextState = finalStateTransform(nextState);
  }
  if (validator.accepted_work_record) {
    const markdown = renderWorkRecordMarkdown({
      id: workRecordId,
      draft: validator.accepted_work_record
    });
    await writeText(root, `game_data/characters/${characterId}/work_records/${workRecordId}.md`, markdown);
    await pruneFilesToLimit(root, `game_data/characters/${characterId}/work_records`, '.md');
  }

  const buddyFlagWriteIds = [...new Set([
    characterId,
    state.current_buddy_character_id,
    nextState.current_buddy_character_id,
    ...(Array.isArray(state.current_enemy_character_ids) ? state.current_enemy_character_ids : []),
    ...(Array.isArray(nextState.current_enemy_character_ids) ? nextState.current_enemy_character_ids : [])
  ].filter(Boolean))];
  await Promise.all(buddyFlagWriteIds.map(async (targetCharacterId) => {
    if (!nextState.characters?.[targetCharacterId]?.flags) return;
    await writeJson(root, `game_data/characters/${targetCharacterId}/flags.json`, nextState.characters[targetCharacterId].flags);
  }));
  const latestState = await readJson(root, 'game_data/runtime_state.json');
  nextState = mergeConcurrentTrainingState(nextState, latestState);
  nextState = mergeConcurrentProgressionState(nextState, latestState);
  nextState = mergeConcurrentInteractionState(nextState, latestState, conversation.id);
  if (typeof finalStateTransform === 'function') {
    nextState = finalStateTransform(nextState);
  }
  await writeJson(root, 'game_data/runtime_state.json', nextState);
  if (validator.accepted_work_record) {
    await discardConversationContent({ root, conversation, workRecordId, academyWeekSnapshot });
  }

  return { conversation, memory_update: memoryUpdate, skill_update: skillUpdate, work_record_update: workRecordUpdate, stage_reward_update: stageRewardUpdate, money_update: moneyUpdate, buddy_update: buddyUpdate, enemy_update: enemyUpdate, destination_stage_update: destinationStageUpdate, validator, stage_flags: stageFlagJudgment, event_flags: eventFlagJudgment, event_participant_overrides: eventParticipantOverrideJudgment, event_completions: eventCompletionJudgment, state: nextState };
}

export async function getContinuityRecordStatus({ root, characterId = 'lina' }) {
  if (!root) throw new Error('root is required');
  const state = await readJson(root, 'game_data/runtime_state.json');
  const [memories, skillsFile, workRecords] = await Promise.all([
    listJson(root, `game_data/characters/${characterId}/memory`),
    readSkillsFile(root, characterId),
    listMarkdownRecords(root, `game_data/characters/${characterId}/work_records`)
  ]);
  const skillRecords = (skillsFile.skills ?? []).filter((skill) => skill.type === 'self_change');
  const activeConversation = state.current_interaction_character_id === characterId
    ? await readConversationIfExists(root, state.last_conversation_id)
    : null;
  const lastConversationId = state.last_conversation_id ?? null;
  return {
    character_id: characterId,
    responsibilities: {
      memory: '主人公との関係性変化と、それがどの経験・会話から生じたかを5文以下で保持する。',
      skills: 'キャラクター自身の変化と、それがどの経験・会話から生じたかを1文で保持する。Hermes Agentのスキルではなくゲーム内キャラクター技能・変化記録である。',
      work_records: 'その会話セッションで行われたやり取りを20文以下のサマリとして保持する。全文ログではなく、作成後は会話セッション本文を破棄する。'
    },
    limits: { memory: CONTINUITY_RECORD_LIMIT, skills: CONTINUITY_RECORD_LIMIT, work_records: CONTINUITY_RECORD_LIMIT, per_conversation_session: 1 },
    records: {
      memory: {
        count: memories.length,
        latest_ids: memories.slice(-5).map((memory) => memory.id),
        linked_work_record_ids: memories.slice(-5).map((memory) => memory.work_record_id).filter(Boolean),
        items: memories.slice(-20).map((memory) => ({
          id: memory.id,
          type: memory.type ?? 'memory',
          text: memory.text ?? '',
          source_conversation_id: memory.source_conversation_id ?? null,
          work_record_id: memory.work_record_id ?? null,
          tags: memory.tags ?? []
        }))
      },
      skills: {
        count: skillRecords.length,
        latest_ids: skillRecords.slice(-5).map((skill) => skill.id),
        linked_work_record_ids: skillRecords.slice(-5).map((skill) => skill.work_record_id).filter(Boolean),
        items: skillRecords.slice(-20).map((skill) => ({
          id: skill.id,
          name: skill.name ?? '会話からの自己変化',
          description: skill.description ?? '',
          source_conversation_id: skill.source_conversation_id ?? null,
          work_record_id: skill.work_record_id ?? null,
          tags: skill.tags ?? []
        }))
      },
      work_records: {
        count: workRecords.length,
        latest_ids: workRecords.slice(-5).map((record) => record.id),
        items: workRecords.slice(-20).map((record) => ({
          id: record.id,
          title: record.title,
          body: record.body,
          tags: record.tags ?? []
        }))
      }
    },
    active_session: activeConversation ? {
      conversation_id: activeConversation.id,
      source_type: activeConversation.source_type ?? 'field',
      message_count: activeConversation.messages?.length ?? 0,
      finalized: Boolean(activeConversation.discarded_after_work_record_id)
    } : null,
    pending_interaction_context: state.pending_interaction_context ?? null,
    last_finalization: lastConversationId ? {
      conversation_id: lastConversationId,
      memory_update: await readJsonIfExists(root, `game_data/logs/memory_updates/${lastConversationId}.json`),
      skill_update: await readJsonIfExists(root, `game_data/logs/skill_updates/${lastConversationId}.json`),
      work_record_update: await readJsonIfExists(root, `game_data/logs/work_record_updates/${lastConversationId}.json`),
      validator: await readJsonIfExists(root, `game_data/logs/validator/${lastConversationId}.json`),
      conversation_log: await readConversationIfExists(root, lastConversationId)
    } : null
  };
}

export async function resetContinuityRecords({ root, characterId = 'lina', target = 'all' }) {
  if (!root) throw new Error('root is required');
  const resetTargets = target === 'all' ? ['memory', 'skills', 'work_records'] : [target];
  const allowedTargets = new Set(['memory', 'skills', 'work_records']);
  for (const resetTarget of resetTargets) {
    if (!allowedTargets.has(resetTarget)) throw new Error(`unsupported continuity reset target: ${resetTarget}`);
  }
  const removed = { memory: [], skills: [], work_records: [] };

  if (resetTargets.includes('memory')) {
    const relativeDir = `game_data/characters/${characterId}/memory`;
    const entries = await listDirEntries(root, relativeDir, '.json');
    for (const entry of entries) {
      const record = await readJsonIfExists(root, path.join(relativeDir, entry));
      const generated = Boolean(record?.source_conversation_id || record?.work_record_id || record?.id?.startsWith('mem_conv_'));
      if (generated) {
        await fs.rm(storageFor(root).resolveWritePath(path.join(relativeDir, entry)), { force: true });
        removed.memory.push(entry);
      }
    }
  }

  if (resetTargets.includes('skills')) {
    const relativePath = `game_data/characters/${characterId}/skills.json`;
    const skillsFile = await readSkillsFile(root, characterId);
    const staticSkills = (skillsFile.skills ?? []).filter((skill) => skill.type !== 'self_change');
    removed.skills = (skillsFile.skills ?? []).filter((skill) => skill.type === 'self_change').map((skill) => skill.id);
    await writeJson(root, relativePath, { ...skillsFile, skills: staticSkills });
  }

  if (resetTargets.includes('work_records')) {
    const relativeDir = `game_data/characters/${characterId}/work_records`;
    const entries = await listDirEntries(root, relativeDir, '.md');
    await Promise.all(entries.map((entry) => fs.rm(storageFor(root).resolveWritePath(path.join(relativeDir, entry)), { force: true })));
    removed.work_records = entries;
  }

  return {
    character_id: characterId,
    reset_targets: resetTargets,
    removed,
    status: await getContinuityRecordStatus({ root, characterId })
  };
}
