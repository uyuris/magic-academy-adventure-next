# System Box Requirements

Date: 2026-05-05
Source: Discord thread `1500891819687542824` / `#magic-adv-game`

## Explicit Requirements from Uyuris

### Screens

- Field map screen.
- Character interaction screen.
- Event screen.

### Character Interaction

- The player can freely communicate one-on-one with a character.
- Conversation calls Gemma4 31B through LM Studio.
- Conversation can reference each character's own memory, skills, and work records.
- Communication UI should feel like a chat interface.
- The left panel shows the active character's standing image.
- The message stream shows a face image with an emotion difference for each character utterance.
- Player text is sent with Enter.
- After sending, the input field is cleared; the sent message must not remain in the send field.

### Reflection, Flag Judgment, and Progression

- After conversation, an LLM reflection pass reviews the conversation.
- The LLM judges whether each flag update is established by the conversation/reflection evidence.
- The runtime applies structurally valid flag updates after mechanical checks such as known flag ID, supported operation, target/type, and numeric range.
- Event occurrence is determined by reading the resulting validated flags.

### Asset Generation

- Character and field-map assets are produced using Codex Goal or equivalent automated generation.
- Character graphics are not generated as arbitrary part-level compositions for the current direction.
- v5 generates 20 coherent character visual sets for now.
- Each visual set is a bundle of base face, face emotion differences, and standing images.
- Assign one coherent visual set to a character.
- A character visual set must preserve the same character identity across its variations.
- For each visual set / assigned character, prepare:
  - 1 base face image;
  - 10 face emotion variations;
  - 5 standee / standing-pose variations.
- The intent is “face/emotion and standee differences of this same-looking character,” not interchangeable eyes/mouth/hair/body parts.

## Current Architecture Boundary

The current accepted boundary is LLM-first for conversation and flag judgment, with event occurrence controlled by flags:

1. Game runtime passes current state + relevant character continuity to the conversation model.
2. The model talks freely as the character.
3. A separate reflection pass summarizes the conversation and judges which flag updates are established.
4. The runtime performs mechanical validation only: schema, known flag IDs, supported operations, target/type, numeric range, and persistence safety.
5. Event occurrence reads the resulting flags, not raw chat text.

This supersedes the earlier idea that a deterministic validator would decide story meaning or reject story/route flags by prefix ownership.

## Initial Data Surfaces

- `runtime_state`: map position, time, current event, global flags.
- `characters/<id>/profile`: stable character profile.
- `characters/<id>/memory`: durable memories.
- `characters/<id>/skills`: capabilities, social habits, magical abilities, conversational tools.
- `characters/<id>/work_records`: chronological summaries of important interactions/actions.
- `characters/<id>/flags`: relationship, knowledge, condition, and route flags.
- `assets/manifest`: character visual-set assignments, standee variation IDs, face emotion variation IDs, source records, and selection tags.

## First MVP Candidate

- One small field map.
- One character.
- One interaction screen.
- One event screen.
- LM Studio chat call.
- Reflection pass producing structured update candidates.
- LLM reflection judging flag updates from the conversation.
- Mechanical validation applying known, well-formed memory/work-record/flag updates.
- One event candidate that fires by reading updated flags.
- One assigned character visual set with 1 base face, 5 standee variations, and 10 face emotion variations.


## Corrections from 2026-05-05

### Detailed LLM-Searchable Work Records

`work_records` must be detailed enough for later LLM search and reference. They should not be tiny progress lines. Include concrete scene, participants, what was said or done, character interpretation, uncertainty, reusable future hooks, retrieval tags, and validated state/flag references.

### Knowledge-Gated Character Prompts

Do not include hidden story facts in a character prompt and then instruct the model not to reveal them. If the character does not know a fact, the prompt builder must not provide that fact to the character LLM call.

Correct boundary:

1. Character conversation call receives only character-known / character-observable context.
2. Reflection call may propose memory, work_record, skill, and flag updates.
3. The LLM judges whether each flag update is established by the conversation/reflection evidence.
4. Mechanical validation applies or rejects update candidates by structure and known IDs.
5. Event director reads resulting flags to decide event occurrence.

This means a prompt clause like `do not reveal undisclosed story information` is not an acceptable substitute for context filtering.

### 2026-05-05 Current Validator Correction

The validator requirement is changed: the LLM, not hard-coded prefix ownership, judges whether a flag should be raised from the conversation reflection. The validator remains a mechanical safety gate for known flags, supported operations, target/type correctness, numeric ranges, and malformed output. Event occurrence is still flag-driven.

### 2026-05-05 Current Asset Correction

The current character asset direction is no longer part-level composition. Characters are generated as coherent visual sets. v5 makes 20 candidate visual sets for now, assigns a set to a character, and preserves that character's identity across variations. Each set contains 1 base face image, 10 face emotion variations, and 5 standee variations.

### 2026-05-05 v5 Chat Interaction UI Correction

Character interaction uses a chat-like UI. The left panel displays the active character standee. The message stream displays a face emotion image per character utterance. Player input is sent with Enter, and the input field is cleared after send so the sent message does not remain in the send field.

### 2026-05-05 Current First Verification Scope

Do not start verification from event production. Start from the LLM conversation portion: confirm that the backend can generate character replies through LM Studio, then confirm that the reflection/flag-management flow can judge and persist flags from the conversation.
