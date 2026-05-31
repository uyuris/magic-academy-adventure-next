import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import {
  loadEventFlags,
  judgeEventFlagsAfterConversation,
  judgeEventCompletionsAfterConversation
} from '../src/eventFlags.mjs';

async function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function splitEventFlagsRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-eventflags-split-'));
  await writeJson(root, 'data/definitions/game_data/event_flags.json', {
    flags: [
      {
        id: 'event.test.promise.ready',
        label: '約束イベント',
        condition: '約束した。',
        question: '約束したか',
        required_global_flags: ['knowledge.promise_ready'],
        required_inventory_items: [{ item_id: 'ripple_clock_face', quantity: 1 }],
        completed_flag_id: 'event.test.promise.completed',
        interaction: {
          location_id: 'festival_plaza_night',
          source_type: 'event',
          opening_context: '約束イベントの開始。'
        }
      }
    ]
  });
  await writeJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    global_flags: { 'knowledge.promise_ready': true },
    characters: {}
  });
  return root;
}

test('loadEventFlags reads split definitions and judgeEventFlagsAfterConversation writes judgment logs to split mutable storage', async () => {
  const root = await splitEventFlagsRoot();
  const definitions = await loadEventFlags({ root });
  assert.equal(definitions.flags[0].id, 'event.test.promise.ready');
  assert.equal(definitions.flags[0].interaction.location_id, 'festival_plaza_night');

  const judgment = await judgeEventFlagsAfterConversation({
    root,
    state: {
      global_flags: { 'knowledge.promise_ready': true },
      event_flag_sources: {}
    },
    inventory: {
      money: 0,
      items: [{ item_id: 'ripple_clock_face', quantity: 1 }]
    },
    conversation: {
      id: 'conv_split_001',
      character_id: 'lina',
      location_id: 'festival_plaza_night'
    },
    eventFlagJudgmentProvider: async ({ candidateFlags }) => ({
      flag_results: [{ flag_id: candidateFlags[0].id, achieved: true, reason: '約束が成立した' }]
    }),
    now: '2026-05-18T01:23:45.000Z'
  });

  assert.equal(judgment.accepted[0].flag_id, 'event.test.promise.ready');
  const log = await readJson(root, 'data/mutable/game_data/logs/event_flag_judgments/conv_split_001.json');
  assert.equal(log.accepted[0].flag_id, 'event.test.promise.ready');
  await assert.rejects(fs.access(path.join(root, 'game_data/logs/event_flag_judgments/conv_split_001.json')), { code: 'ENOENT' });
});

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const COMEDY_LIVE_EVENT_ID = 'event.school_festival_comedy_live.ready';
const COMEDY_LIVE_COMPLETED_FLAG_ID = 'event.school_festival_comedy_live.completed';
const COMEDY_LIVE_TRIGGER_QUESTION = '主人公と会話相手が漫才ユニットを組むことに合意したか';

const CONVERSATION_END_COMPLETION_EVENTS = [
  {
    id: 'event.necromancer_seal_released.ready',
    completedFlagId: 'event.necromancer_seal_released.completed',
    locationId: 'unsealed_necromancer_ritual_room'
  },
  {
    id: 'event.cleaning_golem_shutdown.ready',
    completedFlagId: 'event.cleaning_golem_shutdown.completed',
    locationId: 'main_hall_runaway_golem'
  },
  {
    id: 'event.age_of_gods_elixir_brewing.ready',
    completedFlagId: 'event.age_of_gods_elixir_brewing.completed',
    locationId: 'age_of_gods_elixir_brewing_stage'
  }
];

test('school festival comedy live event definition preserves trigger and structural interaction contract without freezing editable opening prose', async () => {
  const definitions = await loadEventFlags({ root: PROJECT_ROOT });
  const flagsById = new Map(definitions.flags.map((flag) => [flag.id, flag]));
  const liveFlag = flagsById.get(COMEDY_LIVE_EVENT_ID);

  assert.ok(liveFlag, `missing event definition: ${COMEDY_LIVE_EVENT_ID}`);
  assert.equal(liveFlag.label, '学院祭のお笑いライブ');
  assert.equal(liveFlag.question, COMEDY_LIVE_TRIGGER_QUESTION);
  assert.equal(liveFlag.completed_flag_id, COMEDY_LIVE_COMPLETED_FLAG_ID);
  assert.equal(liveFlag.complete_on_conversation_end, true);
  assert.equal(liveFlag.interaction?.location_id, 'festival_plaza_night');
  assert.equal(liveFlag.interaction?.source_type, 'event');
  assert.equal(typeof liveFlag.interaction?.opening_context, 'string');
  assert.notEqual(liveFlag.interaction?.opening_context.trim(), '');

  const fixture = JSON.parse(
    await fs.readFile(path.join(PROJECT_ROOT, 'app/tests/fixtures/event_flags.fixture.json'), 'utf8')
  );
  const fixtureFlag = fixture.flags.find((flag) => flag.id === COMEDY_LIVE_EVENT_ID);

  assert.ok(fixtureFlag, `missing fixture event definition: ${COMEDY_LIVE_EVENT_ID}`);
  assert.equal(fixtureFlag.label, '学院祭のお笑いライブ');
  assert.equal(fixtureFlag.question, COMEDY_LIVE_TRIGGER_QUESTION);
  assert.equal(fixtureFlag.completed_flag_id, COMEDY_LIVE_COMPLETED_FLAG_ID);
  assert.equal(fixtureFlag.complete_on_conversation_end, true);
  assert.equal(fixtureFlag.interaction?.location_id, 'festival_plaza_night');
  assert.equal(fixtureFlag.interaction?.source_type, 'event');
  assert.equal(typeof fixtureFlag.interaction?.opening_context, 'string');
  assert.notEqual(fixtureFlag.interaction?.opening_context.trim(), '');
  assert.equal(fixtureFlag.interaction?.opening_context, liveFlag.interaction?.opening_context);
});

test('scoped high-risk event definitions complete on conversation end instead of success judgment', async () => {
  const definitions = await loadEventFlags({ root: PROJECT_ROOT });
  const flagsById = new Map(definitions.flags.map((flag) => [flag.id, flag]));

  for (const expected of CONVERSATION_END_COMPLETION_EVENTS) {
    const flag = flagsById.get(expected.id);
    assert.ok(flag, `missing event definition: ${expected.id}`);
    assert.equal(flag.completed_flag_id, expected.completedFlagId);
    assert.equal(flag.complete_on_conversation_end, true, `${expected.id} must complete when its event conversation ends`);
    assert.equal(flag.completion_judgment, null, `${expected.id} must not retain success-gated completion judgment`);
  }
});

test('scoped high-risk event conversation finalization accepts completion without calling success judgment provider', async () => {
  const target = CONVERSATION_END_COMPLETION_EVENTS[0];
  let successJudgmentProviderCalls = 0;

  const judgment = await judgeEventCompletionsAfterConversation({
    root: PROJECT_ROOT,
    state: {
      global_flags: { [target.id]: true },
      event_flag_sources: {
        [target.id]: {
          character_id: 'character_001',
          conversation_id: 'conv_source_001',
          achieved_at: '2026-05-20T00:00:00.000Z'
        }
      },
      current_interaction_character_id: 'character_001',
      pending_interaction_context: {
        source_type: 'event',
        event_flag_id: target.id
      }
    },
    conversation: {
      id: 'conv_event_end_001',
      character_id: 'character_001',
      source_type: 'event',
      event_flag_id: target.id,
      location_id: target.locationId
    },
    eventCompletionJudgmentProvider: async () => {
      successJudgmentProviderCalls += 1;
      return { flag_results: [{ flag_id: target.id, achieved: false, reason: 'success objective was not achieved' }] };
    },
    now: '2026-05-20T01:23:45.000Z'
  });

  assert.equal(successJudgmentProviderCalls, 0);
  assert.equal(judgment.accepted.length, 1);
  assert.equal(judgment.accepted[0].flag_id, target.id);
  assert.equal(judgment.accepted[0].completed_flag_id, target.completedFlagId);
  assert.equal(judgment.accepted[0].completed_on_conversation_end, true);
});

test('scoped high-risk events do not complete from unrelated event conversations', async () => {
  const target = CONVERSATION_END_COMPLETION_EVENTS[0];
  const other = CONVERSATION_END_COMPLETION_EVENTS[1];

  const judgment = await judgeEventCompletionsAfterConversation({
    root: PROJECT_ROOT,
    state: {
      global_flags: { [target.id]: true, [other.id]: true },
      event_flag_sources: {
        [target.id]: { character_id: 'character_001', conversation_id: 'conv_source_001', achieved_at: '2026-05-20T00:00:00.000Z' },
        [other.id]: { character_id: 'character_001', conversation_id: 'conv_source_002', achieved_at: '2026-05-20T00:00:00.000Z' }
      },
      current_interaction_character_id: 'character_001',
      pending_interaction_context: {
        source_type: 'event',
        event_flag_id: other.id
      }
    },
    conversation: {
      id: 'conv_other_event_001',
      character_id: 'character_001',
      source_type: 'event',
      event_flag_id: other.id,
      location_id: other.locationId
    },
    eventCompletionJudgmentProvider: async () => ({ flag_results: [] }),
    now: '2026-05-20T01:23:45.000Z'
  });

  assert.equal(judgment.accepted.some((accepted) => accepted.flag_id === target.id), false);
  assert.equal(judgment.accepted.some((accepted) => accepted.completed_flag_id === target.completedFlagId), false);
});
