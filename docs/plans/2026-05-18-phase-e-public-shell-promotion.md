# Phase E Public Shell Promotion Implementation Plan

> Historical implementation plan retained as an archive of the public-shell promotion work.
>
> Public-facing note: this file captures a migration phase where `/generated/*` still pointed at separate runtime-export mirrors. The live repo has since moved toward canonical-backed compatibility serving, so read this document as history rather than the current architecture contract.

**Goal at the time of this plan:** Make `app/public/` the sole authored runtime shell for `magic-academy-adventure-next`, while removing active dependency on `app/public/imported_runtime_staging/` fallback.

**Architecture at the time of this plan:** preserve the split between authored shell and generated exports during the migration window. `app/public/` owned the HTML/CSS/JS shell, while imported generated output still lived in a separate transition surface.

**Tech Stack:** Node.js ESM (`.mjs`), `node:http`, static browser assets, filesystem-backed runtime exports, `node:test`.

**Reading guidance:** if this archived plan conflicts with the current README, assets docs, or runtime code, prefer the current repo surfaces.

---

## Current live state this plan is based on

1. `app/public/index.html` and `app/public/imported_runtime_staging/index.html` are byte-identical duplicates.
2. `app/public/app.js` is only `import './imported_runtime_staging/app.js';`.
3. `app/public/style.css` is only `@import url('./imported_runtime_staging/style.css');`.
4. `app/public/imported_runtime_staging/generated/**` duplicates the runtime-export snapshot under `assets/runtime_exports/public_generated/runtime_staging_snapshot/**`.
5. `app/src/imported_runtime_staging/server/staticServing.mjs` still resolves authored shell paths through `publicRoot -> importedPublicRoot` fallback and therefore still lets `/generated/*` depend on the imported public subtree.
6. `runtimePaths.mjs` already has `runtimeExportsRoot`, but the static-serving layer does not use that boundary explicitly for `/generated/*`.

## Target operating boundary

- `app/public/` = authored shell surface.
- `assets/runtime_exports/public_generated/runtime_staging_snapshot/` = generated runtime-export surface.
- `app/public/imported_runtime_staging/` = migration seam that runtime should no longer need as an active public dependency.

This plan does **not** move generated outputs into `app/public/generated/`. The browser route remains `/generated/*`, but the server should map that route to the runtime-export snapshot root explicitly.

---

## Slice 1 — make generated export serving explicit

**Objective:** stop serving `/generated/*` through imported-public fallback and serve it from the runtime-export root instead.

**Files:**
- Modify: `app/src/imported_runtime_staging/runtimePaths.mjs`
- Modify: `app/src/imported_runtime_staging/server.mjs`
- Modify: `app/src/imported_runtime_staging/server/staticServing.mjs`
- Test: `app/tests/imported_runtime_staging/runtimePaths.test.mjs`
- Test: `app/tests/imported_runtime_staging/serverApi.test.mjs`

**Required changes:**
1. Add `generatedPublicRoot` to `createRuntimePaths()` and default it to `assets/runtime_exports/public_generated/runtime_staging_snapshot`.
2. Keep `runtimeExportsRoot` as the broader runtime-export pointer if other modules still use it, but make the serving contract use `generatedPublicRoot` by name.
3. Pass `generatedPublicRoot` through `createServer()` context.
4. In `serveStatic()`, intercept `/generated/*` before generic public serving and serve from `generatedPublicRoot`.
5. Ensure generated serving works even when `importedPublicRoot` is absent.

**RED/GREEN contract:**
- `runtimePaths.test.mjs` must assert the explicit `generatedPublicRoot` default.
- `serverApi.test.mjs` must prove `/generated/demo.json` comes from `generatedPublicRoot`, not from imported-public fallback.
- The generated-serving test should use a `publicRoot` shell plus a separate generated-export root, and it should not require `importedPublicRoot` to exist.

---

## Slice 2 — promote root shell JS/CSS from wrapper to authoritative files

**Objective:** make `app/public/app.js` and `app/public/style.css` real shell files instead of wrappers into the imported subtree.

**Files:**
- Modify: `app/public/app.js`
- Modify: `app/public/style.css`
- Verify: `app/public/index.html`
- Reference-only: `app/public/imported_runtime_staging/app.js`, `app/public/imported_runtime_staging/style.css`

**Required changes:**
1. Replace the root wrapper `app.js` with the imported runtime shell implementation.
2. Replace the root wrapper `style.css` with the imported runtime shell stylesheet.
3. Keep `index.html` rooted at `app/public/index.html`; no behavioral redesign is part of this slice.

**Boundary:** this slice promotes ownership only. Do not mix in unrelated UI refactors.

**GREEN contract:**
- `/app.js` returns a root-owned shell file, not a one-line forwarding wrapper.
- `/style.css` returns a root-owned shell file, not an `@import` wrapper.
- Existing runtime tests still pass with `/generated/*` now coming from the runtime-export root.

---

## Slice 3 — shrink imported-public dependency from active runtime use

**Objective:** make imported-public fallback unnecessary for the active root shell.

**Files:**
- Modify: `app/src/imported_runtime_staging/server/staticServing.mjs`
- Test: `app/tests/imported_runtime_staging/serverApi.test.mjs`
- Test: `app/tests/imported_runtime_staging/serverSplit.test.mjs` if serving structure coverage needs tightening

**Required changes:**
1. Keep root shell serving on `publicRoot`.
2. Keep `/generated/*` on `generatedPublicRoot`.
3. Leave `importedPublicRoot` only as a migration seam if still needed for non-root leftovers, but remove it from the root shell/generated success path.
4. Prefer tightening tests to prove that normal runtime operation no longer depends on imported-public fallback.

**Completion boundary for this slice:** the runtime is considered detached from imported public only when the root shell and `/generated/*` both work without it.

---

## Slice 4 — document the new public/export boundary

**Objective:** make the steady-state boundary legible outside chat.

**Files:**
- Modify: `docs/architecture/asset-flow.md`
- Modify: `docs/architecture/project-layout.md`
- Modify: `docs/migration/parity-checklist.md` if the serving boundary is tracked there
- Update: `docs/plans/2026-05-18-runtime-normalization-plan.md` Phase E details/progress log

**Required changes:**
1. Document that `app/public/` is the authored shell surface.
2. Document that `/generated/*` is served from `assets/runtime_exports/public_generated/runtime_staging_snapshot/`.
3. Record that `app/public/imported_runtime_staging/` is no longer part of the active serving path.
4. Reflect the completed Phase E contract in the broader runtime-normalization plan.

---

## Verification sequence

1. `node --test app/tests/imported_runtime_staging/runtimePaths.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs app/tests/imported_runtime_staging/serverSplit.test.mjs`
2. `npm run check`
3. `npm test`
4. Live smoke through the actual runtime server if needed:
   - `/`
   - `/app.js`
   - `/style.css`
   - `/generated/...`

## Phase E completion criteria

Phase E is complete only when all of the following are true:

- `app/public/index.html`, `app/public/app.js`, and `app/public/style.css` form the active shell without wrapper dependence on `app/public/imported_runtime_staging/`.
- `/generated/*` is explicitly served from `assets/runtime_exports/public_generated/runtime_staging_snapshot/`.
- normal runtime serving no longer depends on `importedPublicRoot` for shell success or generated-export success.
- tests lock the boundary so the imported-public serving seam does not silently return.

## Execution result — 2026-05-18

Completed.

- `runtimePaths.mjs` now exposes `generatedPublicRoot` with default `assets/runtime_exports/public_generated/runtime_staging_snapshot`.
- `createServer()` passes `generatedPublicRoot` into static-serving context.
- `serveStatic()` serves `/generated/*` from `generatedPublicRoot` before generic public serving.
- `app/public/app.js` and `app/public/style.css` are promoted root-owned shell files rather than wrappers.
- architecture/migration docs now describe `app/public/` as the authored shell and `/generated/*` as runtime-export serving.

### Verification results

1. `node --test app/tests/imported_runtime_staging/runtimePaths.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs app/tests/imported_runtime_staging/serverSplit.test.mjs` ✅
2. `npm run check` ✅
3. `npm test` ✅
4. live smoke ✅
   - `GET /` → 200 `text/html`
   - `GET /app.js` → 200 `text/javascript`
   - `GET /style.css` → 200 `text/css`
   - `GET /generated/load/ig_033f91085286e813016a0319d2efb88191a39d2495960760cc.png` → 200 `image/png`
