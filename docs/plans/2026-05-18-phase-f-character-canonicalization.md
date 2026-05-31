# Phase F character canonicalization plan

**Date:** 2026-05-18
**Project:** `magic-academy-adventure-next`
**Scope:** canonicalize character authored content and accepted visual sets so imported-runtime-staging surfaces stop acting as the de facto source of truth.
**Status:** implemented and verified on 2026-05-18

---

## Baseline this plan started from

1. Phase E had already separated `app/public/` from `/generated/*` runtime exports.
2. Split-root storage was already active for definitions / seeds / mutable data.
3. Character authored content still defaulted to `content/characters/imported_runtime_staging/` via `runtimePaths.characterContentRoot` and `storage.mjs`.
4. `skills.json` was still routed as if it were authored character content, even though runtime code edits it during play and conversation finalization.
5. `/v5-assets/character_visual_sets/...` still implied imported-generation visual sets rather than an accepted canonical surface.
6. `assets/canonical/` had no active character visual-set home.

## Target operating boundary

After Phase F:

- authored character content lives at `content/characters/<character_id>/...`
- mutable character continuity/play surfaces live under `data/mutable/game_data/characters/<character_id>/...`
- `skills.json` is treated as mutable runtime state, not authored content
- accepted visual sets live at `assets/canonical/character_visual_sets/<visual_set_id>/...`
- accepted runtime reads should target the canonical visual-set surface directly; the earlier `/v5-assets/character_visual_sets/...` compatibility route was later retired on 2026-05-19
- imported-runtime-staging character content / visual-set trees remain as migration references only, not active truth

## Implemented result

### Slice 1 — canonical path contract

Implemented in:

- `app/src/imported_runtime_staging/runtimePaths.mjs`
- `app/src/imported_runtime_staging/storage.mjs`
- `app/tests/imported_runtime_staging/runtimePaths.test.mjs`
- `app/tests/imported_runtime_staging/storage.test.mjs`

Outcome:

- `characterContentRoot` now defaults to `content/characters`
- `canonicalVisualSetsRoot` now defaults to `assets/canonical/character_visual_sets`
- authored `profile.json` / `appearance.json` resolve into `content/characters/<id>/...`
- mutable `skills.json`, `flags.json`, `memory/*`, and `work_records/*` resolve into `data/mutable/game_data/characters/<id>/...`

### Slice 2 — character authored-vs-mutable split

Implemented in:

- `app/src/imported_runtime_staging/playSession.mjs`
- `app/src/imported_runtime_staging/saveLoad.mjs`
- `app/src/imported_runtime_staging/graduationEnding.mjs`
- character/content/continuity tests under `app/tests/imported_runtime_staging/`

Outcome:

- canonical authored character files were materialized under `content/characters/<character_id>/`
- mutable `skills.json` was materialized under `data/mutable/game_data/characters/<character_id>/`
- slot/bootstrap flows now skip non-character migration-reference directories under `content/characters/`
- save/load and play-slot initialization preserve the authored-vs-mutable split instead of reviving authored `skills.json`

### Slice 3 — accepted visual-set canonicalization

Implemented in:

- `app/src/imported_runtime_staging/server.mjs`
- `app/src/imported_runtime_staging/server/staticServing.mjs`
- `app/tests/imported_runtime_staging/serverApi.test.mjs`
- `assets/canonical/character_visual_sets/`

Outcome:

- accepted character visual sets now have a canonical home at `assets/canonical/character_visual_sets/`
- the canonical visual-set tree is now materialized as real directories/files inside this repo rather than symlink mirrors, so whole-project zip copies do not rely on link preservation
- the accepted visual-set runtime surface was moved onto canonical assets; the interim `/v5-assets/character_visual_sets/*` compatibility route was later retired on 2026-05-19
- imported source-archive visual sets remain fallback/reference only
- `/generated/*` serving remains separate and unchanged

Implementation note:

- the initial canonical visual-set population was created as a filesystem mirror from the imported source-archive tree so the runtime can switch surfaces without duplicating acceptance logic in code. The canonical path is now the runtime-first contract even where migration-era contents still match the imported archive.

### Slice 4 — docs alignment

Updated:

- `docs/architecture/project-layout.md`
- `docs/architecture/asset-flow.md`
- this file

## Completion criteria status

1. `content/characters/imported_runtime_staging/` is no longer the active default authored content root. **Done**
2. Authored character files are read from `content/characters/<id>/...`. **Done**
3. Mutable character files (`skills.json`, `flags.json`, `memory`, `work_records`) are read/written from `data/mutable/game_data/characters/<id>/...`. **Done**
4. Save/load and active-play slot materialization preserve that authored-vs-mutable split. **Done**
5. `assets/canonical/character_visual_sets/` exists as the accepted runtime surface; the interim `/v5-assets/character_visual_sets/...` compatibility route was retired on 2026-05-19. **Done**
6. `/generated/*` remains runtime-export-only and does not become acceptance truth. **Done**
7. Focused character/content/asset tests, `npm run check`, and `npm test` all pass. **Done**

## Verification executed

1. Focused tests for `runtimePaths`, `storage`, `characterCatalog`, `playSession`, `saveLoad`, `graduationEnding`, and `serverApi`
   - historical note: `characterComposite` coverage mentioned in the original phase text was retired on 2026-05-19 together with the unused part-composition runtime cluster.
2. `npm run check`
3. `npm test`
4. live smoke against:
   - `/generated/card_images/mana_control.png` → `200 image/png`
   - historical 2026-05-18 verification used `/v5-assets/character_visual_sets/visual_set_001/face_emotions/neutral.png` before that compatibility route was retired on 2026-05-19

## Follow-up note

This closes the runtime surface split for Phase F. The remaining migration work, if any, should treat `content/characters/` and `assets/canonical/character_visual_sets/` as the authoritative homes rather than adding new behavior against imported-runtime-staging trees.
