# Source Inventory

## Read-only source projects

1. the older main Magic Academy Adventure project
2. the older runtime-staging Magic Academy Adventure project

## Observed top-level structure

### Old main project

- `docs/`
- `tools/`
- `assets/`
- `assets_academy_training_cards/`
- `assets_v2/`
- `assets_v3/`
- `assets_v4/`
- `assets_v5/`
- `assets_v5_additional_30/`
- `assets_v5_emotion16_50/`
- `README.md`

### Old runtime staging project

- `src/`
- `public/`
- `tests/`
- `config/`
- `game_data/`
- `character_visual_sets/`
- `README.md`
- `package.json`

## Observed detailed signals used for layout design

- runtime-staging `character_visual_sets/visual_set_###/` includes `manifest.json`, `identity_notes.md`, `face/`, `face_emotions/`, `standee/`, `previews/`;
- runtime-staging `public/generated/` includes runtime-facing generated assets such as title/load/icon and generated character visual-set placements;
- runtime-staging `tests/` already separates helpers/fixtures from test files but not yet by unit/integration directories;
- runtime-staging `game_data/` mixes definitions, current state, save/play state, and logs.

## Imported baseline status in new project

- runtime-staging `src/`, `public/`, `config/`, and `tests/` informed the active repo layout and its temporary imported-base paths during migration;
- runtime-staging `character_visual_sets/` was consolidated into `assets/canonical/character_visual_sets/`, and its provenance now lives in manifests/origin maps instead of duplicate snapshot or source-archive trees;
- runtime-staging `public/generated/` was consolidated into canonical-backed compatibility serving within the repo asset tree, and its provenance now lives in manifests/origin maps instead of duplicate snapshot mirrors;
- runtime-staging `game_data/` was snapshotted in full (`6148` files) under `imports/snapshots/runtime-staging/game_data_reference/`;
- curated `game_data` definitions and seeds were copied into `data/definitions/game_data/` and `data/seeds/game_data/`;
- authored character surfaces (`profile.json`, `appearance.json`) were canonically promoted into `content/characters/<character_id>/`, while mutable character state (`skills.json`, `flags.json`, `memory/`, and `work_records/`) lives under `data/mutable/game_data/characters/<character_id>/`; the earlier `content/characters/imported_runtime_staging/` migration copy was later removed after the active runtime stopped using it.
