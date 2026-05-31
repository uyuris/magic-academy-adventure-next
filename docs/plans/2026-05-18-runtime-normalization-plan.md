# Runtime Normalization Implementation Plan

> Historical implementation plan retained as an archive of the runtime-normalization work.
>
> Public-facing note: this file describes a migration-era execution plan and may mention intermediate seams that were later removed or consolidated. It should be read as project history, not as the current public architecture contract.

**Goal:** Turn the imported runtime-staging baseline into a self-contained `magic-academy-adventure-next` runtime whose code, tests, data paths, and asset paths no longer depend on the old project layout.

**Architecture at the time of this plan:** keep imported migration seams isolated, then progressively promote modules into stable `app/src/`, `app/public/`, `app/tests/`, `content/`, `data/`, and `assets/` surfaces. Normalize by dependency seam, not by filename batch: first remove path assumptions, then redirect data/asset roots, then split monolith entrypoints and test layers.

**Tech Stack:** Node.js ESM (`.mjs`), static browser assets, JSON game data, filesystem-backed runtime state, node:test.

**Reading guidance:** many sections below describe transient migration scaffolding. When this archived plan disagrees with the live README or current architecture docs, prefer the live repo surfaces and their current documentation.

---

## Current live findings that this plan is based on

1. Imported server baseline exists at `app/src/imported_runtime_staging/server.mjs` and is currently a large route-heavy entrypoint (`873` lines in the imported file read).
2. Imported play-state logic exists at `app/src/imported_runtime_staging/playSession.mjs` and still assumes legacy `game_data/` layout plus slot symlink wiring.
3. Imported tests exist at `app/tests/imported_runtime_staging/`, but their relative imports still target `../src/*.mjs`, which does not match the new imported destination layout.
4. Some imported tests still embedded old absolute source-project roots and legacy asset-tree assumptions at the time this plan was written.
5. Curated data already exists under:
   - `data/definitions/game_data/`
   - `data/seeds/game_data/`
   - `content/characters/imported_runtime_staging/`
6. Runtime asset staging already exists under:
   - `assets/source_archives/imported_generations/runtime_staging_character_visual_sets/`
   - `assets/runtime_exports/public_generated/runtime_staging_snapshot/`

## Policy: normalization order

### 1. Freeze provenance first

Do not edit anything under:

- `imports/snapshots/`
- `imports/manifests/`

Those are audit surfaces, not working copies.

### 2. Treat imported_runtime_staging as a disposable migration seam

Use these as temporary implementation surfaces, not final homes:

- `app/src/imported_runtime_staging/`
- `app/public/imported_runtime_staging/`
- `app/config/imported_runtime_staging/`
- `app/tests/imported_runtime_staging/`
- `content/characters/imported_runtime_staging/`

Anything promoted out of them should become the new authoritative surface; the imported subtree remains as a reference baseline until migration is complete.

### 3. Normalize path assumptions before behavior changes

Before changing runtime behavior, eliminate assumptions that the project root contains legacy directories such as:

- `game_data/`
- `public/`
- `assets_v4/`, `assets_v5/`, `assets_v5_additional_30/`
- old absolute project paths

This keeps the first migration phase mechanical and easy to verify.

### 4. Separate authored truth from runtime mutable state

- authored game definitions stay under `data/definitions/`
- start-state templates stay under `data/seeds/`
- mutable play/save/log state must converge to `data/mutable/`
- authored character text/appearance stays under `content/characters/`
- runtime exports stay under `assets/runtime_exports/`
- canonical visual-set acceptance happens only after explicit promotion from source archives

## Phase plan

### Phase A — establish self-contained runtime roots

**Objective:** make the runtime configurable against new-project paths without relying on the old layout.

**Files to inspect/modify first:**
- `app/src/imported_runtime_staging/storage.mjs`
- `app/src/imported_runtime_staging/server.mjs`
- `app/src/imported_runtime_staging/assetResolver.mjs`
- `app/src/imported_runtime_staging/sourceSheetAssets.mjs`
- `app/src/imported_runtime_staging/playSession.mjs`

**Required outcome:** one central path configuration object for:
- project root
- active public root
- canonical definitions root
- seed root
- mutable runtime root
- character authored content root
- runtime export root
- source-archive visual-set root

**Verification:** no production module should hardcode old absolute project paths.

### Phase B — repair imported test harness paths before deeper refactors

**Objective:** make imported tests runnable from their new location, even if some still fail behaviorally.

**Files to inspect/modify first:**
- `app/tests/imported_runtime_staging/*.test.mjs`
- `app/tests/imported_runtime_staging/helpers.mjs`

**Required changes:**
- fix `../src/*.mjs` relative imports so they target the imported runtime seam correctly;
- replace old absolute project roots with computed roots derived from the new project;
- isolate tests that are pure module tests from tests that require full public/assets/data fixtures.

**Verification:** test files should at least resolve imports without depending on the old project path names.

### Phase C — redirect runtime state from legacy game_data to new split surfaces

**Objective:** preserve the existing play-slot behavior while remapping storage semantics to `definitions / seeds / mutable / content`.

**Key source of truth to transform:**
- `app/src/imported_runtime_staging/playSession.mjs`

**Policy details:**
- definitions should be copied or linked from `data/definitions/game_data/`
- seeds should initialize from `data/seeds/game_data/`
- authored character surfaces should source from `content/characters/`
- mutable slot-owned character flags, memory, work records, runtime state, play logs, save slots should live only under `data/mutable/`

**Special caution:** current character storage logic creates empty mutable `flags.json`, `skills.json`, `memory/`, and `work_records/` for slots while symlinking `profile.json`. That logic must be redesigned against the new content/data split instead of being carried forward blindly.

### Phase D — split runtime server by responsibility

**Objective:** break `server.mjs` into small modules after root/path normalization is in place.

**Stop-risk warning:** this phase is especially vulnerable to Air's repeat mistake because each route-cluster extraction creates a neat local success state: one new module, one smaller `server.mjs`, one green structural test. That local neatness is deceptive. It is **not** a valid stopping condition while additional route clusters still remain in the monolith.

**Expected slices:**
- route registration / HTTP helpers
- settings API
- world/character authoring API
- play/session API
- conversation/event/stage API
- asset serving / composite rendering
- save/load API

**Execution mandate inside Phase D:** after every successful extraction, immediately rescan live `server.mjs`, name the remaining clusters, and continue into the next cluster in the same turn. Do not stop merely because the decomposition is now easier to explain.

**Reason for order:** splitting before path normalization would only spread legacy assumptions across more files.

### Phase E — promote public runtime shell intentionally

**Objective:** decide what leaves `app/public/imported_runtime_staging/` and becomes active public surface.

**Policy:**
- authored shell files (`index.html`, `app.js`, `style.css`) can be promoted into `app/public/` once path dependencies are cut;
- generated runtime outputs should not be mixed into the authored shell by default;
- `/generated/*` must be served from `assets/runtime_exports/public_generated/runtime_staging_snapshot/` via explicit server mapping, not via imported-public fallback.

### Phase F — canonicalize character content and visual sets

**Objective:** turn imported authored character surfaces into durable canonical content.

**Character content:**
- promote from `content/characters/imported_runtime_staging/` into final `content/characters/<id>/...` only after schema review.

**Visual sets:**
- promote only accepted subsets from `assets/source_archives/imported_generations/runtime_staging_character_visual_sets/` into `assets/canonical/character_visual_sets/`
- keep runtime-export placements separate in `assets/runtime_exports/`

---

## Execution progress log

**Read-before-stop warning:** this section is a continuity aid, not a permission slip. Updating the progress log is mandatory after a green slice, but the existence of a fresh log entry must never be treated as grounds to stop while unresolved work remains. If Air feels tempted to report here and pause, that is evidence to continue, not to end.

**Record-update warning:** updating any continuity artifact — this progress log, a work record, a plan note, or any other restart record — is bookkeeping only. Record maintenance is required, but it is never a stopping condition by itself. If a record was just updated and the larger requested work is still open, that update is positive evidence that execution must continue immediately into the next unresolved item.

**Report-gate warning:** before turning any fresh log entry into a user-facing report, re-read this plan file in the same turn. A just-written progress log is especially dangerous because it creates the false feeling that “the work has been wrapped up enough to send.” That feeling has already caused repeat failures and must be treated as disqualifying noise, not as judgment.

### 2026-05-18 — completed normalization slices already verified in this repo state

1. Path/root normalization is in place through the runtime path and storage seams, and imported tests run against the new-project roots instead of the old project name.
2. Split-root storage behavior is covered across definitions / seeds / mutable / content surfaces, including save slots, runtime state, inventory, player parameters, character flags, and continuity surfaces.
3. `server.mjs` route extraction has started with dedicated modules for:
   - `server/saveLoadApi.mjs`
   - `server/lmStudioSettingsApi.mjs`
   - `server/flagDebugApi.mjs`
4. Structural regression coverage now asserts that `server.mjs` no longer contains literal route handling for:
   - save/load routes
   - LM Studio settings routes
   - flag/event/debug routes
5. After the latest slice, the active `app/src/imported_runtime_staging/server.mjs` measures `633` lines, down from the earlier `873`-line imported baseline noted in the initial findings.

### 2026-05-18 — latest slice details

**Scope completed:** extract the flag/event/debug route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/flagDebugApi.mjs`.

**Why this slice next:** after save/load and LM Studio settings were separated, the next lowest-coupling cluster was the debug/control surface for stage flags, event flags, request-log inspection, relationship debug state, and elapsed-week debug mutation. Those routes shared small helper dependencies and did not need the heavier conversation or authoring control flow.

**Implemented changes:**
- added `canHandleFlagDebugRoute()` and `handleFlagDebugApi()` to centralize:
  - `/api/flags`
  - `/api/flags/set`
  - `/api/flags/judgment-flow`
  - `/api/flags/all-on`
  - `/api/event-flags`
  - `/api/event-flags/set`
  - `/api/event-flags/completion/set`
  - `/api/event-flags/all-on`
  - `/api/event-flags/all-off`
  - `/api/event-flags/start`
  - `/api/debug/llm-requests`
  - `/api/debug/relationships`
  - `/api/debug/weeks`
- updated `server.mjs` imports and dispatch so this cluster exits early through the extracted module.
- removed the corresponding literal route bodies from `server.mjs`.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` so the monolithic entrypoint is regression-checked against reintroducing those route literals.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`

**Result:** all listed verifications passed, including the full `185`-test suite.

### 2026-05-18 — follow-up slice details

**Scope completed:** extract the world/character authoring route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/authoringApi.mjs`.

**Why this slice next:** after the flag/debug cluster moved out, the authoring endpoints remained the smallest cohesive group that still mixed authoring-root writes and active-root preview behavior. They were smaller-risk than conversation or academy progression routes and removed another chunk of route-local mutation logic from the monolith.

**Implemented changes:**
- added `canHandleAuthoringApiRoute()` and `handleAuthoringApi()` to centralize:
  - `/api/characters`
  - `/api/characters/profile`
  - `/api/world` (GET)
  - `/api/world` (POST)
- moved the authoring-root plus active-root mirror logic into the extracted module, including selectable-character storage bootstrap after profile edits.
- updated `server.mjs` dispatch so those routes early-return through the extracted module.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/characters*` and `/api/world*` route literals in the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `607` lines.

**Verification performed:**
- `npm run check`
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm test`

**Result:** all listed verifications passed, including the full `186`-test suite.

### 2026-05-18 — play/session + field slice details

**Scope completed:** extract the play/session and field-state route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/playSessionFieldApi.mjs`.

**Why this slice next:** after the authoring routes moved out, `/api/new-game`, `/api/state`, `/api/field`, and `/api/field/move` were the smallest remaining cohesive group that still mixed active-root switching with simple runtime-state reads/writes. This cut removed another cluster before touching academy progression or conversation streaming.

**Implemented changes:**
- added `canHandlePlaySessionFieldApiRoute()` and `handlePlaySessionFieldApi()` to centralize:
  - `/api/new-game`
  - `/api/state`
  - `/api/field` (GET)
  - `/api/field/move`
- moved the `initializeNewPlayArea()` active-root handoff and the field-state read/evaluate/move logic into the extracted module.
- updated `server.mjs` dispatch so those routes early-return through the extracted module.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/new-game`, `/api/state`, and `/api/field*` route literals in the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `580` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`

**Result:** all listed verifications passed, including the full `187`-test suite.

### 2026-05-18 — academy progression/economy slice details

**Scope completed:** extract the academy progression and economy route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/progressionEconomyApi.mjs`.

**Why this slice next:** after play/session and field moved out, the next clean non-streaming cluster was the training/week/inventory/shop surface. Those routes were still route-local around a stable helper set and could shrink the monolith further before touching interaction setup or conversation streaming.

**Implemented changes:**
- added `canHandleProgressionEconomyApiRoute()` and `handleProgressionEconomyApi()` to centralize:
  - `/api/training/run`
  - `/api/academy/week/start`
  - `/api/inventory`
  - `/api/inventory/use`
  - `/api/shop`
  - `/api/shop/buy`
  - `/api/shop/sell`
- moved the training, week-start, inventory, and shop dispatch/error-handling logic into the extracted module.
- updated `server.mjs` dispatch so those routes early-return through the extracted module.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/training/run`, `/api/academy/week/start`, `/api/inventory*`, and `/api/shop*` route literals in the monolithic entrypoint.
- removed now-unused direct `training.mjs`, `economy.mjs`, and `startNextAcademyWeek` imports from `server.mjs`.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `546` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`

**Result:** all listed verifications passed, including the full `188`-test suite.

### 2026-05-18 — interaction/continuity setup slice details

**Scope completed:** extract the interaction bootstrap, continuity-record, and prompt-preview route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/interactionContinuityApi.mjs`.

**Why this slice next:** after progression/economy moved out, the remaining non-streaming surface was the interaction bootstrap and continuity/prompt-preview cluster. It still sits before the heavy conversation orchestration, but it owns enough authoring-root and selected-character logic that separating it now reduces the monolith without mixing in SSE control flow.

**Implemented changes:**
- added `canHandleInteractionContinuityApiRoute()` and `handleInteractionContinuityApi()` to centralize:
  - `/api/interaction/start`
  - `/api/records/status`
  - `/api/records/reset`
  - `/api/prompt-preview`
- moved selectable-character bootstrap, continuity status/reset, prompt-preview selection, pending work-record recall, and prompt assembly logic into the extracted module.
- recreated the small storage/prompt helpers required by that slice inside the extracted module so the route cluster can stand on its own without reaching back into the monolithic entrypoint.
- updated `server.mjs` dispatch so those routes early-return through the extracted module.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/interaction/start`, `/api/records/status`, `/api/records/reset`, and `/api/prompt-preview` route literals in the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `480` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`

**Result:** all listed verifications passed, including the full `189`-test suite.

### 2026-05-18 — asset/composite helper slice details

**Scope completed:** extract the asset resolver and character-composite route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/assetCompositeApi.mjs`.

**Why this slice next:** after the interaction/continuity routes moved out, the last small non-streaming group left in the monolith was the asset/composite helper surface. Pulling it out now keeps the remaining server entrypoint focused almost entirely on conversation orchestration and SSE handling.

**Implemented changes:**
- added `canHandleAssetCompositeApiRoute()` and `handleAssetCompositeApi()` to centralize:
  - `/api/assets`
- moved runtime-state reads plus asset response assembly into the extracted module using `createStorageApi()` for root-confined runtime-state access.
- updated `server.mjs` dispatch so that helper route early-returns through the extracted module.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/assets` route literals in the monolithic entrypoint.
- note: `/api/character-composite` from this historical slice was retired on 2026-05-19 together with `/composites/<character>.svg` and `characterComposite.mjs`; this plan section remains only as historical record.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `475` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`

**Result:** all listed verifications passed, including the full `190`-test suite.

### 2026-05-18 — non-stream conversation lifecycle slice details

**Scope completed:** extract the non-stream conversation lifecycle route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/conversationLifecycleApi.mjs`.

**Why this slice next:** after the asset/composite helper routes moved out, the last ordinary request/response routes in the monolith were the conversation lifecycle endpoints. Pulling those out first leaves the final monolith surface concentrated on SSE setup and teardown only, which is the cleanest boundary before the last streaming split.

**Implemented changes:**
- added `canHandleConversationLifecycleApiRoute()` and `handleConversationLifecycleApi()` to centralize:
  - `/api/conversation/opening`
  - `/api/conversation`
  - `/api/conversation/edit-user-message`
  - `/api/conversation/end`
- moved provider resolution, ordinary opening/turn execution, edit-message validation, and conversation-end/finalization state handling into the extracted module.
- kept reusable orchestration helpers in `server.mjs` and injected them into the extracted module so this cut changes route ownership without silently changing conversation semantics.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/conversation/opening`, `/api/conversation`, `/api/conversation/edit-user-message`, and `/api/conversation/end` route literals in the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `400` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`
- residual route scan over `server.mjs`

**Result:** all listed verifications passed, including the full `191`-test suite. The residual route surface in `server.mjs` is now only the SSE pair: `/api/conversation/opening/stream` and `/api/conversation/stream`.

### 2026-05-18 — conversation streaming slice details

**Scope completed:** extract the SSE conversation route cluster from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/conversationStreamingApi.mjs`.

**Why this slice next:** after the non-stream conversation lifecycle routes moved out, the only remaining literal API surface inside the monolith was the SSE pair. Finishing that pair removed the last route-local conversation bodies from `server.mjs` and turned the entrypoint into orchestration-plus-dispatch only.

**Implemented changes:**
- added `canHandleConversationStreamingApiRoute()` and `handleConversationStreamingApi()` to centralize:
  - `/api/conversation/opening/stream`
  - `/api/conversation/stream`
- moved SSE stream setup, immediate assistant delta relay, continuation/cutoff event emission, and final result event delivery into the extracted module.
- kept shared provider resolution and conversation execution helpers in `server.mjs`, but injected them into the extracted module so the streaming split preserves existing runtime behavior instead of reimplementing it separately.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing `/api/conversation/opening/stream` and `/api/conversation/stream` route literals in the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `361` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs` (RED first, then GREEN)
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverLmStudio.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs`
- `npm run check`
- `npm test`
- residual route scan over `server.mjs`

**Result:** all listed verifications passed, including the full `192`-test suite. The residual route surface in `server.mjs` is now only the single top-level `/api/*` dispatch handoff; the literal conversation route bodies are gone.

### 2026-05-18 — static serving / HTTP helper slice details

**Scope completed:** extract the root static-serving surface and shared HTTP/SSE helper layer from `app/src/imported_runtime_staging/server.mjs` into `app/src/imported_runtime_staging/server/staticServing.mjs` and `app/src/imported_runtime_staging/server/httpHelpers.mjs`.

**Why this slice next:** after the streaming route split, no literal feature route cluster remained in the monolith. The next highest-leverage seam was the entrypoint-owned static/public asset serving and low-level HTTP/SSE helper layer because those responsibilities were still mixed into `server.mjs` even though route dispatch had already been decomposed.

**Implemented changes:**
- added `sendJson()`, `sendText()`, `sendSvg()`, `openSse()`, `sendSseEvent()`, and `readBody()` to `server/httpHelpers.mjs`.
- added `serveStatic()` to `server/staticServing.mjs`, with the internal file/public fallback logic moved there so the root request surface is no longer implemented inline in `server.mjs`.
- updated `server.mjs` to import those seams instead of defining the helper bodies locally.
- extended `app/tests/imported_runtime_staging/serverSplit.test.mjs` with a structural regression that rejects reintroducing local `sendJson`, `readBody`, `openSse`, `sendSseEvent`, `serveFile`, `servePublicFile`, and `serveStatic` bodies into the monolithic entrypoint.
- after this slice, the active `app/src/imported_runtime_staging/server.mjs` measures `239` lines.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs` (RED first, then GREEN)
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs app/tests/imported_runtime_staging/serverLmStudio.test.mjs`
- `npm run check`
- `npm test`
- residual helper scan over `server.mjs`

**Result:** all listed verifications passed, including the full `193`-test suite. `server.mjs` now holds dispatch/orchestration entrypoint logic only; root static serving and low-level HTTP/SSE helpers no longer live there.

### 2026-05-18 — Phase E public shell promotion details

**Scope completed:** finish the public-shell promotion so `app/public/` is the active authored shell and `/generated/*` is served from the runtime-export snapshot root instead of from imported-public fallback.

**Why this slice next:** after static-serving extraction, the remaining normalization risk was no longer route ownership but serving-boundary ambiguity. The root shell had been promoted only partially: `index.html` was duplicated, but `app.js`/`style.css` were still wrappers and generated assets still rode the imported-public seam. Closing that boundary was the clean way to finish Phase E before moving to character/content canonicalization.

**Implemented changes:**
- added `generatedPublicRoot` to `app/src/imported_runtime_staging/runtimePaths.mjs` with default `assets/runtime_exports/public_generated/runtime_staging_snapshot`.
- updated `app/src/imported_runtime_staging/server.mjs` so `createServer()` carries `generatedPublicRoot` in its runtime context.
- updated `app/src/imported_runtime_staging/server/staticServing.mjs` so `/generated/*` is served explicitly from `generatedPublicRoot` before generic public serving.
- promoted `app/public/app.js` and `app/public/style.css` from one-line wrappers to the full root-owned shell implementation.
- documented the new boundary in `docs/architecture/asset-flow.md`, `docs/architecture/project-layout.md`, `docs/migration/parity-checklist.md`, and the dedicated plan file `docs/plans/2026-05-18-phase-e-public-shell-promotion.md`.
- updated `package.json` check coverage so the root `app/public/app.js` is syntax-checked alongside the imported reference copy.

**Verification performed:**
- `node --test app/tests/imported_runtime_staging/runtimePaths.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs app/tests/imported_runtime_staging/serverSplit.test.mjs`
- `npm run check`
- `npm test`
- live smoke on the actual runtime server:
  - `GET /`
  - `GET /app.js`
  - `GET /style.css`
  - `GET /generated/load/ig_033f91085286e813016a0319d2efb88191a39d2495960760cc.png`

**Result:** all listed verifications passed, including the full `193`-test suite. Phase E is now complete under the explicit contract: the authored shell lives in `app/public/`, generated browser exports come from `assets/runtime_exports/public_generated/runtime_staging_snapshot/`, and normal runtime success no longer depends on imported-public fallback.

### Remaining Phase D route clusters still visible in `server.mjs`

No literal feature route cluster remains in `server.mjs`.

The remaining monolith content is now cross-cutting orchestration only:
- root request / `/api/*` dispatch branching
- shared conversation/provider orchestration helpers injected into extracted modules
- runtime-root/context assembly for `createServer()`

### Recommended next slice

Phase E public-shell promotion is now complete: `app/public/` is the authored shell, `/generated/*` is explicitly mapped to `assets/runtime_exports/public_generated/runtime_staging_snapshot/`, and active runtime success no longer depends on imported-public fallback.

The next migration target should therefore move to Phase F: promote accepted character content/visual sets out of imported-runtime staging seams into clearer canonical surfaces while preserving the authored/runtime-export split established here.

