import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureRoot as createFixtureRoot } from './helpers.mjs';
import { editConversationUserMessage, finalizeConversation, resetContinuityRecords, runConversationOpening, runConversationTurn } from '../src/llm/conversationPipeline.mjs';

async function writeSplitJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function splitFixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-pipeline-split-'));
  await writeSplitJson(root, 'data/definitions/game_data/event_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/locations.json', [{ id: 'herbology_garden', name: '薬草園', description: 'split pipeline fixture' }]);
  await writeSplitJson(root, 'data/definitions/game_data/shop_catalog.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/stage_flags.json', []);
  await writeSplitJson(root, 'data/definitions/game_data/world/settings.json', {
    academy_name: '星灯魔法学院',
    player_name: '主人公',
    world_description: 'split pipeline fixture',
    world_condition_texts: []
  });
  await writeSplitJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    current_location_id: 'herbology_garden',
    current_screen: 'field',
    global_flags: {},
    event_flag_sources: {},
    event_completion_sources: {},
    disabled_stage_flag_judgment_flows: {},
    visited_locations: ['herbology_garden'],
    active_character_ids: ['lina'],
    last_conversation_id: null,
    characters: { lina: { flags: {} } },
    pending_interaction_context: null,
    training_actions_used: 0,
    training_actions_limit: 6,
    elapsed_weeks: 0,
    ending_started: false,
    ending_completed: false,
    ending_character_id: null,
    current_buddy_character_id: null,
    current_enemy_character_ids: []
  });
  await writeSplitJson(root, 'data/mutable/game_data/player_inventory.json', { money: 0, items: [] });
  await writeSplitJson(root, 'data/mutable/game_data/runtime/player_parameters.json', {
    magic: { light: { min: 0, max: 100, label: '光魔法習熟度', value: 25 } },
    abilities: { strength: { min: 0, max: 100, label: '筋力', value: 25 } }
  });
  await writeSplitJson(root, 'data/mutable/game_data/characters/lina/flags.json', { character_id: 'lina', flags: {} });
  await writeSplitJson(root, 'content/characters/lina/profile.json', {
    character_id: 'lina',
    display_name: 'リナ',
    identity: '薬草園の生徒',
    visual_set_id: 'lina',
    prompt_description: '薬草の観察が得意。',
    speaking_basis: '丁寧に話す。',
    available_expressions: ['neutral', 'happy'],
    parameters: { magic: {}, abilities: {} }
  });
  await writeSplitJson(root, 'data/mutable/game_data/characters/lina/skills.json', { character_id: 'lina', skills: [] });
  return root;
}

async function fixtureRoot() {
  return createFixtureRoot('magic-adv-pipeline-');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function exists(root, relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

test('runConversationOpening creates an LLM-generated first assistant utterance before player input and reset clears generated continuity records', async () => {
  const root = await fixtureRoot();
  let openingPrompt = '';
  const opened = await runConversationOpening({
    root,
    id: 'conv_opening_001',
    characterId: 'lina',
    now: '2026-05-05T06:00:00.000+09:00',
    chatProvider: async ({ prompt, playerInput }) => {
      openingPrompt = prompt;
      assert.equal(playerInput, null);
      return 'ここ、少し空気が乾いています。古い掲示板の跡を見てから話しましょう。';
    }
  });

  assert.equal(opened.conversation.id, 'conv_opening_001');
  assert.equal(opened.conversation.messages.length, 1);
  assert.deepEqual(opened.conversation.messages[0], {
    role: 'assistant',
    content: 'ここ、少し空気が乾いています。古い掲示板の跡を見てから話しましょう。'
  });
  assert.match(openingPrompt, /プレイヤーはまだ発言していない/);
  assert.match(openingPrompt, /発話は一度に1〜3文程度/);

  await finalizeConversation({ root, conversationId: 'conv_opening_001', characterId: 'lina', now: '2026-05-05T06:01:00.000+09:00', skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' }) });
  assert.equal((await readJson(root, 'game_data/characters/lina/skills.json')).skills.some((skill) => skill.type === 'self_change'), true);
  assert.equal(await exists(root, 'game_data/characters/lina/memory/mem_conv_opening_001.json'), true);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_opening_001.md'), true);
  const openingWorkRecordMarkdown = await fs.readFile(path.join(root, 'game_data/characters/lina/work_records/wr_conv_opening_001.md'), 'utf8');
  assert.match(openingWorkRecordMarkdown, /## 第1週のサマリー/);
  assert.doesNotMatch(openingWorkRecordMarkdown, /## Summary/);

  const reset = await resetContinuityRecords({ root, characterId: 'lina', target: 'all' });
  assert.deepEqual(reset.reset_targets, ['memory', 'skills', 'work_records']);
  assert.equal((await readJson(root, 'game_data/characters/lina/skills.json')).skills.some((skill) => skill.type === 'self_change'), false);
  assert.equal(await exists(root, 'game_data/characters/lina/memory/mem_conv_opening_001.json'), false);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_opening_001.md'), false);
});

test('split-root conversation pipeline reads and writes continuity surfaces without creating legacy game_data roots', async (t) => {
  const root = await splitFixtureRoot();
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const opened = await runConversationOpening({
    root,
    id: 'conv_split_001',
    characterId: 'lina',
    now: '2026-05-05T06:00:00.000+09:00',
    chatProvider: async () => '薬草園の棚札、順番が少し変わっています。'
  });
  assert.equal(opened.conversation.messages[0].content, '薬草園の棚札、順番が少し変わっています。');

  await finalizeConversation({
    root,
    conversationId: 'conv_split_001',
    characterId: 'lina',
    now: '2026-05-05T06:01:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  const splitSkills = JSON.parse(await fs.readFile(path.join(root, 'data/mutable/game_data/characters/lina/skills.json'), 'utf8'));
  assert.equal(splitSkills.skills.some((skill) => skill.type === 'self_change'), true);
  assert.equal(await exists(root, 'data/mutable/game_data/characters/lina/memory/mem_conv_split_001.json'), true);
  assert.equal(await exists(root, 'data/mutable/game_data/characters/lina/work_records/wr_conv_split_001.md'), true);
  assert.equal(await exists(root, 'data/mutable/game_data/logs/conversations/conv_split_001.json'), true);

  const reset = await resetContinuityRecords({ root, characterId: 'lina', target: 'all' });
  assert.deepEqual(reset.reset_targets, ['memory', 'skills', 'work_records']);
  const resetSkills = JSON.parse(await fs.readFile(path.join(root, 'data/mutable/game_data/characters/lina/skills.json'), 'utf8'));
  assert.equal(resetSkills.skills.some((skill) => skill.type === 'self_change'), false);
  assert.equal(await exists(root, 'data/mutable/game_data/characters/lina/memory/mem_conv_split_001.json'), false);
  assert.equal(await exists(root, 'data/mutable/game_data/characters/lina/work_records/wr_conv_split_001.md'), false);

  await assert.rejects(fs.access(path.join(root, 'game_data/logs/conversations/conv_split_001.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/characters/lina/memory/mem_conv_split_001.json')), { code: 'ENOENT' });
});

test('runConversationTurn preserves newer 16-expression choices instead of collapsing them to neutral', async () => {
  const root = await fixtureRoot();
  const result = await runConversationTurn({
    root,
    id: 'conv_emotion_16_001',
    characterId: 'lina',
    playerInput: 'その決意、顔にも出てるね',
    now: '2026-05-05T06:20:00.000+09:00',
    emotionProvider: async ({ prompt }) => {
      assert.match(prompt, /caring, confident, sadness, worried, anger, surprised, embarrassed, shy, serious, determined, panic, tired, sick, smug/);
      return { expression: 'determined' };
    },
    chatProvider: async () => '……はい。今は迷わず、やるべきことを進めます。'
  });

  assert.equal(result.conversation.messages.at(-1).expression, 'determined');
  assert.equal(result.conversation.messages.at(-1).face_emotion_variant_id, 'face_determined');
});

test('runConversationTurn replaces the most recent prompt memories with matching work records and keeps missing matches as memories', async () => {
  const root = await fixtureRoot();
  const memoryDir = path.join(root, 'game_data/characters/lina/memory');
  const workRecordDir = path.join(root, 'game_data/characters/lina/work_records');
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(workRecordDir, { recursive: true });

  const memoryRecords = [
    { id: 'mem_recent_prompt_01', text: 'MEMORY-01-oldest-kept', work_record_id: 'wr_recent_prompt_01' },
    { id: 'mem_recent_prompt_02', text: 'MEMORY-02-older-kept', work_record_id: 'wr_recent_prompt_02' },
    { id: 'mem_recent_prompt_03', text: 'MEMORY-03-recent-linked-replaced', work_record_id: 'wr_recent_prompt_03' },
    { id: 'mem_recent_prompt_04', text: 'MEMORY-04-recent-source-fallback-replaced', source_conversation_id: 'conv_recent_prompt_04' },
    { id: 'mem_recent_prompt_05', text: 'MEMORY-05-recent-missing-work-record-kept', source_conversation_id: 'conv_recent_prompt_05', work_record_id: 'wr_recent_prompt_missing_05' },
    { id: 'mem_recent_prompt_06_hidden', visibility: 'hidden_story', text: 'MEMORY-06-hidden-not-a-prompt-candidate', source_conversation_id: 'conv_recent_prompt_06', work_record_id: 'wr_hidden_recent_prompt_06' }
  ];
  for (const memory of memoryRecords) {
    await fs.writeFile(path.join(memoryDir, `${memory.id}.json`), JSON.stringify({
      character_id: 'lina',
      visibility: 'character_known',
      type: 'relationship_change',
      ...memory
    }, null, 2), 'utf8');
  }
  await fs.writeFile(path.join(workRecordDir, 'wr_recent_prompt_03.md'), '# recent prompt 03\n\nID: wr_recent_prompt_03\n\n## Summary\n\nWORK-03-detail-from-linked-work-record.\n', 'utf8');
  await fs.writeFile(path.join(workRecordDir, 'wr_conv_recent_prompt_04.md'), '# recent prompt 04\n\nID: wr_conv_recent_prompt_04\n\n## Summary\n\nWORK-04-detail-from-source-conversation-fallback.\n', 'utf8');
  await fs.writeFile(path.join(workRecordDir, 'wr_conv_recent_prompt_05.md'), '# recent prompt 05 fallback should not be used\n\nID: wr_conv_recent_prompt_05\n\n## Summary\n\nWORK-05-fallback-should-not-replace-explicit-missing-link.\n', 'utf8');
  await fs.writeFile(path.join(workRecordDir, 'wr_hidden_recent_prompt_06.md'), '# hidden recent prompt 06\n\nID: wr_hidden_recent_prompt_06\n\n## Summary\n\nHIDDEN-WORK-06-should-not-leak.\n', 'utf8');

  let prompt = '';
  await runConversationTurn({
    root,
    id: 'conv_recent_prompt_turn_001',
    characterId: 'lina',
    playerInput: '今日は別件の確認だけしたい。',
    now: '2026-05-05T06:30:00.000+09:00',
    chatProvider: async ({ prompt: receivedPrompt }) => {
      prompt = receivedPrompt;
      return '別件ですね。順番に確認します。';
    }
  });

  assert.match(prompt, /MEMORY-01-oldest-kept/);
  assert.match(prompt, /MEMORY-02-older-kept/);
  assert.match(prompt, /MEMORY-05-recent-missing-work-record-kept/);
  assert.doesNotMatch(prompt, /MEMORY-03-recent-linked-replaced/);
  assert.doesNotMatch(prompt, /MEMORY-04-recent-source-fallback-replaced/);
  assert.doesNotMatch(prompt, /MEMORY-06-hidden-not-a-prompt-candidate/);
  assert.match(prompt, /WORK-03-detail-from-linked-work-record/);
  assert.match(prompt, /WORK-04-detail-from-source-conversation-fallback/);
  assert.doesNotMatch(prompt, /WORK-05-fallback-should-not-replace-explicit-missing-link/);
  assert.doesNotMatch(prompt, /HIDDEN-WORK-06-should-not-leak/);
});


test('editing a past user message rewinds the active conversation to that turn and regenerates from the edited text', async () => {
  const root = await fixtureRoot();
  await runConversationOpening({
    root,
    id: 'conv_edit_001',
    characterId: 'lina',
    now: '2026-05-05T06:00:00.000+09:00',
    chatProvider: async () => 'ここから話しましょう。'
  });
  await runConversationTurn({
    root,
    id: 'conv_edit_001',
    characterId: 'lina',
    playerInput: '最初の発言',
    now: '2026-05-05T06:01:00.000+09:00',
    emotionProvider: async () => ({ expression: 'neutral' }),
    chatProvider: async ({ playerInput }) => `返答:${playerInput}`
  });
  await runConversationTurn({
    root,
    id: 'conv_edit_001',
    characterId: 'lina',
    playerInput: '後続の発言',
    now: '2026-05-05T06:02:00.000+09:00',
    emotionProvider: async () => ({ expression: 'happy' }),
    chatProvider: async ({ playerInput }) => `後続返答:${playerInput}`
  });
  await fs.writeFile(path.join(root, 'game_data/player_inventory.json'), `${JSON.stringify({
    money: 150,
    items: [{ item_id: 'eternel_cube', quantity: 1 }]
  }, null, 2)}
`, 'utf8');

  const edited = await editConversationUserMessage({
    root,
    characterId: 'lina',
    messageIndex: 1,
    content: '編集後の最初の発言',
    now: '2026-05-05T06:03:00.000+09:00',
    emotionProvider: async ({ playerInput, currentConversation }) => {
      assert.equal(playerInput, '編集後の最初の発言');
      assert.deepEqual(currentConversation.map((message) => message.content), ['ここから話しましょう。']);
      return { expression: 'surprised' };
    },
    chatProvider: async ({ playerInput }) => `編集後返答:${playerInput}`
  });

  assert.deepEqual(edited.conversation.messages.map((message) => message.content), [
    'ここから話しましょう。',
    '編集後の最初の発言',
    '編集後返答:編集後の最初の発言'
  ]);
  assert.equal(edited.conversation.messages[2].expression, 'surprised');
  assert.equal(edited.rewound_from_message_count, 5);
  assert.equal(edited.edited_message_index, 1);
  const persisted = await readJson(root, 'game_data/logs/conversations/conv_edit_001.json');
  assert.deepEqual(persisted.messages.map((message) => message.content), edited.conversation.messages.map((message) => message.content));
});


test('editing a past user message requires the Eterneru Cube inventory item', async () => {
  const root = await fixtureRoot();
  await runConversationOpening({
    root,
    id: 'conv_edit_requires_cube_001',
    characterId: 'lina',
    now: '2026-05-05T06:00:00.000+09:00',
    chatProvider: async () => 'ここから話しましょう。'
  });
  await runConversationTurn({
    root,
    id: 'conv_edit_requires_cube_001',
    characterId: 'lina',
    playerInput: '最初の発言',
    now: '2026-05-05T06:01:00.000+09:00',
    chatProvider: async ({ playerInput }) => `返答:${playerInput}`
  });

  await assert.rejects(
    editConversationUserMessage({
      root,
      characterId: 'lina',
      messageIndex: 1,
      content: '編集できない発言',
      now: '2026-05-05T06:02:00.000+09:00'
    }),
    /conversation_edit_item_required/
  );

  await fs.writeFile(path.join(root, 'game_data/player_inventory.json'), `${JSON.stringify({
    money: 150,
    items: [{ item_id: 'eternel_cube', quantity: 1 }]
  }, null, 2)}
`, 'utf8');

  const edited = await editConversationUserMessage({
    root,
    characterId: 'lina',
    messageIndex: 1,
    content: '編集できる発言',
    now: '2026-05-05T06:03:00.000+09:00',
    chatProvider: async ({ playerInput }) => `編集後返答:${playerInput}`
  });

  assert.deepEqual(edited.conversation.messages.map((message) => message.content), [
    'ここから話しましょう。',
    '編集できる発言',
    '編集後返答:編集できる発言'
  ]);
});


test('finalizeConversation always writes memory and work record, and only writes a skill when the necessity pass says true', async () => {
  const root = await fixtureRoot();
  await runConversationTurn({
    root,
    id: 'conv_skill_gate_false_001',
    characterId: 'lina',
    playerInput: '今日は記録だけ残しておこう',
    now: '2026-05-05T06:10:00.000+09:00',
    chatProvider: async () => '……はい。記録に残すことを優先しましょう。'
  });

  let skillWriterCalled = false;
  const skipped = await finalizeConversation({
    root,
    conversationId: 'conv_skill_gate_false_001',
    characterId: 'lina',
    now: '2026-05-05T06:11:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    skillUpdateProvider: async () => {
      skillWriterCalled = true;
      throw new Error('skill writer should not run when the necessity pass says false');
    }
  });

  assert.equal(skillWriterCalled, false);
  assert.equal(skipped.skill_update.skipped, true);
  assert.equal(skipped.skill_update.reason, 'no_decisive_behavior_change');
  assert.equal(skipped.skill_update.raw_answer, 'false');
  assert.equal(skipped.validator.accepted_memory.length, 1);
  assert.deepEqual(skipped.validator.accepted_skills, []);
  assert.deepEqual(skipped.validator.rejected_skills, []);
  assert.equal(Boolean(skipped.validator.accepted_work_record), true);
  assert.equal(await exists(root, 'game_data/characters/lina/memory/mem_conv_skill_gate_false_001.json'), true);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_skill_gate_false_001.md'), true);
  assert.equal((await readJson(root, 'game_data/characters/lina/skills.json')).skills.some((skill) => skill.id === 'skill_conv_skill_gate_false_001'), false);

  await runConversationTurn({
    root,
    id: 'conv_skill_gate_true_001',
    characterId: 'lina',
    playerInput: '今度は少し変わった気がする',
    now: '2026-05-05T06:12:00.000+09:00',
    chatProvider: async () => '……はい。その変化も、短く確かめておきましょう。'
  });

  const occurred = await finalizeConversation({
    root,
    conversationId: 'conv_skill_gate_true_001',
    characterId: 'lina',
    now: '2026-05-05T06:13:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  assert.equal(occurred.skill_update.skipped, undefined);
  assert.equal(occurred.validator.accepted_memory.length, 1);
  assert.equal(occurred.validator.accepted_skills.length, 1);
  assert.equal(Boolean(occurred.validator.accepted_work_record), true);
  assert.equal((await readJson(root, 'game_data/characters/lina/skills.json')).skills.some((skill) => skill.id === 'skill_conv_skill_gate_true_001'), true);

  await runConversationTurn({
    root,
    id: 'conv_skill_gate_invalid_001',
    characterId: 'lina',
    playerInput: '曖昧な変化だったかもしれない',
    now: '2026-05-05T06:14:00.000+09:00',
    chatProvider: async () => '……まだ言葉にするには早いかもしれません。'
  });

  let invalidSkillWriterCalled = false;
  const invalid = await finalizeConversation({
    root,
    conversationId: 'conv_skill_gate_invalid_001',
    characterId: 'lina',
    now: '2026-05-05T06:15:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: null, raw_answer: 'maybe' }),
    skillUpdateProvider: async () => {
      invalidSkillWriterCalled = true;
      throw new Error('skill writer should not run when the necessity answer is invalid');
    }
  });

  assert.equal(invalidSkillWriterCalled, false);
  assert.equal(invalid.skill_update.skipped, true);
  assert.equal(invalid.skill_update.reason, 'invalid_skill_necessity_answer');
  assert.equal(invalid.skill_update.raw_answer, 'maybe');
  assert.deepEqual(invalid.validator.accepted_skills, []);
  assert.equal((await readJson(root, 'game_data/characters/lina/skills.json')).skills.some((skill) => skill.id === 'skill_conv_skill_gate_invalid_001'), false);
});


test('runConversationTurn appends active turns; finalize separately writes memory, skill, work record and discards session text', async () => {
  const root = await fixtureRoot();
  const initialState = await readJson(root, 'game_data/runtime_state.json');
  await writeSplitJson(root, 'game_data/runtime_state.json', { ...initialState, elapsed_weeks: 2 });
  let secondPrompt = '';
  let firstEmotionPrompt = '';
  const emotionAndChatOrder = [];
  const first = await runConversationTurn({
    root,
    id: 'conv_test_001',
    characterId: 'lina',
    playerInput: '棚札の順番、確認してもいい？',
    now: '2026-05-05T05:45:00.000+09:00',
    emotionProvider: async ({ prompt, playerInput, profile }) => {
      emotionAndChatOrder.push('emotion');
      assert.equal(playerInput, '棚札の順番、確認してもいい？');
      assert.equal(profile.display_name, 'リナ・クラウゼ');
      firstEmotionPrompt = prompt;
      assert.match(prompt.trim().split('\n').at(-1), /リナ・クラウゼとして、彼我の能力値を参照した上で、数値と言動が矛盾しないよう注意しつつ、現在の場面に自然に続く感情を次から1つだけ選択する。/);
      assert.doesNotMatch(prompt, /次のプレイヤー入力を受け取った直後のリナ・クラウゼの感情/);
      return { expression: 'worried' };
    },
    onEmotion: (emotion) => {
      assert.deepEqual(emotion, { expression: 'worried', face_emotion_variant_id: 'face_worried' });
    },
    chatProvider: async ({ prompt }) => {
      emotionAndChatOrder.push('chat');
      assert.deepEqual(emotionAndChatOrder, ['emotion', 'chat']);
      assert.deepEqual(firstEmotionPrompt.trim().split('\n').slice(0, -1), prompt.trim().split('\n').slice(0, -1));
      assert.match(prompt.trim().split('\n').at(-1), /リナ・クラウゼとして、彼我の能力値を参照した上で、数値と言動が矛盾しないよう注意しつつ、現在の場面に自然に続く返答だけを書く。発話は一度に1〜3文程度にする。発言内容に鉤括弧はつけない。振る舞いなどには丸括弧をつける。発話すること自体が不自然な場合は振る舞いなどのみを書く。/);
      assert.match(prompt, /^星灯魔法学院の2年生、薬草学研究会に所属するリナ・クラウゼへの完全な没入によって応答する。/);
      assert.doesNotMatch(prompt, /prompt builderの除外確認用/);
      assert.doesNotMatch(prompt, /イベント背景/);
      return '……はい。棚札と水やりの記録を、順番に見比べてみましょう。';
    }
  });

  assert.equal(first.conversation.id, 'conv_test_001');
  assert.equal(first.state.current_screen, 'interaction');
  assert.equal(first.state.current_interaction_character_id, 'lina');
  assert.equal(first.state.last_conversation_id, 'conv_test_001');
  assert.equal(first.conversation.messages.at(-1).expression, 'worried');
  assert.equal(first.conversation.messages.at(-1).face_emotion_variant_id, 'face_worried');
  assert.equal(await exists(root, 'game_data/logs/conversations/conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/logs/memory_updates/conv_test_001.json'), false);
  assert.equal(await exists(root, 'game_data/logs/skill_updates/conv_test_001.json'), false);
  assert.equal(await exists(root, 'game_data/logs/work_record_updates/conv_test_001.json'), false);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_test_001.md'), false);

  const second = await runConversationTurn({
    root,
    characterId: 'lina',
    playerInput: '水やりの記録はどこにある？',
    now: '2026-05-05T05:46:00.000+09:00',
    chatProvider: async ({ prompt }) => {
      secondPrompt = prompt;
      assert.match(prompt, /直前までの会話:/);
      assert.match(prompt, /プレイヤー: 棚札の順番、確認してもいい？/);
      assert.match(prompt, /リナ・クラウゼ: ……はい。棚札と水やりの記録/);
      return '薬草園の記録棚にあります。日付順に見れば、入れ替わった場所が分かるはずです。';
    }
  });

  assert.equal(second.conversation.id, 'conv_test_001');
  assert.equal(second.conversation.messages.length, 4);
  assert.match(secondPrompt, /水やりの記録はどこにある？/);
  assert.equal(await exists(root, 'game_data/logs/memory_updates/conv_test_001.json'), false);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_test_001.md'), false);

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_test_001',
    characterId: 'lina',
    now: '2026-05-05T05:47:00.000+09:00',
    memoryUpdateProvider: async ({ conversation, workRecordId }) => ({
      memory_record: {
        character_id: 'lina',
        id: 'mem_from_conv_test_001',
        type: 'relationship_change',
        text: 'リナは、主人公が棚札の違いを一緒に確認したことで、主人公を丁寧に状況確認できる相手として少し信頼した。',
        visibility: 'private',
        source_conversation_id: conversation.id,
        work_record_id: workRecordId,
        tags: ['リナ', '薬草園', '棚札']
      }
    }),
    skillUpdateProvider: async ({ conversation, workRecordId }) => ({
      skill_record: {
        character_id: 'lina',
        id: 'skill_from_conv_test_001',
        type: 'self_change',
        name: '会話からの自己変化',
        description: 'リナは主人公と棚札の順番を確認した経験から、気になる点を一人で抱え込まず共有して調べる意識を強めた。',
        visibility: 'private',
        source_conversation_id: conversation.id,
        work_record_id: workRecordId,
        tags: ['リナ', '自己変化']
      }
    }),
    workRecordProvider: async ({ conversation, workRecordId }) => ({
      work_record: {
        id: workRecordId,
        character_id: 'lina',
        source_conversation_id: conversation.id,
        title: '放課後の薬草園で棚札の順番について話した',
        summary: '主人公は棚札の順番が記録と違うと考え、リナに確認した。リナは棚札と水やりの記録を見比べ、落ち着いて原因を探そうとした。主人公が記録の場所について続けて聞いたことで、二人は現場の違和感を一緒に確認する流れを作った。',
        participants: ['player', 'lina'],
        future_hooks: ['薬草園の記録棚を確認する'],
        retrieval_tags: ['リナ', '薬草園', '棚札'],
        flag_update_candidates: [
          { character_id: 'lina', flag: 'knowledge.lina.player_checked_garden_label', op: 'set', value: true },
          { character_id: 'lina', flag: 'relationship.lina.trust', op: 'increment', value: 1 },
          { character_id: 'lina', flag: 'story.archive_intro_done', op: 'set', value: true }
        ],
        warnings: []
      }
    }),
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  assert.equal(finalized.validator.accepted_flags.length, 3);
  assert.equal(finalized.validator.accepted_memory[0].work_record_id, 'wr_conv_test_001');
  assert.equal(finalized.validator.accepted_memory[0].visibility, 'character_known');
  assert.equal(finalized.validator.accepted_skills[0].work_record_id, 'wr_conv_test_001');
  assert.equal(finalized.validator.accepted_skills[0].visibility, 'character_known');
  assert.equal(finalized.validator.accepted_work_record.title, '放課後の薬草園で棚札の順番について話した');
  assert.equal(finalized.validator.accepted_work_record.academy_week_number, 3);
  assert.equal(finalized.validator.accepted_work_record.academy_elapsed_weeks_at_start, 2);
  assert.equal(finalized.validator.accepted_work_record.participants, undefined);
  assert.equal(finalized.validator.accepted_work_record.future_hooks, undefined);
  assert.equal(finalized.validator.accepted_work_record.retrieval_tags, undefined);
  assert.equal(finalized.state.current_screen, 'academy-room');
  assert.equal(finalized.state.current_interaction_character_id, null);
  assert.equal(finalized.state.characters.lina.flags['knowledge.lina.player_checked_garden_label'], true);
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.trust'], 1);
  assert.equal(finalized.state.global_flags['story.archive_intro_done'], true);
  assert.equal(await exists(root, 'game_data/logs/memory_updates/conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/logs/skill_updates/conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/logs/work_record_updates/conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/logs/validator/conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/characters/lina/memory/mem_from_conv_test_001.json'), true);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_test_001.md'), true);

  const conversationLog = await readJson(root, 'game_data/logs/conversations/conv_test_001.json');
  assert.equal(conversationLog.academy_week_number, 3);
  assert.equal(conversationLog.academy_elapsed_weeks_at_start, 2);
  assert.equal(conversationLog.discarded_after_work_record_id, 'wr_conv_test_001');
  assert.equal(conversationLog.messages.length, 0);
  assert.equal(conversationLog.prompt_discarded, true);
  const workRecordMarkdown = await fs.readFile(path.join(root, 'game_data/characters/lina/work_records/wr_conv_test_001.md'), 'utf8');
  assert.doesNotMatch(workRecordMarkdown, /record_role:/);
  assert.match(workRecordMarkdown, /# 放課後の薬草園で棚札の順番について話した/);
  assert.match(workRecordMarkdown, /ID: wr_conv_test_001/);
  assert.match(workRecordMarkdown, /## 第3週のサマリー/);
  assert.doesNotMatch(workRecordMarkdown, /## Summary/);
  assert.doesNotMatch(workRecordMarkdown, /## Participants/);
  assert.doesNotMatch(workRecordMarkdown, /## Future hooks/);
  assert.doesNotMatch(workRecordMarkdown, /## Retrieval tags/);
  assert.doesNotMatch(workRecordMarkdown, /水やりの記録はどこにある？/);

  const skills = await readJson(root, 'game_data/characters/lina/skills.json');
  assert.equal(skills.skills.some((skill) => skill.id === 'skill_from_conv_test_001' && skill.work_record_id === 'wr_conv_test_001' && skill.visibility === 'character_known'), true);
  const memory = await readJson(root, 'game_data/characters/lina/memory/mem_from_conv_test_001.json');
  assert.equal(memory.visibility, 'character_known');
  const characterFlags = await readJson(root, 'game_data/characters/lina/flags.json');
  assert.equal(characterFlags['knowledge.lina.player_checked_garden_label'], true);
  assert.equal(characterFlags['relationship.lina.trust'], 1);
});


test('finalizeConversation preserves training progress written while finalization is running', async () => {
  const root = await fixtureRoot();
  await runConversationOpening({
    root,
    id: 'conv_training_race_001',
    characterId: 'lina',
    now: '2026-05-05T06:00:00.000+09:00',
    chatProvider: async () => 'ここから話しましょう。'
  });
  await runConversationTurn({
    root,
    id: 'conv_training_race_001',
    characterId: 'lina',
    playerInput: '鍛錬に入る前に確認したい',
    now: '2026-05-05T06:01:00.000+09:00',
    emotionProvider: async () => ({ expression: 'neutral' }),
    chatProvider: async () => '確認できました。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_training_race_001',
    characterId: 'lina',
    now: '2026-05-05T06:02:00.000+09:00',
    memoryUpdateProvider: async ({ state }) => {
      await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify({
        ...state,
        current_screen: 'academy-room',
        current_interaction_character_id: null,
        training_actions_used: 3,
        training_actions_limit: 6
      }, null, 2)}\n`, 'utf8');
      return { memories: [] };
    },
    skillUpdateProvider: async () => ({ skills: [] }),
    workRecordProvider: async ({ conversation, workRecordId }) => ({
      work_record: {
        id: workRecordId,
        character_id: 'lina',
        source_conversation_id: conversation.id,
        title: '鍛錬前の確認',
        summary: '主人公とリナは鍛錬に入る前の確認をした。',
        flag_update_candidates: []
      }
    }),
    stageFlagJudgmentProvider: async () => ({ judgments: [] }),
    eventFlagJudgmentProvider: async () => ({ judgments: [] }),
    eventParticipantOverrideJudgmentProvider: async () => ({ judgments: [] }),
    eventCompletionJudgmentProvider: async () => ({ completions: [] }),
    moneyDeltaProvider: async () => ({ delta: 0 }),
    buddyAgreementProvider: async () => 'false',
    enemyHostilityProvider: async () => 'false',
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  assert.equal(finalized.state.current_screen, 'academy-room');
  assert.equal(finalized.state.training_actions_used, 3);
  assert.equal(finalized.state.training_actions_limit, 6);
  const persisted = await readJson(root, 'game_data/runtime_state.json');
  assert.equal(persisted.training_actions_used, 3);
});


test('finalizeConversation preserves newer academy progression written while finalization is running', async () => {
  const root = await fixtureRoot();
  await runConversationOpening({
    root,
    id: 'conv_week_race_001',
    characterId: 'lina',
    now: '2026-05-05T06:03:00.000+09:00',
    chatProvider: async () => 'ここから話しましょう。'
  });
  await runConversationTurn({
    root,
    id: 'conv_week_race_001',
    characterId: 'lina',
    playerInput: '次の週へ進む前に少しだけ話したい',
    now: '2026-05-05T06:04:00.000+09:00',
    emotionProvider: async () => ({ expression: 'neutral' }),
    chatProvider: async () => '分かりました。ここで区切って進めましょう。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_week_race_001',
    characterId: 'lina',
    now: '2026-05-05T06:05:00.000+09:00',
    memoryUpdateProvider: async ({ state }) => {
      await fs.writeFile(path.join(root, 'game_data/runtime_state.json'), `${JSON.stringify({
        ...state,
        current_screen: 'academy-map',
        current_interaction_character_id: null,
        training_actions_used: 0,
        training_actions_limit: 6,
        elapsed_weeks: 1,
        ending_started: true,
        ending_completed: false,
        ending_character_id: 'lina'
      }, null, 2)}\n`, 'utf8');
      return { memories: [] };
    },
    skillUpdateProvider: async () => ({ skills: [] }),
    workRecordProvider: async ({ conversation, workRecordId }) => ({
      work_record: {
        id: workRecordId,
        character_id: 'lina',
        source_conversation_id: conversation.id,
        title: '次週進行前の会話',
        summary: '主人公とリナは次の週へ進む前に短く話した。',
        flag_update_candidates: []
      }
    }),
    stageFlagJudgmentProvider: async () => ({ judgments: [] }),
    eventFlagJudgmentProvider: async () => ({ judgments: [] }),
    eventParticipantOverrideJudgmentProvider: async () => ({ judgments: [] }),
    eventCompletionJudgmentProvider: async () => ({ completions: [] }),
    moneyDeltaProvider: async () => ({ delta: 0 }),
    buddyAgreementProvider: async () => 'false',
    enemyHostilityProvider: async () => 'false',
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  assert.equal(finalized.state.current_screen, 'academy-map');
  assert.equal(finalized.state.elapsed_weeks, 1);
  assert.equal(finalized.state.training_actions_used, 0);
  assert.equal(finalized.state.ending_started, true);
  assert.equal(finalized.state.ending_completed, false);
  assert.equal(finalized.state.ending_character_id, 'lina');
  const persisted = await readJson(root, 'game_data/runtime_state.json');
  assert.equal(persisted.current_screen, 'academy-map');
  assert.equal(persisted.elapsed_weeks, 1);
  assert.equal(persisted.ending_started, true);
  assert.equal(persisted.ending_character_id, 'lina');
  assert.equal(finalized.validator.accepted_work_record.academy_week_number, 1);
  assert.equal(finalized.validator.accepted_work_record.academy_elapsed_weeks_at_start, 0);
  const workRecordMarkdown = await fs.readFile(path.join(root, 'game_data/characters/lina/work_records/wr_conv_week_race_001.md'), 'utf8');
  assert.match(workRecordMarkdown, /## 第1週のサマリー/);
  assert.doesNotMatch(workRecordMarkdown, /## 第2週のサマリー/);
});


test('finalizeConversation keeps five-sentence memory text before validation so work-record success does not discard memory detail', async () => {
  const root = await fixtureRoot();
  await runConversationTurn({
    root,
    id: 'conv_memory_clamp_001',
    characterId: 'lina',
    playerInput: 'この棚札、昨日と違う気がする',
    now: '2026-05-05T05:55:00.000+09:00',
    chatProvider: async () => '……はい。記録と現物を見比べて、変わった箇所を一緒に確かめましょう。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_memory_clamp_001',
    characterId: 'lina',
    now: '2026-05-05T05:56:00.000+09:00',
    memoryUpdateProvider: async ({ conversation, workRecordId }) => ({
      memory_record: {
        character_id: 'lina',
        id: 'mem_memory_clamp_001',
        type: 'relationship_change',
        text: '主人公は棚札の違いに気づいた。リナはその観察を具体的な手がかりとして受け止めた。二人は記録と現物を見比べる流れになった。リナは主人公の着眼点を信頼した。次も違和感を共有してよい相手だと感じた。',
        visibility: 'character_known',
        source_conversation_id: conversation.id,
        work_record_id: workRecordId,
        tags: ['棚札']
      }
    }),
    skillUpdateProvider: async ({ conversation, workRecordId }) => ({
      skill_record: {
        character_id: 'lina',
        id: 'skill_memory_clamp_001',
        type: 'self_change',
        name: '観察共有への意識',
        description: 'リナは主人公の観察を手がかりとして受け止め、一緒に確認する姿勢を強めた。',
        visibility: 'character_known',
        source_conversation_id: conversation.id,
        work_record_id: workRecordId,
        tags: []
      }
    }),
    workRecordProvider: async ({ conversation, workRecordId }) => ({
      work_record: {
        id: workRecordId,
        character_id: 'lina',
        source_conversation_id: conversation.id,
        title: '棚札の違いを一緒に確認した',
        summary: '主人公は棚札の違いに気づき、リナに確認を求めた。リナは記録と現物を見比べて、変わった箇所を一緒に確かめようとした。',
        flag_update_candidates: [],
        warnings: []
      }
    }),
    skillNecessityProvider: async () => ({ necessary: true, raw_answer: 'true' })
  });

  assert.equal(finalized.validator.rejected_memory.length, 0);
  assert.equal(finalized.validator.accepted_memory[0].text, '主人公は棚札の違いに気づいた。リナはその観察を具体的な手がかりとして受け止めた。二人は記録と現物を見比べる流れになった。リナは主人公の着眼点を信頼した。次も違和感を共有してよい相手だと感じた。');
  const memory = await readJson(root, 'game_data/characters/lina/memory/mem_memory_clamp_001.json');
  assert.equal(memory.text, finalized.validator.accepted_memory[0].text);
  assert.equal(await exists(root, 'game_data/characters/lina/work_records/wr_conv_memory_clamp_001.md'), true);
});

test('runConversationTurn judges continuation after generated speech and before work-record recall', async () => {
  const root = await fixtureRoot();
  const memoryDir = path.join(root, 'game_data/characters/lina/memory');
  const workRecordDir = path.join(root, 'game_data/characters/lina/work_records');
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(workRecordDir, { recursive: true });
  await fs.writeFile(path.join(memoryDir, 'mem_continue_judgment.json'), JSON.stringify({
    id: 'mem_continue_judgment',
    character_id: 'lina',
    visibility: 'character_known',
    type: 'relationship_change',
    text: 'リナは主人公が会話継続を丁寧に確認したことを覚えている。',
    work_record_id: 'wr_continue_judgment'
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workRecordDir, 'wr_continue_judgment.md'), '# 会話継続確認\n\nID: wr_continue_judgment\n\n## Summary\n\n主人公は話し続けてよいか確認した。\n', 'utf8');
  const order = [];
  let judgmentPrompt = '';
  let recallSawFinalMessages = false;

  const result = await runConversationTurn({
    root,
    id: 'conv_continue_judgment_001',
    characterId: 'lina',
    playerInput: 'まだ話していてもいい？',
    now: '2026-05-05T06:05:00.000+09:00',
    emotionProvider: async () => ({ expression: 'neutral' }),
    chatProvider: async () => {
      order.push('chat');
      return '……はい。もう少しなら続けられます。';
    },
    conversationContinuationProvider: async ({ prompt, generatedAssistantText, currentConversation }) => {
      order.push('continuation');
      judgmentPrompt = prompt;
      assert.equal(generatedAssistantText, '……はい。もう少しなら続けられます。');
      assert.deepEqual(currentConversation.map((message) => message.content), ['まだ話していてもいい？', '……はい。もう少しなら続けられます。']);
      assert.match(prompt, /プレイヤーの発言: まだ話していてもいい？/);
      assert.match(prompt.trim().split('\n').at(-1), /会話を継続したいと思うか。/);
      return 'true';
    },
    onAssistantComplete: ({ content }) => {
      order.push('assistant_complete');
      assert.equal(content, '……はい。もう少しなら続けられます。');
    },
    workRecordRecallProvider: async ({ currentConversation }) => {
      order.push('recall');
      recallSawFinalMessages = currentConversation.at(-1)?.content === '……はい。もう少しなら続けられます。';
      return { work_record_ids: [] };
    }
  });

  assert.deepEqual(order, ['chat', 'assistant_complete', 'continuation', 'recall']);
  assert.equal(recallSawFinalMessages, true);
  assert.match(judgmentPrompt, /継続したい場合はtrue。継続したくない場合はfalse。/);
  assert.equal(result.conversation.conversation_continuation.continue_conversation, true);
  assert.equal(result.conversation.messages.at(-1).content, '……はい。もう少しなら続けられます。');
});

test('runConversationTurn appends a cutoff reply after the generated speech when continuation judgment is false', async () => {
  const root = await fixtureRoot();
  const order = [];
  let cutoffPrompt = '';

  const result = await runConversationTurn({
    root,
    id: 'conv_cutoff_001',
    characterId: 'lina',
    playerInput: 'これ以上ずっと付き合ってよ',
    now: '2026-05-05T06:06:00.000+09:00',
    emotionProvider: async () => ({ expression: 'tired' }),
    chatProvider: async () => {
      order.push('chat');
      return '……ええ、必要ならまだ聞きます。';
    },
    conversationContinuationProvider: async () => {
      order.push('continuation');
      return 'false';
    },
    conversationCutoffProvider: async ({ prompt, generatedAssistantText }) => {
      order.push('cutoff');
      cutoffPrompt = prompt;
      assert.equal(generatedAssistantText, '……ええ、必要ならまだ聞きます。');
      assert.match(prompt, /プレイヤーの発言: これ以上ずっと付き合ってよ/);
      assert.match(prompt, /先ほど自分が生成した発言: ……ええ、必要ならまだ聞きます。/);
      assert.match(prompt.trim().split('\n').at(-1), /この会話を切り上げる。/);
      return 'すみません、今日はここで区切ります。（薬瓶の位置を静かに整える）また必要な時に声をかけてください。';
    },
    onAssistantComplete: ({ content }) => {
      order.push('assistant_complete');
      if (order.filter((item) => item === 'assistant_complete').length === 1) {
        assert.equal(content, '……ええ、必要ならまだ聞きます。');
        return;
      }
      assert.match(content, /今日はここで区切ります/);
    },
    workRecordRecallProvider: async () => {
      order.push('recall');
      return { work_record_ids: [] };
    }
  });

  assert.deepEqual(order, ['chat', 'assistant_complete', 'continuation', 'cutoff', 'assistant_complete']);
  assert.match(cutoffPrompt, /発言内容に鉤括弧はつけない。振る舞いなどには丸括弧をつける。/);
  assert.equal(result.conversation.conversation_continuation.continue_conversation, false);
  assert.equal(result.conversation.conversation_continuation.generated_assistant_text, '……ええ、必要ならまだ聞きます。');
  assert.equal(result.conversation.conversation_continuation.cutoff_assistant_text, 'すみません、今日はここで区切ります。（薬瓶の位置を静かに整える）また必要な時に声をかけてください。');
  assert.deepEqual(result.conversation.messages.slice(-2).map((message) => message.content), [
    '……ええ、必要ならまだ聞きます。',
    'すみません、今日はここで区切ります。（薬瓶の位置を静かに整える）また必要な時に声をかけてください。'
  ]);
});

test('finalizeConversation asks for a numeric money delta after conversation and applies it to player inventory', async () => {
  const root = await fixtureRoot();
  await fs.writeFile(path.join(root, 'game_data/player_inventory.json'), JSON.stringify({ money: 120, items: [] }, null, 2), 'utf8');
  await runConversationTurn({
    root,
    id: 'conv_money_delta_001',
    characterId: 'lina',
    playerInput: 'この銀葉を30マナで譲るよ',
    now: '2026-05-05T06:20:00.000+09:00',
    chatProvider: async () => '助かります。では30マナを渡します。'
  });

  let moneyPrompt = '';
  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_money_delta_001',
    characterId: 'lina',
    now: '2026-05-05T06:21:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    moneyDeltaProvider: async ({ prompt, conversation, currentMoney }) => {
      moneyPrompt = prompt;
      assert.equal(conversation.id, 'conv_money_delta_001');
      assert.equal(currentMoney, 120);
      assert.match(prompt, /会話前後で増減したユーザーの所持金/);
      assert.match(prompt, /数値のみ/);
      assert.match(prompt, /この銀葉を30マナで譲るよ/);
      assert.doesNotMatch(prompt, /会話全文をそのまま別用途へ転載しない/);
      assert.doesNotMatch(prompt, /memory、skill\/self_change、work_record、舞台フラグ、所持金判定は別々に扱われる/);
      assert.doesNotMatch(prompt, /現在のユーザー所持金:/);
      const expectedEvidence = JSON.stringify({
        conversation_id: 'conv_money_delta_001',
        character_id: 'lina',
        character_name: 'リナ・クラウゼ',
        work_record_id: 'wr_conv_money_delta_001',
        source_type: 'field',
        location_id: 'herbology_garden',
        time_slot: 'after_school',
        messages: [
          { role: 'user', content: 'この銀葉を30マナで譲るよ' },
          { role: 'assistant', content: '助かります。では30マナを渡します。', expression: 'neutral', face_emotion_variant_id: 'face_neutral' }
        ]
      }, null, 2);
      assert.equal(prompt.split('\n\n').slice(0, 2).join('\n\n'), [
        '次の会話セッションだけを根拠に、会話終了後の処理を1つ実行する。',
        '根拠はここに示す会話セッションだけ。',
        '',
        expectedEvidence
      ].join('\n'));
      return '30';
    }
  });

  assert.match(moneyPrompt, /30マナを渡します/);
  assert.equal(finalized.money_update.delta, 30);
  assert.equal(finalized.money_update.before_money, 120);
  assert.equal(finalized.money_update.after_money, 150);
  const inventory = await readJson(root, 'game_data/player_inventory.json');
  assert.equal(inventory.money, 150);
  const moneyLog = await readJson(root, 'game_data/logs/money_updates/conv_money_delta_001.json');
  assert.equal(moneyLog.delta, 30);
  assert.equal(moneyLog.raw_answer, '30');
});


test('finalizeConversation does not apply the same money delta twice when retried after a later failure', async () => {
  const root = await fixtureRoot();
  await fs.writeFile(path.join(root, 'game_data/player_inventory.json'), JSON.stringify({ money: 120, items: [] }, null, 2), 'utf8');
  await runConversationTurn({
    root,
    id: 'conv_money_retry_001',
    characterId: 'lina',
    playerInput: 'この銀葉を30マナで譲るよ',
    now: '2026-05-05T06:22:00.000+09:00',
    chatProvider: async () => '助かります。では30マナを渡します。'
  });

  await assert.rejects(
    finalizeConversation({
      root,
      conversationId: 'conv_money_retry_001',
      characterId: 'lina',
      now: '2026-05-05T06:23:00.000+09:00',
      skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
      moneyDeltaProvider: async () => '30',
      buddyAgreementProvider: async () => {
        throw new Error('buddy_update_failed_after_money');
      }
    }),
    /buddy_update_failed_after_money/
  );

  const inventoryAfterFailure = await readJson(root, 'game_data/player_inventory.json');
  assert.equal(inventoryAfterFailure.money, 150);

  const retried = await finalizeConversation({
    root,
    conversationId: 'conv_money_retry_001',
    characterId: 'lina',
    now: '2026-05-05T06:24:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    moneyDeltaProvider: async () => '30',
    buddyAgreementProvider: async () => 'false'
  });

  assert.equal(retried.money_update.delta, 30);
  assert.equal(retried.money_update.before_money, 120);
  assert.equal(retried.money_update.after_money, 150);
  assert.equal(retried.money_update.already_applied, true);
  const inventoryAfterRetry = await readJson(root, 'game_data/player_inventory.json');
  assert.equal(inventoryAfterRetry.money, 150);
  const moneyLog = await readJson(root, 'game_data/logs/money_updates/conv_money_retry_001.json');
  assert.equal(moneyLog.after_money, 150);
  assert.equal(moneyLog.already_applied, true);
});


test('finalizeConversation judges mutual buddy agreement after conversation and persists the character buddy flag', async () => {
  const root = await fixtureRoot();
  await runConversationTurn({
    root,
    id: 'conv_buddy_agreement_001',
    characterId: 'lina',
    playerInput: 'これからは二人でバディになろう。いい？',
    now: '2026-05-05T06:30:00.000+09:00',
    chatProvider: async () => '……はい。リナも、あなたとバディになります。'
  });

  let buddyPrompt = '';
  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_buddy_agreement_001',
    characterId: 'lina',
    now: '2026-05-05T06:31:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    buddyAgreementProvider: async ({ prompt, conversation, characterId, characterName }) => {
      buddyPrompt = prompt;
      assert.equal(conversation.id, 'conv_buddy_agreement_001');
      assert.equal(characterId, 'lina');
      assert.equal(characterName, 'リナ・クラウゼ');
      assert.match(prompt, /バディになる合意が相互に成立したか/);
      assert.match(prompt, /回答はtrueもしくはfalseのみ/);
      assert.match(prompt, /二人でバディになろう/);
      assert.match(prompt, /リナも、あなたとバディになります/);
      assert.doesNotMatch(prompt, /現在のバディ状態:/);
      const expectedEvidence = JSON.stringify({
        conversation_id: 'conv_buddy_agreement_001',
        character_id: 'lina',
        character_name: 'リナ・クラウゼ',
        work_record_id: 'wr_conv_buddy_agreement_001',
        source_type: 'field',
        location_id: 'herbology_garden',
        time_slot: 'after_school',
        messages: [
          { role: 'user', content: 'これからは二人でバディになろう。いい？' },
          { role: 'assistant', content: '……はい。リナも、あなたとバディになります。', expression: 'neutral', face_emotion_variant_id: 'face_neutral' }
        ]
      }, null, 2);
      assert.equal(prompt.split('\n\n').slice(0, 2).join('\n\n'), [
        '次の会話セッションだけを根拠に、会話終了後の処理を1つ実行する。',
        '根拠はここに示す会話セッションだけ。',
        '',
        expectedEvidence
      ].join('\n'));
      return 'true';
    }
  });

  assert.match(buddyPrompt, /バディになる合意/);
  assert.equal(finalized.buddy_update.established, true);
  assert.equal(finalized.buddy_update.flag, 'relationship.lina.buddy');
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.buddy'], true);
  const characterFlags = await readJson(root, 'game_data/characters/lina/flags.json');
  assert.equal(characterFlags['relationship.lina.buddy'], true);
  const buddyLog = await readJson(root, 'game_data/logs/buddy_updates/conv_buddy_agreement_001.json');
  assert.equal(buddyLog.established, true);
  assert.equal(buddyLog.raw_answer, 'true');
});


test('finalizeConversation registers multiple enemies from conversation-end hostility judgment', async () => {
  const root = await fixtureRoot();
  const statePath = path.join(root, 'game_data/runtime_state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.current_enemy_character_ids = ['character_001'];
  state.characters ??= {};
  state.characters.character_001 = { flags: { 'relationship.character_001.enemy': true } };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  await runConversationTurn({
    root,
    id: 'conv_enemy_001',
    characterId: 'lina',
    playerInput: 'もうお前とは敵同士だ。次は容赦しない。',
    now: '2026-05-05T06:35:00.000+09:00',
    chatProvider: async () => '……分かった。私も、あなたを敵として扱う。'
  });

  let enemyPrompt = '';
  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_enemy_001',
    characterId: 'lina',
    now: '2026-05-05T06:36:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    enemyHostilityProvider: async ({ prompt, characterId, characterName }) => {
      enemyPrompt = prompt;
      assert.equal(characterId, 'lina');
      assert.equal(characterName, 'リナ・クラウゼ');
      assert.match(prompt, /敵対関係が相互に成立したか/);
      assert.match(prompt, /回答はtrueもしくはfalseのみ/);
      assert.match(prompt, /敵同士/);
      return 'true';
    }
  });

  assert.match(enemyPrompt, /敵対関係/);
  assert.equal(finalized.enemy_update.established, true);
  assert.equal(finalized.enemy_update.flag, 'relationship.lina.enemy');
  assert.deepEqual(finalized.state.current_enemy_character_ids, ['character_001', 'lina']);
  assert.equal(finalized.state.characters.character_001.flags['relationship.character_001.enemy'], true);
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.enemy'], true);
  const enemyLog = await readJson(root, 'game_data/logs/enemy_updates/conv_enemy_001.json');
  assert.equal(enemyLog.established, true);
  assert.equal(enemyLog.raw_answer, 'true');
});


test('finalizeConversation preserves an existing current buddy when the same character does not form a new buddy agreement', async () => {
  const root = await fixtureRoot();
  const statePath = path.join(root, 'game_data/runtime_state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.current_buddy_character_id = 'lina';
  state.characters ??= {};
  state.characters.lina = { flags: { 'relationship.lina.buddy': true } };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  await runConversationTurn({
    root,
    id: 'conv_buddy_preserve_false_001',
    characterId: 'lina',
    playerInput: '今日は普通に話そう。',
    now: '2026-05-05T06:37:00.000+09:00',
    chatProvider: async () => 'はい。いつものように話しましょう。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_buddy_preserve_false_001',
    characterId: 'lina',
    now: '2026-05-05T06:38:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    buddyAgreementProvider: async () => 'false'
  });

  assert.equal(finalized.buddy_update.established, false);
  assert.equal(finalized.state.current_buddy_character_id, 'lina');
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.buddy'], true);
  const linaFlags = await readJson(root, 'game_data/characters/lina/flags.json');
  assert.equal(linaFlags['relationship.lina.buddy'], true);
});


test('finalizeConversation preserves existing enemies when hostility judgment is false', async () => {
  const root = await fixtureRoot();
  const statePath = path.join(root, 'game_data/runtime_state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.current_enemy_character_ids = ['lina'];
  state.characters ??= {};
  state.characters.lina = { flags: { 'relationship.lina.enemy': true } };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  await runConversationTurn({
    root,
    id: 'conv_enemy_preserve_false_001',
    characterId: 'lina',
    playerInput: '今日は敵対するつもりはない。',
    now: '2026-05-05T06:38:00.000+09:00',
    chatProvider: async () => '……分かりました。今は争いません。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_enemy_preserve_false_001',
    characterId: 'lina',
    now: '2026-05-05T06:39:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    enemyHostilityProvider: async () => 'false'
  });

  assert.equal(finalized.enemy_update.established, false);
  assert.deepEqual(finalized.state.current_enemy_character_ids, ['lina']);
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.enemy'], true);
  const linaFlags = await readJson(root, 'game_data/characters/lina/flags.json');
  assert.equal(linaFlags['relationship.lina.enemy'], true);
});


test('finalizeConversation keeps only one current buddy when a new mutual buddy agreement is established', async () => {
  const root = await fixtureRoot();
  const statePath = path.join(root, 'game_data/runtime_state.json');
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  state.current_buddy_character_id = 'character_001';
  state.characters ??= {};
  state.characters.character_001 = { flags: { 'relationship.character_001.buddy': true } };
  state.characters.lina = { flags: { 'relationship.lina.buddy': true } };
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  for (const characterId of ['character_001', 'lina']) {
    const dir = path.join(root, `game_data/characters/${characterId}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'flags.json'), JSON.stringify({
      [`relationship.${characterId}.buddy`]: true
    }, null, 2));
  }

  await runConversationTurn({
    root,
    id: 'conv_single_buddy_001',
    characterId: 'lina',
    playerInput: '今日から正式にバディになろう。',
    now: '2026-05-05T06:40:00.000+09:00',
    chatProvider: async () => 'うん。私があなたのバディになる。'
  });

  const finalized = await finalizeConversation({
    root,
    conversationId: 'conv_single_buddy_001',
    characterId: 'lina',
    now: '2026-05-05T06:41:00.000+09:00',
    skillNecessityProvider: async () => ({ necessary: false, raw_answer: 'false' }),
    buddyAgreementProvider: async () => 'true'
  });

  assert.equal(finalized.state.current_buddy_character_id, 'lina');
  assert.equal(finalized.state.characters.lina.flags['relationship.lina.buddy'], true);
  assert.equal(finalized.state.characters.character_001.flags['relationship.character_001.buddy'], undefined);
  const linaFlags = await readJson(root, 'game_data/characters/lina/flags.json');
  const previousBuddyFlags = await readJson(root, 'game_data/characters/character_001/flags.json');
  assert.equal(linaFlags['relationship.lina.buddy'], true);
  assert.equal(previousBuddyFlags['relationship.character_001.buddy'], undefined);
});


test('runConversationTurn offers all linked work-record candidates so later relevant memories can be recalled', async () => {
  const root = await fixtureRoot();
  const memoryDir = path.join(root, 'game_data/characters/lina/memory');
  const workRecordDir = path.join(root, 'game_data/characters/lina/work_records');
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(workRecordDir, { recursive: true });

  for (const index of [1, 2, 3, 4]) {
    const id = `wr_recall_candidate_${index}`;
    await fs.writeFile(path.join(memoryDir, `mem_recall_candidate_${index}.json`), JSON.stringify({
      id: `mem_recall_candidate_${index}`,
      character_id: 'lina',
      visibility: 'character_known',
      type: 'relationship_change',
      text: index === 4
        ? 'リナは主人公から「使い道がない」と言われた場面について、他にも重要な言葉があったことを覚えている。'
        : `リナは別件の記憶${index}を覚えている。`,
      work_record_id: id
    }, null, 2), 'utf8');
    await fs.writeFile(path.join(workRecordDir, `${id}.md`), `# recall candidate ${index}\n\nID: ${id}\n\n## Summary\n\n${index === 4 ? '主人公は「使い道がない」と言った後、他にもセレナが思い出すべき条件を話していた。' : `別件の会話記録${index}。`}\n`, 'utf8');
  }

  let recallPrompt = '';
  let prewarmPrompt = '';
  const result = await runConversationTurn({
    root,
    id: 'conv_recall_candidate_001',
    characterId: 'lina',
    playerInput: '「使い道がない」と言った時、他のことも言ってたと思うんだけど思い出して',
    now: '2026-05-05T07:05:00.000+09:00',
    emotionProvider: async () => ({ expression: 'worried' }),
    chatProvider: async () => '記録を確認します。少々お待ちください。',
    workRecordRecallProvider: async ({ prompt, candidateWorkRecordIds }) => {
      recallPrompt = prompt;
      assert.deepEqual(candidateWorkRecordIds, [
        'wr_recall_candidate_1',
        'wr_recall_candidate_2',
        'wr_recall_candidate_3',
        'wr_recall_candidate_4'
      ]);
      assert.match(prompt, /指定できるwork_record_idは候補に含まれるIDだけ/);
      assert.match(prompt, /候補work_record_id: wr_recall_candidate_1, wr_recall_candidate_2, wr_recall_candidate_3, wr_recall_candidate_4/);
      return { work_record_ids: ['wr_recall_candidate_4'] };
    },
    promptPrewarmProvider: async ({ prompt, recalledWorkRecords }) => {
      prewarmPrompt = prompt;
      assert.deepEqual(recalledWorkRecords.map((record) => record.id), ['wr_recall_candidate_4']);
      return '「使い道がない」と言われた場面の詳細記録を接続する。';
    }
  });

  assert.match(recallPrompt, /出力形式: \{"work_record_ids":\["wr_recall_candidate_1"\]\}/);
  assert.deepEqual(result.conversation.work_record_recall.recalled_work_record_ids, ['wr_recall_candidate_4']);
  assert.match(prewarmPrompt, /# recall candidate 4/);
  assert.match(result.conversation.next_prompt_cache.prompt, /主人公は「使い道がない」と言った後/);
});


test('runConversationTurn lets the LLM request linked work records after a reply and prewarms the next shared prompt prefix', async () => {
  const root = await fixtureRoot();
  const memoryDir = path.join(root, 'game_data/characters/lina/memory');
  const workRecordDir = path.join(root, 'game_data/characters/lina/work_records');
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(workRecordDir, { recursive: true });
  await fs.writeFile(path.join(memoryDir, 'mem_archival_key.json'), JSON.stringify({
    id: 'mem_archival_key',
    character_id: 'lina',
    visibility: 'character_known',
    type: 'relationship_change',
    text: 'リナは主人公が古い封印札の違和感に気づいたことを覚えている。',
    work_record_id: 'wr_archival_key',
    tags: ['封印札', '古い記録']
  }, null, 2), 'utf8');
  for (const index of [1, 2, 3]) {
    await fs.writeFile(path.join(memoryDir, `mem_recall_newer_${index}.json`), JSON.stringify({
      id: `mem_recall_newer_${index}`,
      character_id: 'lina',
      visibility: 'character_known',
      type: 'relationship_change',
      text: `リナは別件の新しい出来事${index}を覚えている。`,
      tags: ['別件']
    }, null, 2), 'utf8');
  }
  await fs.writeFile(path.join(workRecordDir, 'wr_archival_key.md'), '# 古い封印札について話した\n\nID: wr_archival_key\n\n## Summary\n\n主人公は旧校舎の封印札に薄い擦れ跡があるとリナに伝えた。リナは擦れ跡が最近触れられた可能性を示すと考えた。\n', 'utf8');

  const providerOrder = [];
  let recallPrompt = '';
  let prewarmPrompt = '';
  const result = await runConversationTurn({
    root,
    id: 'conv_recall_001',
    characterId: 'lina',
    playerInput: '前に見た封印札の擦れ跡、今の話と関係ある？',
    now: '2026-05-05T07:00:00.000+09:00',
    emotionProvider: async () => ({ expression: 'serious' }),
    chatProvider: async () => {
      providerOrder.push('chat');
      return '……関係があるかもしれません。前に見た跡のことを、もう少し正確に思い出したいです。';
    },
    onAssistantComplete: ({ content, emotion }) => {
      providerOrder.push('assistant_complete');
      assert.equal(content, '……関係があるかもしれません。前に見た跡のことを、もう少し正確に思い出したいです。');
      assert.equal(emotion.expression, 'serious');
    },
    workRecordRecallProvider: async ({ prompt, candidateWorkRecordIds }) => {
      providerOrder.push('recall');
      recallPrompt = prompt;
      assert.deepEqual(candidateWorkRecordIds, ['wr_archival_key']);
      assert.match(prompt, /リナは主人公が古い封印札の違和感に気づいたことを覚えている。/);
      assert.match(prompt, /work_record_id: wr_archival_key/);
      assert.match(prompt, /より詳細化したい"この場で参照する記憶"があれば/);
      assert.match(prompt, /それと対応するwork_record_idを次の形式で指定する/);
      assert.match(prompt, /出力形式: \{"work_record_ids":\["wr_archival_key"\]\}/);
      assert.match(prompt, /指定できるwork_record_idは候補に含まれるIDだけ/);
      assert.match(prompt, /候補work_record_id: wr_archival_key/);
      assert.match(prompt, /詳細化したい"この場で参照する記憶"がなければ空配列を返す。/);
      assert.match(prompt, /リナ・クラウゼ: ……関係があるかもしれません。/);
      return { work_record_ids: ['wr_archival_key'] };
    },
    promptPrewarmProvider: async ({ prompt, recalledWorkRecords }) => {
      providerOrder.push('prewarm');
      prewarmPrompt = prompt;
      assert.deepEqual(recalledWorkRecords.map((record) => record.id), ['wr_archival_key']);
      assert.match(prompt, /# 古い封印札について話した/);
      assert.match(prompt, /薄い擦れ跡があるとリナに伝えた/);
      assert.match(prompt.trim().split('\n').at(-1), /次のプレイヤー発言に備えて/);
      return '封印札の擦れ跡を会話の直前文脈として保持する。';
    }
  });

  assert.deepEqual(providerOrder, ['chat', 'assistant_complete', 'recall', 'prewarm']);
  assert.equal(result.conversation.work_record_recall.recalled_work_record_ids[0], 'wr_archival_key');
  assert.equal(result.conversation.work_record_recall.prompt, recallPrompt);
  assert.deepEqual(result.conversation.work_record_recall.model_response, { work_record_ids: ['wr_archival_key'] });
  assert.equal(result.conversation.next_prompt_cache.prewarm_text, '封印札の擦れ跡を会話の直前文脈として保持する。');

  const retainedPrompts = [];
  for (let turn = 1; turn <= 11; turn += 1) {
    await runConversationTurn({
      root,
      characterId: 'lina',
      playerInput: turn === 1 ? 'じゃあ擦れ跡の場所をもう一度教えて' : `続きの確認 ${turn}`,
      now: `2026-05-05T07:${String(turn).padStart(2, '0')}:00.000+09:00`,
      workRecordRecallProvider: async () => ({ work_record_ids: [] }),
      promptPrewarmProvider: async () => {
        throw new Error('prewarm should not run when no new work record is recalled');
      },
      chatProvider: async ({ prompt }) => {
        retainedPrompts.push(prompt);
        return turn === 1
          ? '封印札の端です。前に見た薄い擦れ跡と同じ場所を確認しましょう。'
          : `続き ${turn} を確認しましょう。`;
      }
    });
  }
  assert.equal(retainedPrompts.length, 11);
  for (const prompt of retainedPrompts.slice(0, 10)) {
    assert.match(prompt, /# 古い封印札について話した/);
  }
  assert.doesNotMatch(retainedPrompts[10], /# 古い封印札について話した/);
  const retainedConversation = await readJson(root, 'game_data/logs/conversations/conv_recall_001.json');
  assert.deepEqual(retainedConversation.pending_recalled_work_records, []);
  assert.deepEqual(
    prewarmPrompt.trim().split('\n').slice(0, -1),
    result.conversation.next_prompt_cache.prompt.trim().split('\n').slice(0, -1)
  );
});

test('conversation pipeline rejects conversation ids outside the allowed conv_* format before writing logs', async () => {
  const root = await fixtureRoot();
  let providerCalled = false;

  await assert.rejects(
    runConversationOpening({
      root,
      id: '../escape',
      characterId: 'lina',
      now: '2026-05-05T06:00:00.000+09:00',
      chatProvider: async () => {
        providerCalled = true;
        return 'should not run';
      }
    }),
    /conversation/i
  );
  assert.equal(providerCalled, false);

  await runConversationOpening({
    root,
    id: 'conv_safe_001',
    characterId: 'lina',
    now: '2026-05-05T06:01:00.000+09:00',
    chatProvider: async () => 'opening'
  });

  await assert.rejects(
    runConversationTurn({
      root,
      id: 'conv_safe_001/../../runtime_state',
      characterId: 'lina',
      playerInput: 'bad path',
      now: '2026-05-05T06:02:00.000+09:00',
      chatProvider: async () => 'should not run'
    }),
    /conversation/i
  );
});
