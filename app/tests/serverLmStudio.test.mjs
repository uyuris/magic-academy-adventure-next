import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { cloneGameDataFixture, fixtureRoot } from './helpers.mjs';
import { projectRoot } from './testPaths.mjs';
import { createServer } from '../src/server.mjs';
import { callLmStudioChat, callLmStudioStructuredJson } from '../src/llm/lmStudioClient.mjs';

const workspaceRoot = path.dirname(projectRoot);
const livePublicRoot = path.join(projectRoot, 'app/public');
const assetsRoot = path.join(workspaceRoot, 'magic-academy-adventure', 'assets');

async function withLmStudioStub(t) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(body);
    const schemaName = body.response_format?.json_schema?.name;
    const isReflection = schemaName === 'reflection_candidates';
    const isEmotionChoice = schemaName === 'character_emotion_choice';
    const isMemoryUpdate = schemaName === 'memory_update_record';
    const isSkillUpdate = schemaName === 'skill_update_record';
    const isWorkRecordRecall = schemaName === 'work_record_recall_choice';
    const isWorkRecordUpdate = schemaName === 'work_record_update_record';
    const isPlainContinuity = !body.response_format && body.model === 'reflection-model';
    const plainPrompt = body.messages?.[0]?.content ?? '';
    const content = isEmotionChoice ? JSON.stringify({ expression: 'worried' }) : isWorkRecordRecall ? JSON.stringify({ work_record_ids: [] }) : plainPrompt.includes('会話を継続したいと思うか') ? 'true' : isPlainContinuity && plainPrompt.includes('skill_record作成の必要性判定') ? 'true' : isPlainContinuity && plainPrompt.includes('これは舞台フラグ判定') ? 'false' : isPlainContinuity && plainPrompt.includes('会話相手と主人公の敵対関係が相互に成立したか') ? 'false' : isPlainContinuity && plainPrompt.includes('所持金判定') ? '0' : isPlainContinuity && plainPrompt.includes('memory_record') ? 'リナは、主人公がLM Studio経由で声をかけたことで、主人公を反応確認に付き合う相手として受け止めた。' : isPlainContinuity && plainPrompt.includes('skill_record') ? 'タイトル: 会話からの自己変化\n本文: リナはLM Studio経由の会話確認を通じて、相手の呼びかけに合わせて落ち着いて応答する意識を強めた。' : isPlainContinuity && plainPrompt.includes('work_record') ? 'タイトル: LM Studio経由でリナと話した\n本文: 主人公はLM Studioで返答してとリナに話しかけた。リナはLM Studioからのリナの返答として短く応じた。これは実モデル接続時の会話終了処理を確認するためのセッションだった。' : isMemoryUpdate ? JSON.stringify({
      memory_record: {
        source_conversation_id: 'conv_lmstudio_test',
        work_record_id: 'wr_conv_lmstudio_test',
        character_id: 'lina',
        id: 'mem_lmstudio_test',
        type: 'relationship_change',
        text: 'リナは、主人公がLM Studio経由で声をかけたことで、主人公を反応確認に付き合う相手として受け止めた。',
        visibility: 'character_known',
        tags: ['リナ', 'LM Studio']
      }
    }) : isSkillUpdate ? JSON.stringify({
      skill_record: {
        source_conversation_id: 'conv_lmstudio_test',
        work_record_id: 'wr_conv_lmstudio_test',
        character_id: 'lina',
        id: 'skill_lmstudio_test',
        type: 'self_change',
        name: '会話からの自己変化',
        description: 'リナはLM Studio経由の会話確認を通じて、相手の呼びかけに合わせて落ち着いて応答する意識を強めた。',
        visibility: 'character_known',
        tags: ['リナ', 'LM Studio']
      }
    }) : isWorkRecordUpdate ? JSON.stringify({
      work_record: {
        source_conversation_id: 'conv_lmstudio_test',
        work_record_id: 'wr_conv_lmstudio_test',
        character_id: 'lina',
        id: 'wr_conv_lmstudio_test',
        title: 'LM Studio経由でリナと話した',
        summary: '主人公はLM Studioで返答してとリナに話しかけた。リナはLM Studioからのリナの返答として短く応じた。これは実モデル接続時の会話終了処理を確認するためのセッションだった。',
        participants: ['player', 'lina'],
        future_hooks: ['実LM Studioで再確認する'],
        retrieval_tags: ['リナ', 'LM Studio', '接続確認'],
        flag_update_candidates: [{ character_id: 'lina', flag: 'knowledge.lina.player_checked_garden_label', op: 'set', value: true }],
        warnings: []
      }
    }) : isReflection ? JSON.stringify({
      source_conversation_id: 'conv_lmstudio_test',
      observations: ['LM Studio stub reflection'],
      memory_update_candidates: [{ character_id: 'lina', id: 'mem_lmstudio_test', text: 'プレイヤーはLM Studio経由でリナに話しかけた。', visibility: 'character_known', tags: ['リナ', 'LM Studio'] }],
      skill_update_candidates: [],
      work_record_draft: {
        title: 'LM Studio経由でリナと話した',
        scene: '放課後の薬草園',
        participants: ['player', 'lina'],
        what_player_did: 'LM Studioで返答して',
        what_character_did: 'LM Studioからのリナの返答。',
        character_interpretation: 'プレイヤーはリナの反応を確認した。',
        uncertainty: '実モデルではなくstub応答である。',
        future_hooks: ['実LM Studioで再確認する'],
        retrieval_tags: ['リナ', 'LM Studio', '接続確認']
      },
      flag_update_candidates: [{ character_id: 'lina', flag: 'knowledge.lina.player_checked_garden_label', op: 'set', value: true }],
      warnings: []
    }) : 'LM Studioからのリナの返答。';
    if (!isReflection && body.stream === true) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"LM "}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"Studio "}}]}\n\n');
      res.end('data: {"choices":[{"delta":{"content":"stream"}}]}\n\ndata: [DONE]\n\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests };
}

async function withRuntimeServer(t, lmStudioConfig, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-server-lmstudio-'));
  await cloneGameDataFixture(root);
  const state = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime_state.json'), 'utf8'));
  state.current_location_id = 'forbidden_archive_door';
  state.global_flags = Object.fromEntries(Object.entries(state.global_flags ?? {}).map(([flagId, active]) => {
    if (flagId.startsWith('event.')) return [flagId, false];
    if (flagId.startsWith('knowledge.')) return [flagId, true];
    return [flagId, active];
  }));
  state.event_flag_sources = {};
  state.event_completion_sources = {};

  const seedMode = options.seedMode ?? 'ordinary';
  if (seedMode === 'ordinary') {
    state.pending_interaction_context = null;
    state.ending_started = false;
    state.ending_completed = false;
    state.ending_character_id = null;
    state.current_interaction_character_id = null;
    state.current_screen = 'field';
    state.global_flags['event.graduation_ending.ready'] = false;
    state.global_flags['event.graduation_ending.completed'] = false;
  } else if (seedMode === 'graduation-ending') {
    state.pending_interaction_context = {
      source_type: 'event',
      event_flag_id: 'event.graduation_ending.ready',
      event_label: '卒業エンディング',
      source_conversation_id: null,
      opening_context: 'あなたは卒業を迎えた主人公とお別れの会話をする。'
    };
    state.ending_started = true;
    state.ending_completed = false;
    state.ending_character_id = 'character_016';
    state.current_interaction_character_id = 'character_016';
    state.current_screen = 'interaction';
    state.global_flags['event.graduation_ending.ready'] = true;
    state.global_flags['event.graduation_ending.completed'] = false;
  } else {
    throw new Error(`unknown seedMode: ${seedMode}`);
  }

  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  const server = createServer({ root, assetsRoot, publicRoot: livePublicRoot, lmStudioConfig });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  return { root, base: `http://127.0.0.1:${server.address().port}` };
}

async function waitFor(assertion, { timeoutMs = 1500, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError;
}

test('server conversation endpoint resolves character speech constraints from chat_model without leaking model metadata into prompts', async (t) => {
  const lm = await withLmStudioStub(t);
  const { base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'google/gemma-4-31b', reflection_model: 'reflection-model', timeout_ms: 5000, stream: false, thinking_effort: null });

  const response = await fetch(`${base}/api/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'conv_lmstudio_constraints_test', character_id: 'lina', player_input: '星図の話をしよう' })
  });
  assert.equal(response.status, 200);
  await response.json();

  assert.equal(lm.requests.length, 3, 'conversation turn should choose emotion, call chat, then judge continuation');
  assert.equal(lm.requests[0].model, 'reflection-model', 'emotion choice may use reflection_model but must receive constraints chosen from chat_model');
  assert.equal(lm.requests[1].model, 'google/gemma-4-31b');
  const characterPrompts = lm.requests.slice(0, 3).map((request) => request.messages?.[0]?.content ?? '');
  for (const prompt of characterPrompts) {
    assert.match(prompt, /キャラクター発話上の禁止事項:/);
    assert.match(prompt, /「最高」、「最悪」、「最低」、「完璧」、「正解」、「特等席」、「記録」、「あなたなら」、「贅沢」/);
    assert.doesNotMatch(prompt, /Gemma4|LLM固有|モデル固有|このモデル|モデルの癖|profile_id|match_models|chat_model|reflection_model|provider/);
  }
});

test('server conversation endpoint uses LM Studio for assistant response and finalizes memory, skill, and work-record updates separately on ordinary conversation end', async (t) => {
  const lm = await withLmStudioStub(t);
  const { root, base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'chat-model', reflection_model: 'reflection-model', timeout_ms: 5000, stream: false, thinking_effort: 'medium' });

  const response = await fetch(`${base}/api/conversation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'conv_lmstudio_test', character_id: 'lina', player_input: 'LM Studioで返答して' })
  });
  assert.equal(response.status, 200);
  const result = await response.json();

  assert.equal(result.conversation.messages[1].content, 'LM Studioからのリナの返答。');
  assert.equal(result.conversation.messages[1].expression, 'worried');
  assert.equal(result.reflection, undefined);
  assert.equal(lm.requests.length, 3, 'open conversation turn should choose emotion, call chat, then judge conversation continuation; work-record recall is skipped when no linked candidate exists');
  assert.equal(lm.requests[0].response_format.json_schema.name, 'character_emotion_choice');
  assert.equal(lm.requests[1].model, 'chat-model');
  assert.match(lm.requests[2].messages[0].content, /会話を継続したいと思うか/);
  assert.deepEqual(lm.requests.map((request) => request.reasoning_effort), Array.from({ length: lm.requests.length }, () => 'medium'));

  const endResponse = await fetch(`${base}/api/conversation/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversation_id: 'conv_lmstudio_test', character_id: 'lina' })
  });
  assert.equal(endResponse.status, 200);
  const finalized = await endResponse.json();
  assert.equal(finalized.finalization_status, 'completed');
  assert.equal(finalized.state.current_screen, 'academy-room');
  let memoryUpdate;
  let skillUpdate;
  let workRecordUpdate;
  let validator;
  await waitFor(async () => {
    memoryUpdate = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/memory_updates/conv_lmstudio_test.json'), 'utf8'));
    skillUpdate = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/skill_updates/conv_lmstudio_test.json'), 'utf8'));
    workRecordUpdate = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/work_record_updates/conv_lmstudio_test.json'), 'utf8'));
    validator = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/validator/conv_lmstudio_test.json'), 'utf8'));
  });
  assert.equal(memoryUpdate.memory_record.id, 'mem_conv_lmstudio_test');
  assert.equal(memoryUpdate.memory_record.text, 'リナは、主人公がLM Studio経由で声をかけたことで、主人公を反応確認に付き合う相手として受け止めた。');
  assert.deepEqual(memoryUpdate.memory_record.tags, []);
  assert.equal(skillUpdate.skill_record.id, 'skill_conv_lmstudio_test');
  assert.equal(skillUpdate.skill_record.name, '会話からの自己変化');
  assert.equal(workRecordUpdate.work_record.id, 'wr_conv_lmstudio_test');
  assert.equal(validator.accepted_memory[0].work_record_id, 'wr_conv_lmstudio_test');
  assert.equal(validator.accepted_skills[0].work_record_id, 'wr_conv_lmstudio_test');

  const requestContents = lm.requests.map((request) => request.messages?.[0]?.content ?? '');
  const reflectionIndex = lm.requests.findIndex((request) => request.model === 'reflection-model');
  const skillNecessityIndex = requestContents.findIndex((content) => /skill_record作成の必要性判定/.test(content));
  const workRecordIndex = requestContents.findIndex((content) => /work_recordのタイトルと本文を平文で出力する/.test(content));
  const skillRecordIndex = requestContents.findIndex((content) => /skill_recordのタイトルと本文を平文で出力する/.test(content));
  const stageFlagRequests = requestContents.filter((content) => content.includes('これは舞台フラグ判定'));
  const eventFlagRequests = requestContents.filter((content) => content.includes('これはイベントフラグ判定'));
  const participantOverrideRequests = requestContents.filter((content) => content.includes('これはイベント同行メンバー上書き判定'));
  const moneyDeltaRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話前後で増減したユーザーの所持金を判定する'));
  const buddyAgreementRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話相手と主人公がバディになる合意が相互に成立したか'));
  const enemyHostilityRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話相手と主人公の敵対関係が相互に成立したか'));
  const destinationStageRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('この会話のあと、主人公と会話相手が二人で次に向かう場所について、会話内で具体的に合意したかを判定する。'));

  assert.notEqual(reflectionIndex, -1);
  assert.notEqual(skillNecessityIndex, -1);
  assert.notEqual(workRecordIndex, -1);
  assert.notEqual(skillRecordIndex, -1);
  assert.equal(reflectionIndex < skillNecessityIndex, true);
  assert.equal(skillNecessityIndex < skillRecordIndex, true);
  assert.equal(workRecordIndex < skillRecordIndex, true);
  assert.equal(lm.requests[skillNecessityIndex].model, 'reflection-model');
  assert.equal(lm.requests[skillNecessityIndex].response_format, undefined);
  assert.equal(lm.requests[workRecordIndex].model, 'reflection-model');
  assert.equal(lm.requests[workRecordIndex].response_format, undefined);
  assert.equal(lm.requests[skillRecordIndex].model, 'reflection-model');
  assert.equal(lm.requests[skillRecordIndex].response_format, undefined);
  assert.match(requestContents[skillNecessityIndex], /回答はtrueもしくはfalseのみを返す/);
  assert.match(requestContents[skillNecessityIndex], /今後の振る舞いに決定的な影響を与える/);
  assert.doesNotMatch(requestContents[skillNecessityIndex], /タイトル:/);
  assert.doesNotMatch(requestContents[skillNecessityIndex], /本文:/);
  assert.ok(stageFlagRequests.length >= 2, 'current location should still produce stage-flag judgment requests');
  assert.match(stageFlagRequests.join('\n'), /禁書庫に入り、その中でお茶会を開いたか/);
  assert.match(stageFlagRequests.join('\n'), /禁書庫で死霊術の本を見つけたか/);
  assert.ok(eventFlagRequests.length >= 1, 'ordinary conversation finalization should still evaluate event-flag contracts');
  assert.match(eventFlagRequests.join('\n'), /学院祭に一緒に行く約束をしたか/);
  assert.doesNotMatch(eventFlagRequests.join('\n'), /ネクロマンサーの封印解除/);
  assert.equal(participantOverrideRequests.join('\n'), '');
  assert.ok(moneyDeltaRequest);
  assert.equal(moneyDeltaRequest.model, 'reflection-model');
  assert.equal(moneyDeltaRequest.response_format, undefined);
  assert.ok(buddyAgreementRequest);
  assert.equal(buddyAgreementRequest.model, 'reflection-model');
  assert.equal(buddyAgreementRequest.response_format, undefined);
  assert.ok(enemyHostilityRequest);
  assert.equal(enemyHostilityRequest.model, 'reflection-model');
  assert.equal(enemyHostilityRequest.response_format, undefined);
  assert.ok(destinationStageRequest);
  assert.equal(destinationStageRequest.model, 'reflection-model');
  assert.equal(destinationStageRequest.response_format, undefined);
  assert.doesNotMatch(moneyDeltaRequest.messages[0].content, /現在のユーザー所持金:/);
  assert.match(moneyDeltaRequest.messages[0].content, /回答は数値のみ/);
  assert.doesNotMatch(buddyAgreementRequest.messages[0].content, /現在のバディ状態:/);
  assert.match(buddyAgreementRequest.messages[0].content, /回答はtrueもしくはfalseのみ/);
  assert.match(enemyHostilityRequest.messages[0].content, /回答はtrueもしくはfalseのみ/);
  assert.match(destinationStageRequest.messages[0].content, /今度行く、来週行くなど、将来その場所へ一緒に行く予定について具体的に合意して会話が終わった場合も、向かう場所への合意が成立したものとして扱う/);
  assert.match(destinationStageRequest.messages[0].content, /返答は対応表にあるlocation_idを1つだけ返す/);
  assert.match(destinationStageRequest.messages[0].content, /移動可能な移動先の名称とlocation_idの対応表/);
  assert.deepEqual(lm.requests.map((request) => request.reasoning_effort), Array.from({ length: lm.requests.length }, () => 'medium'));
});

function parseSse(text) {
  return text.trim().split('\n\n').map((block) => {
    const event = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
    const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
    return { event, data: data ? JSON.parse(data) : null };
  });
}

test('server streaming conversation endpoint relays immediate assistant deltas before continuation judgment on ordinary conversation end', async (t) => {
  const lm = await withLmStudioStub(t);
  const { root, base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'chat-model', reflection_model: 'reflection-model', timeout_ms: 5000, stream: true, thinking_effort: null });

  const response = await fetch(`${base}/api/conversation/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'conv_lmstudio_stream_test', character_id: 'lina', player_input: 'streamで返答して' })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const events = parseSse(await response.text());

  assert.deepEqual(events.filter((item) => item.event === 'assistant_delta').map((item) => item.data.delta), ['LM ', 'Studio ', 'stream']);
  const firstDeltaIndex = events.findIndex((item) => item.event === 'assistant_delta');
  const assistantCompleteIndex = events.findIndex((item) => item.event === 'assistant_complete');
  const resultIndex = events.findIndex((item) => item.event === 'result');
  assert.notEqual(assistantCompleteIndex, -1, 'stream should emit assistant_complete for the immediate reply before the final result');
  assert.notEqual(resultIndex, -1, 'stream should still emit the canonical final result');
  assert.equal(firstDeltaIndex < assistantCompleteIndex, true, 'assistant deltas should be visible before assistant_complete');
  assert.equal(assistantCompleteIndex < resultIndex, true, 'assistant_complete should arrive before the final result event');
  assert.deepEqual(events[assistantCompleteIndex].data, { content: 'LM Studio stream', expression: 'worried', face_emotion_variant_id: 'face_worried' });
  const emotionEvent = events.find((item) => item.event === 'assistant_emotion');
  assert.deepEqual(emotionEvent.data, { expression: 'worried', face_emotion_variant_id: 'face_worried' });
  const resultEvent = events.find((item) => item.event === 'result');
  assert.equal(resultEvent.data.conversation.messages[1].content, 'LM Studio stream');
  assert.equal(resultEvent.data.conversation.messages[1].expression, 'worried');
  assert.equal(resultEvent.data.reflection, undefined);
  assert.equal(lm.requests.length, 3, 'streaming chat turn should choose emotion, stream the immediate LM Studio chat reply to the browser, then judge continuation; work-record recall is skipped when no linked candidate exists');
  assert.equal(lm.requests[0].response_format.json_schema.name, 'character_emotion_choice');
  assert.equal(lm.requests[1].stream, true);
  assert.equal(lm.requests[1].reasoning_effort, 'none');
  assert.match(lm.requests[2].messages[0].content, /会話を継続したいと思うか/);

  const endResponse = await fetch(`${base}/api/conversation/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversation_id: 'conv_lmstudio_stream_test', character_id: 'lina' })
  });
  assert.equal(endResponse.status, 200);
  const finalized = await endResponse.json();
  assert.equal(finalized.finalization_status, 'completed');
  assert.equal(finalized.state.current_screen, 'academy-room');
  let validator;
  await waitFor(async () => {
    validator = JSON.parse(await fs.readFile(path.join(root, 'game_data/logs/validator/conv_lmstudio_stream_test.json'), 'utf8'));
  });
  assert.equal(validator.accepted_memory[0].work_record_id, 'wr_conv_lmstudio_stream_test');
  assert.equal(validator.accepted_skills[0].id, 'skill_conv_lmstudio_stream_test');

  const requestContents = lm.requests.map((request) => request.messages?.[0]?.content ?? '');
  const reflectionIndex = lm.requests.findIndex((request) => request.model === 'reflection-model');
  const skillNecessityIndex = requestContents.findIndex((content) => /skill_record作成の必要性判定/.test(content));
  const workRecordIndex = requestContents.findIndex((content) => /work_recordのタイトルと本文を平文で出力する/.test(content));
  const skillRecordIndex = requestContents.findIndex((content) => /skill_recordのタイトルと本文を平文で出力する/.test(content));
  const stageFlagRequests = requestContents.filter((content) => content.includes('これは舞台フラグ判定'));
  const eventFlagRequests = requestContents.filter((content) => content.includes('これはイベントフラグ判定'));
  const participantOverrideRequests = requestContents.filter((content) => content.includes('これはイベント同行メンバー上書き判定'));
  const moneyDeltaRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話前後で増減したユーザーの所持金を判定する'));
  const buddyAgreementRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話相手と主人公がバディになる合意が相互に成立したか'));
  const enemyHostilityRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('会話相手と主人公の敵対関係が相互に成立したか'));
  const destinationStageRequest = lm.requests.find((request) => (request.messages?.[0]?.content ?? '').includes('この会話のあと、主人公と会話相手が二人で次に向かう場所について、会話内で具体的に合意したかを判定する。'));

  assert.notEqual(reflectionIndex, -1);
  assert.notEqual(skillNecessityIndex, -1);
  assert.notEqual(workRecordIndex, -1);
  assert.notEqual(skillRecordIndex, -1);
  assert.equal(reflectionIndex < skillNecessityIndex, true);
  assert.equal(skillNecessityIndex < skillRecordIndex, true);
  assert.equal(workRecordIndex < skillRecordIndex, true);
  assert.equal(lm.requests[skillNecessityIndex].model, 'reflection-model');
  assert.equal(lm.requests[skillNecessityIndex].response_format, undefined);
  assert.equal(lm.requests[workRecordIndex].model, 'reflection-model');
  assert.equal(lm.requests[workRecordIndex].response_format, undefined);
  assert.equal(lm.requests[skillRecordIndex].model, 'reflection-model');
  assert.equal(lm.requests[skillRecordIndex].response_format, undefined);
  assert.match(requestContents[skillNecessityIndex], /回答はtrueもしくはfalseのみを返す/);
  assert.ok(stageFlagRequests.length >= 2, 'streaming finalization should still evaluate stage-flag contracts for the current location');
  assert.match(stageFlagRequests.join('\n'), /禁書庫で死霊術の本を見つけたか/);
  assert.ok(eventFlagRequests.length >= 1, 'streaming finalization should still evaluate event-flag contracts');
  assert.match(eventFlagRequests.join('\n'), /学院祭に一緒に行く約束をしたか/);
  assert.doesNotMatch(eventFlagRequests.join('\n'), /ネクロマンサーの封印解除/);
  assert.equal(participantOverrideRequests.join('\n'), '');
  assert.ok(moneyDeltaRequest);
  assert.equal(moneyDeltaRequest.model, 'reflection-model');
  assert.equal(moneyDeltaRequest.response_format, undefined);
  assert.ok(buddyAgreementRequest);
  assert.equal(buddyAgreementRequest.model, 'reflection-model');
  assert.equal(buddyAgreementRequest.response_format, undefined);
  assert.ok(enemyHostilityRequest);
  assert.equal(enemyHostilityRequest.model, 'reflection-model');
  assert.equal(enemyHostilityRequest.response_format, undefined);
  assert.ok(destinationStageRequest);
  assert.equal(destinationStageRequest.model, 'reflection-model');
  assert.equal(destinationStageRequest.response_format, undefined);
  assert.doesNotMatch(moneyDeltaRequest.messages[0].content, /現在のユーザー所持金:/);
  assert.match(moneyDeltaRequest.messages[0].content, /回答は数値のみ/);
  assert.doesNotMatch(buddyAgreementRequest.messages[0].content, /現在のバディ状態:/);
  assert.match(buddyAgreementRequest.messages[0].content, /回答はtrueもしくはfalseのみ/);
  assert.match(enemyHostilityRequest.messages[0].content, /回答はtrueもしくはfalseのみ/);
  assert.match(destinationStageRequest.messages[0].content, /今度行く、来週行くなど、将来その場所へ一緒に行く予定について具体的に合意して会話が終わった場合も、向かう場所への合意が成立したものとして扱う/);
  assert.match(destinationStageRequest.messages[0].content, /返答は対応表にあるlocation_idを1つだけ返す/);
  assert.match(destinationStageRequest.messages[0].content, /移動可能な移動先の名称とlocation_idの対応表/);
  assert.deepEqual(lm.requests.map((request) => request.reasoning_effort), Array.from({ length: lm.requests.length }, () => 'none'));
});

test('server streaming opening endpoint relays LM Studio assistant deltas before final result', async (t) => {
  const lm = await withLmStudioStub(t);
  const { base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'chat-model', reflection_model: 'reflection-model', timeout_ms: 5000, stream: true, thinking_effort: 'low' });

  const response = await fetch(`${base}/api/conversation/opening/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'conv_lmstudio_opening_stream_test', character_id: 'lina' })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const events = parseSse(await response.text());

  assert.deepEqual(events.filter((item) => item.event === 'assistant_delta').map((item) => item.data.delta), ['LM ', 'Studio ', 'stream']);
  const assistantCompleteIndex = events.findIndex((item) => item.event === 'assistant_complete');
  const resultIndex = events.findIndex((item) => item.event === 'result');
  assert.notEqual(assistantCompleteIndex, -1, 'opening stream should emit assistant_complete as soon as first utterance text is finished');
  assert.notEqual(resultIndex, -1, 'opening stream should still emit the canonical final result');
  assert.equal(assistantCompleteIndex < resultIndex, true, 'opening assistant_complete should arrive before final reconciliation');
  assert.deepEqual(events[assistantCompleteIndex].data, { content: 'LM Studio stream' });
  assert.equal(events[resultIndex].data.conversation.messages[0].content, 'LM Studio stream');
  assert.equal(lm.requests.length, 1, 'opening should only call LM Studio chat once and not run emotion/recall/prewarm');
  assert.equal(lm.requests[0].stream, true);
  assert.equal(lm.requests[0].reasoning_effort, 'low');
});

test('server streaming opening emits structured config-required SSE errors when LM Studio config is unavailable', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-stream-config-required-');
  const configPath = path.join(root, 'runtime-config', 'missing-lmstudio.json');
  const server = createServer({
    root,
    assetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/conversation/opening/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina' })
  });
  assert.equal(response.status, 200);
  const events = parseSse(await response.text());
  const errorEvent = events.find((item) => item.event === 'error');
  assert.deepEqual(errorEvent.data, {
    error: 'LM Studioの設定が必要です。設定画面で接続先とモデルを保存してください。',
    error_code: 'LMSTUDIO_CONFIG_REQUIRED'
  });
});

test('server streaming opening emits structured config-required SSE errors when LM Studio chat model is missing', async (t) => {
  const root = await fixtureRoot('magic-adv-lmstudio-stream-incomplete-config-');
  const configPath = path.join(root, 'runtime-config', 'lmstudio.json');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify({
    provider: 'lmstudio',
    base_url: 'http://127.0.0.1:9/v1',
    reflection_model: 'reflection-model',
    timeout_ms: 250,
    stream: true
  }, null, 2)}\n`, 'utf8');

  const server = createServer({
    root,
    assetsRoot,
    publicRoot: livePublicRoot,
    skillFlowRollProvider: () => 0.1,
    lmStudioConfigPath: configPath
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/conversation/opening/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'lina' })
  });
  assert.equal(response.status, 200);
  const events = parseSse(await response.text());
  const errorEvent = events.find((item) => item.event === 'error');
  assert.deepEqual(errorEvent.data, {
    error: 'LM Studioの設定が必要です。設定画面で接続先とモデルを保存してください。',
    error_code: 'LMSTUDIO_CONFIG_REQUIRED'
  });
});

test('server streaming opening emits structured connection-unavailable SSE errors when LM Studio is unreachable', async (t) => {
  const { base } = await withRuntimeServer(t, {
    base_url: 'http://127.0.0.1:9/v1',
    chat_model: 'chat-model',
    reflection_model: 'reflection-model',
    timeout_ms: 250,
    stream: true
  });

  const response = await fetch(`${base}/api/conversation/opening/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'conv_lmstudio_unreachable_stream_test', character_id: 'lina' })
  });

  assert.equal(response.status, 200);
  const events = parseSse(await response.text());
  const errorEvent = events.find((item) => item.event === 'error');
  assert.equal(errorEvent.data.error_code, 'LMSTUDIO_CONNECTION_UNAVAILABLE');
  assert.match(errorEvent.data.error ?? '', /LM Studioの接続が確認できません/);
});

test('LM Studio chat calls require a chat model before attempting the network request', async () => {
  let fetchCalled = false;

  await assert.rejects(
    () => callLmStudioChat({
      config: {
        base_url: 'http://127.0.0.1:1234/v1',
        reflection_model: 'reflection-model',
        timeout_ms: 5000,
        stream: false
      },
      prompt: '会話してください。',
      fetchImpl: async () => {
        fetchCalled = true;
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ choices: [{ message: { content: 'ok' } }] })
        };
      }
    }),
    (error) => {
      assert.equal(error.errorCode, 'LMSTUDIO_CONFIG_REQUIRED');
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /LM Studioの設定が必要です/);
      return true;
    }
  );
  assert.equal(fetchCalled, false);
});

test('LM Studio non-stream body-read transport failures are classified as connection unavailable', async () => {
  const bodyReadError = new Error('terminated');
  bodyReadError.cause = { code: 'UND_ERR_SOCKET' };
  const fakeResponse = {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => { throw bodyReadError; }
  };

  await assert.rejects(
    () => callLmStudioStructuredJson({
      config: {
        base_url: 'http://127.0.0.1:1234/v1',
        chat_model: 'chat-model',
        reflection_model: 'reflection-model',
        timeout_ms: 5000
      },
      prompt: '構造化応答を返してください。',
      fetchImpl: async () => fakeResponse
    }),
    (error) => {
      assert.equal(error.errorCode, 'LMSTUDIO_CONNECTION_UNAVAILABLE');
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /LM Studioの接続が確認できません/);
      return true;
    }
  );
});

test('LM Studio non-ok body-read transport failures are classified as connection unavailable', async () => {
  const bodyReadError = new Error('terminated');
  bodyReadError.cause = { code: 'UND_ERR_SOCKET' };
  const fakeResponse = {
    ok: false,
    status: 502,
    headers: { get: () => 'text/plain' },
    text: async () => { throw bodyReadError; }
  };

  await assert.rejects(
    () => callLmStudioStructuredJson({
      config: {
        base_url: 'http://127.0.0.1:1234/v1',
        chat_model: 'chat-model',
        reflection_model: 'reflection-model',
        timeout_ms: 5000
      },
      prompt: '構造化応答を返してください。',
      fetchImpl: async () => fakeResponse
    }),
    (error) => {
      assert.equal(error.errorCode, 'LMSTUDIO_CONNECTION_UNAVAILABLE');
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /LM Studioの接続が確認できません/);
      return true;
    }
  );
});

test('server returns not found for obsolete event completion endpoint without LM Studio calls', async (t) => {
  const lm = await withLmStudioStub(t);
  const { root, base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'chat-model', reflection_model: 'reflection-model', timeout_ms: 5000, stream: false });
  const state = JSON.parse(await fs.readFile(path.join(root, 'game_data/runtime_state.json'), 'utf8'));
  state.current_location_id = 'herbology_garden';
  state.current_screen = 'field';
  await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const response = await fetch(`${base}/api/events/complete`, { method: 'POST' });
  assert.equal(response.status, 404);
  assert.equal(lm.requests.length, 0);
});

test('server conversation end returns title for graduation-ending conversations', async (t) => {
  const lm = await withLmStudioStub(t);
  const { base } = await withRuntimeServer(t, { base_url: lm.baseUrl, chat_model: 'chat-model', reflection_model: 'reflection-model', timeout_ms: 5000, stream: false }, { seedMode: 'graduation-ending' });

  const endResponse = await fetch(`${base}/api/conversation/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversation_id: 'conv_graduation_route_test', character_id: 'character_016' })
  });
  assert.equal(endResponse.status, 200);
  const finalized = await endResponse.json();
  assert.equal(finalized.state.current_screen, 'title');
  assert.deepEqual(finalized.transition, { next_screen: 'title', loading_copy_key: 'graduation-ending-complete' });
});
