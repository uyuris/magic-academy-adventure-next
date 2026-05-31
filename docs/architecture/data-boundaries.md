# Data Boundaries

## Definitions

Canonical structured game definitions belong in `data/definitions/`.

Current imported runtime-staging baseline stored there:

- `data/definitions/game_data/event_flags.json`
- `data/definitions/game_data/locations.json`
- `data/definitions/game_data/shop_catalog.json`
- `data/definitions/game_data/stage_flags.json`
- `data/definitions/game_data/world/settings.json`

Examples:

- character definitions;
- event definitions;
- world/economy/stage catalogs;
- stage flag definitions;
- shop catalog definitions.

## Seeds

Starting-state templates belong in `data/seeds/`.

Current imported runtime-staging baseline stored there:

- `data/seeds/game_data/player_inventory.json`
- `data/seeds/game_data/runtime_state.json`
- `data/seeds/game_data/runtime/player_parameters.json`

Examples:

- runtime state seed;
- player parameter seed;
- initial inventory seed.

## Mutable

Runtime/play/session/log outputs belong in `data/mutable/`.

Current implementation note: `data/mutable/game_data/` is now an active local runtime/play-data area, not only a future destination. It contains top-level mutable state and per-slot copies under `data/mutable/game_data/play/slots/<slot_id>/game_data/`.

Examples:

- save slots;
- current play sessions;
- runtime state outputs;
- conversation/reflection/validator/work-record logs;
- active-slot metadata;
- per-character mutable continuity surfaces such as `flags.json`, `skills.json`, `memory/`, and `work_records/`.

## Hard rule

Do not mix mutable outputs back into canonical definitions.

Character `flags.json`, `memory/`, and `work_records/` are non-canonical runtime state/history. Current authored character content lives directly under `content/characters/<character_id>/`, while mutable runtime character state lives under `data/mutable/game_data/characters/<character_id>/` and, for play slots, under the matching per-slot `game_data/characters/<character_id>/` tree.
