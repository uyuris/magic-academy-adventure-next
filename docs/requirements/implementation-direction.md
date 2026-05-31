# Implementation Direction Requirements

Date: 2026-05-05
Source: Discord thread `1500891819687542824` / `#magic-adv-game`
Status: accepted direction from Uyuris after Air recommendation

This file records the accepted implementation direction for Magic Academy ADV after the initial system-box requirements. It does not replace `docs/requirements/system-box.md`; it fixes the next layer of design choices needed before implementation.

## 1. Implementation Form

Use a local web application with a Node backend.

Recommended stack:

```text
frontend: Vite / React / TypeScript
backend: Node / Express or Hono
storage: project-local files
LLM: backend calls LM Studio OpenAI-compatible API
```

Current implementation snapshot:

```text
frontend: authored vanilla browser shell in app/public/
backend: Node built-in HTTP server in app/src/server.mjs
storage: project-local files under data/definitions, data/seeds, and data/mutable
LLM: backend calls LM Studio OpenAI-compatible API via app/src/llm/lmStudioClient.mjs
```

The Vite / React / TypeScript and Express / Hono stack remains a recommendation/history item. It is not the current runtime implementation and should not be described as already present.

Rationale:

- ADV screens, UI, character display, and asset composition are straightforward in a browser.
- LM Studio calls and project-local save/log files should be handled by a backend, not directly by a frontend.
- Electron/Tauri packaging should be deferred until the game loop is working; packaging first would add work that does not clarify the core system.

## 2. Field Map Form

Use a background-click plus node hybrid, not a tile-first map.

```text
field background
+ clickable hotspots
+ location nodes
+ flag-controlled visibility/enabled state
```

Initial location examples:

- courtyard
- old corridor
- library
- herbology garden
- infirmary
- old tower staircase
- forbidden archive door

Rationale:

- The project's center is character interaction, LLM conversation, reflection, and flag progression.
- Tile movement would add exploration-system cost before it proves useful.
- Clickable ADV locations keep field navigation readable while still allowing hidden/locked places and event triggers.

## 3. Runtime State and Save Data

Use versioned JSON snapshots plus append-only logs.

Recommended directories:

```text
game_data/
  runtime_state.json
  save_slots/
  logs/
    conversations/
    reflections/
    validator/
```

Recommended `runtime_state` shape:

```json
{
  "version": 1,
  "current_location_id": "courtyard",
  "time_slot": "after_school",
  "current_screen": "field",
  "current_event_id": null,
  "global_flags": {},
  "visited_locations": [],
  "active_character_ids": [],
  "last_conversation_id": null
}
```

Save files are state snapshots. Conversation logs, reflection outputs, and validator results remain separate logs referenced by ID so save files do not become large opaque dumps.

## 4. Character Data Surfaces

Keep character surfaces separate. Do not collapse profile, memory, skills, work records, and flags into one file.

Recommended layout:

```text
content/
  characters/
    lina/
      profile.json
      appearance.json
      ...
data/
  mutable/game_data/
    characters/
      lina/
        flags.json
        skills.json
        memory/
          mem_*.json
        work_records/
          wr_*.md
    play/slots/<slot_id>/game_data/
      characters/
        lina/
          flags.json
          skills.json
          memory/
          work_records/
```

Authored profile/presentation content lives under `content/characters/<character_id>/`. Runtime continuity surfaces live under `data/mutable/game_data/characters/<character_id>/` and are copied into per-slot play data when a slot is active.

Surface roles:

- `content/characters/<character_id>/profile.json`: stable authored facts, presentation, identity, and default speaking basis.
- `content/characters/<character_id>/appearance.json`: authored appearance and visual-set assignment notes when present.
- `flags.json`: structured mutable state for validator and event director.
- `skills.json`: in-game character capabilities, magic skills, habits, social tools, and conversation capabilities. These are not Hermes skills.
- `memory/*.json`: durable character memories from conversations and events, small enough for filtering and retrieval.
- `work_records/*.md`: detailed chronological scene records for later LLM search and prompt retrieval.

Use JSON where deterministic systems need structure. Use Markdown for detailed records that humans and LLM retrieval will read.

## 5. Character Continuity Record Responsibilities

Keep `memory`, `skills`, and `work_records` separate because they answer different retrieval questions:

- `memory/*.json`: relation memory with the protagonist. One record per completed conversation session; append up to 100 records. Each record summarizes, in 3 sentences or fewer, how the relationship with the protagonist changed and which experience/event caused it. Attach the `work_record_id` generated from the same conversation session so the character can retrieve the fuller session summary when recalling that memory.
- `skills.json` self-change entries: character self-change records, not Hermes Agent skills. One record per completed conversation session; append up to 100 records. Each record summarizes, in exactly 1 sentence, how the character themself changed and which experience/event caused it. Attach the same `work_record_id` for retrieval.
- `work_records/*.md`: conversation-session summaries. One record per completed conversation session; append up to 100 records. Each record summarizes the exchange in 10 sentences or fewer; it is not a full transcript and must not contain every utterance. After this record is created, the live conversation-session content is discarded.

Conversation entry rules:

- Entering a conversation from the field always starts a new conversation session with no active short-term conversation background; the prompt may use only character profile, stage/scene, memory, skills, and selected work records.
- Entering a conversation from an event starts a new conversation session with that event's information passed as event background.
- Conversation finalization runs memory update, skill update, and work-record update as separate LLM structured-output passes.
- The debug/observation UI must expose the current state of each record surface: counts, latest IDs, linked `work_record_id`s, active session status, and finalization outputs.

## 6. Character Work Records

Create one work record per important conversation or event unit, not per single utterance.

Use frontmatter plus Markdown:

```md
---
id: wr_lina_0007
character_id: lina
source_type: conversation
source_id: conv_0007
location_id: herbology_garden
time_slot: after_school
visibility: character_known
tags:
  - lina
  - herbology_garden
  - forbidden_archive
  - player_suspicion
validated_refs:
  - relationship.lina.trust
  - knowledge.lina.player_asked_about_archive
---

# 放課後の薬草園で、禁書庫の噂について話した

## Scene

...

## What the player did

...

## What Lina said/did

...

## Lina's interpretation

...

## Uncertainty

...

## Future hooks

...
```

Required content:

- scene/place/time;
- participants;
- what the player said or did;
- what the character said or did;
- the character's interpretation and uncertainty;
- unresolved points;
- future hooks;
- retrieval tags;
- validated memory/flag/state references where applicable;
- source conversation or event ID.

Do not write tiny logs such as `Talked to Lina. Trust +1.` They are not useful retrieval material.

## 7. Prompt Builder

Build a context pack before writing the model-facing roleplay prompt.

Required order:

```text
player input
→ determine character_id / location / event context
→ retrieve only character-known context
→ profile
→ relevant memories
→ relevant skills
→ relevant work_records
→ current scene state
→ model-facing roleplay prompt
```

The model-facing prompt should begin with character immersion and current stage, for example:

```text
星灯魔法学院の2年生、薬草学研究会に所属するリナ・クラウゼへの完全な没入によって応答する。

あなたはリナ・クラウゼである。
舞台は...
今あなたの目の前には...
あなたがこの場面で使える記憶は...
```

Do not include:

- hidden story truth that the character does not know;
- a list of facts the character does not know;
- instructions like `do not reveal the hidden truth` as a patch for leaked context;
- universal character-management headings such as `what this character protects` or `what this character fears` unless the specific character artifact actually has those fields.

Character artifacts decide which fields exist. Do not force every character into a universal schema.

## 8. LM Studio Connection

Call LM Studio from the backend through its OpenAI-compatible API.

Default config shape:

```json
{
  "provider": "lmstudio",
  "base_url": "http://127.0.0.1:1234/v1",
  "chat_model": "gemma-4-31b-it",
  "reflection_model": "gemma-4-31b-it",
  "timeout_ms": 120000,
  "stream": true,
  "mock_provider_enabled": true
}
```

Implementation direction:

- Character conversation calls should support streaming.
- Reflection calls may be non-streaming.
- Event progression calls may be non-streaming structured JSON.
- Backend owns timeout, retry, and connection error handling.
- If LM Studio is unavailable, UI should show a clear connection error.
- Mock providers are test/fallback tools only. They must not be the visible or default gameplay path.

## 9. Conversation Finalization Passes

Use separate structured LLM calls after the character conversation. Do not make the roleplay call directly mutate state, and do not combine memory, skill, and work-record generation into one opaque reflection object.

Required finalization calls:

1. `memory_update_record`: creates exactly one character memory record for the completed conversation session.
2. `skill_update_record`: creates exactly one character self-change skill record for the same completed conversation session.
3. `work_record_update_record`: creates exactly one work-record summary for the same completed conversation session, plus any flag update candidates that the LLM judges are established by that conversation.

The generated records all share the same `source_conversation_id` and `work_record_id`. The mechanical validator checks schema validity, target existence, sentence limits, known flag IDs, supported ops, numeric type/range, and malformed output. If the LLM says a known story or route flag advanced from the conversation/finalization context, the validator may accept it unless the update is structurally invalid.

After the accepted work record is written, the raw conversation-session messages and prompt are discarded from the conversation log. The remaining conversation log may keep metadata such as id, character_id, message_count, and `discarded_after_work_record_id`, but it must not keep the full transcript.

## 10. Validator

Use a mechanical validator between LLM structured output and game state.

The validator checks:

- JSON/schema validity;
- target character existence;
- flag ID existence;
- supported update operation;
- numeric range/type for increments;
- direct contradictions that can be checked mechanically.

The validator does not decide story meaning by prefix ownership. Flag judgment belongs to the LLM reflection/event progression output. Unknown flags and malformed updates are rejected; known well-formed flag updates are allowed to enter state.

This explicitly supersedes the earlier dialogue-owned/event-owned prefix split. Do not reintroduce a rule that rejects `story.*` or `route.*` from conversation reflection solely because of the flag prefix.

## 11. Event Director

Use file-defined event candidates with priority evaluation, then use the LLM to generate the actual event progression/result when a player confirms a choice.

Recommended directory:

```text
game_data/events/
  evt_*.json
```

Example:

```json
{
  "id": "evt_archive_rumor_after_school",
  "location_id": "library_hidden_corner",
  "time_slots": ["after_school", "night"],
  "trigger": {
    "all": [
      {"flag": "knowledge.player.archive_rumor", "op": "eq", "value": true},
      {"flag": "story.archive_intro_done", "op": "eq", "value": false}
    ]
  },
  "priority": 50,
  "once": true,
  "screen": "event",
  "effects_on_complete": [
    {"flag": "story.archive_intro_done", "op": "set", "value": true}
  ]
}
```

### Event progression

When the player confirms an event choice, the backend calls LM Studio for structured event progression JSON. The model returns at least:

```json
{
  "result_text": "",
  "next_screen": "field",
  "next_location_id": null,
  "next_interaction_character_id": null,
  "flag_update_candidates": [],
  "warnings": []
}
```

`effects_on_complete` and `effects_on_select` in event files may be supplied to the model as candidate/context, but they are not the production authority by themselves. The LLM decides the progression text and which known flags advanced; the mechanical validator/storage layer only rejects malformed or unknown updates.

Evaluation flow:

```text
current location
+ time_slot
+ global flags
+ character flags
→ candidate events
→ priority sort
→ choose event
```

## 12. Screens and Transitions

The original proof target was a three-screen core:

- field map screen;
- character interaction screen;
- event screen.

Current implementation has grown beyond that core. The browser shell currently defines these screen states: `title`, `slot-load`, `world`, `settings`, `field`, `academy-map`, `academy-companion`, `academy-conversation-session`, `academy-training`, `academy-loading`, `academy-room`, `interaction`, `training`, `event`, `inventory`, `shop`, and `debug`.

Treat field / interaction / event as the core gameplay loop, not as the complete current UI surface.

### Field map screen

Responsibilities:

- location movement;
- hotspot selection;
- current time/location display;
- entry into available conversations and events.

### Character interaction screen

Responsibilities:

- chat-like communication UI;
- left character panel with the active character standing image;
- message stream with player and character utterances;
- face emotion image displayed for each character utterance in the stream;
- background or scene frame when useful;
- free input;
- Enter-to-send behavior;
- clear the input field immediately after successful send, without leaving the sent message in the send field;
- current expression/condition display through selected face/standee variants;
- explicit end-conversation action when needed.

### Event screen

Responsibilities:

- LLM-generated event presentation/result text;
- important choices;
- LLM-generated flag updates from event progression;
- transition back to field or into interaction.

Recommended transitions:

```text
field
→ character interaction
→ reflection / validator
→ field or event

field
→ event
→ field or character interaction
```

Do not blur event and free interaction too much; keeping them distinct makes flag ownership and event progress easier to audit.

## 13. Debug / Observation UI

Build a developer panel from the beginning.

It should show:

- current `runtime_state`;
- current location and time slot;
- global flags;
- selected character flags;
- retrieved memories;
- retrieved work records;
- assembled prompt preview;
- raw conversation log;
- reflection JSON;
- validator result;
- rejected updates;
- event trigger candidates;
- asset expression/condition state.

The panel should answer three questions:

```text
Why did this prompt contain this context?
Why was this flag accepted or rejected?
Why did this event fire or not fire?
```

## 14. Character Visual-Set Asset Manifest and Runtime Connection

The current asset direction is changed from part-level composition to coherent generated character visual sets. Earlier notes referred to 20 coherent visual sets; the current canonical asset tree contains 50 `visual_set_*` directories under `assets/canonical/character_visual_sets/`.

Do not build gameplay character images by freely combining body, face, eyes, mouth, eyebrows, hair, and clothes parts. Instead:

1. Generate and preserve coherent character visual sets as bundles. The current canonical baseline contains 50 visual sets.
2. Treat each visual set as a bundle of base face, face emotion differences, and standing images.
3. Assign one visual set to a character.
4. Preserve that same character identity across all variations for that character.
5. For each visual set / assigned character, prepare:
   - 1 base face image;
   - 5 standee / standing-pose variations;
   - 10 face emotion variations.

The intended unit is:

```text
this character's base face
+ this character's face/emotion variations
+ this character's standee variations
```

It is not:

```text
interchangeable eyes + mouth + hair + clothes + body parts
```

Recommended manifest shape:

```json
{
  "character_id": "lina",
  "visual_set_id": "visual_set_003_herbology_student",
  "identity_notes": "same face, hair silhouette, palette, outfit language, and rendering style across all variations",
  "base_face": { "id": "face_base", "path": "assets/characters/lina/face/base.png" },
  "standee_variants": [
    { "id": "standee_neutral", "path": "assets/characters/lina/standees/neutral.png" },
    { "id": "standee_worried", "path": "assets/characters/lina/standees/worried.png" }
  ],
  "face_emotion_variants": [
    { "id": "face_neutral", "emotion": "neutral", "path": "assets/characters/lina/face_emotions/neutral.png" },
    { "id": "face_joy", "emotion": "joy", "path": "assets/characters/lina/face_emotions/joy.png" }
  ]
}
```

Runtime selection flow:

```text
character_id
+ expression tag / scene state
→ assigned visual_set_id
→ select face emotion variant for this utterance
→ select current standee variant for the left panel
→ render pre-generated images
```

A character utterance in the stream should be able to reference a face emotion variant, for example:

```json
{
  "speaker": "character",
  "character_id": "lina",
  "text": "...",
  "face_emotion_variant_id": "face_worried",
  "standee_variant_id": "standee_worried"
}
```

Player utterances do not need face images. Older v2/v3/v4 composable-part asset packs remain historical/prototype material. They are not the current target requirement for the next gameplay validation pass.

## 15. Initial Verification Scope

Start verification from the LLM conversation portion, not from event production.

The first validation slice should prove two things:

1. The backend can generate actual character replies through LM Studio / Gemma4 31B.
2. The reflection / flag-management flow can judge, validate mechanically, persist, and expose flags from the conversation.

Use one character and a minimal scene context first. Field movement and event screens may exist, but they are not the first proof target.

Recommended initial character:

- a herbology club female student.

Recommended initial situation:

```text
After school in the herbology garden, the player talks with the herbology student about an abnormal plant or potion residue that may connect to the forbidden archive.
```

This first verification should test:

- LM Studio character reply generation;
- knowledge-gated prompt construction;
- detailed character work record generation;
- LLM reflection judging flag updates from the conversation;
- mechanical validation of known/well-formed flags;
- persistence of memory, work_records, logs, and flags;
- debug visibility for prompt, reflection, validator result, and accepted/rejected updates;
- one assigned character visual set with 1 base face, 5 standee variations, and 10 face emotion variations, if asset display is included.

Event occurrence remains flag-driven, but event content/progression is not the starting point for this validation slice.

Current implementation has advanced past the initial one-character validation slice. It now includes multi-screen academy flow, save/load slots, field movement, training, inventory/shop economy, event/stage flag debug APIs, conversation streaming, continuity record status/reset APIs, and canonical asset serving. Keep this section as the historical first-slice requirement, not as a description of the full current application.

## 16. Recommended Implementation Order

Use this updated order:

1. Fix local web + Node backend structure.
2. Define data directories and save schema.
3. Define character surfaces.
4. Implement prompt builder and context filtering.
5. Implement real LM Studio character reply generation.
6. Implement reflection schema for flag judgment from conversation evidence.
7. Implement mechanical validator for known flags, supported ops, target/type, range, and malformed output.
8. Persist conversation logs, reflection outputs, validator results, memory updates, work_records, and flags.
9. Build debug panel for prompt / reflection / validator / flag visibility.
10. Add one coherent character visual set and connect left-panel standee / per-utterance face-emotion selection.
11. Add field map and event candidate selection after the conversation/flag loop is verified.
12. Add event screen progression that reads flags for occurrence and uses LLM output for event result/progression when needed.

The central design axis is:

```text
First prove “the LLM can talk as the character and the LLM reflection can manage flags from that conversation,” then let events read those flags.
```

That axis controls prompt construction, reflection, validation, save data, debug tooling, and later event progression.
