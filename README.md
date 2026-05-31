# Magic Academy Adventure Next

Magic Academy Adventure Next is a local-first playable magic-academy adventure project with two execution surfaces:

- a Node-powered browser runtime served from `app/public/`
- an Electron desktop wrapper over the same game/runtime surfaces

This repository is **public-facing development work**, not a polished store-ready release. The goal of the current repo state is that an outside reader can understand what the project is, run the local code/test surfaces, and see the current architectural direction without having to know the private migration history.

For a Japanese player-facing setup guide, see [`USER_README.ja.md`](USER_README.ja.md).

## What is here

- `app/` — local runtime server, browser shell, local config surface, and tests
- `electron/` — Electron desktop entrypoint
- `content/` — canonical authored character/content surfaces
- `data/definitions/` — canonical gameplay/world definitions
- `data/seeds/` — seed runtime data used to bootstrap play
- `data/mutable/` — ignored local mutable runtime/play state created while running locally
- `assets/` — asset manifests, runtime asset routing notes, and any committed asset-side metadata
- `docs/` — requirements, architecture notes, and related project documents
- `tools/` — support scripts for import or asset workflows

## Current project posture

This repo currently aims to be a **local development/runtime repository with runnable code surfaces**.

That means:

- the browser and Electron code surfaces are real and runnable,
- tests and storage contracts are maintained in-repo,
- LM Studio-backed conversation features are part of the intended experience,
- some developer-facing authoring and debug routes still exist because this repo is also the active implementation surface.

This does **not** mean:

- the project is a finished commercial release,
- every local API is meant as a public server surface,
- assets are implicitly granted for third-party reuse.

## Requirements

- Node.js with native `fetch` support (Node 18+ recommended)
- npm
- LM Studio for normal gameplay/conversation progression
- a local model/environment that can run the configured LM Studio target; the current player-facing expectation is the `lmstudio-community` Gemma 4 31B `q4_k_m` model with a 64,000 context window, evaluation batch size 2,048, and at least 24GB VRAM
- optional: Electron, through the packaged npm scripts below

Install dependencies:

```bash
npm install
```

## Quick start: browser runtime

Start the local server:

```bash
npm start
```

The runtime starts on localhost by default:

- default URL: `http://127.0.0.1:4173`

On a fresh clone, the server should still start **without** `app/config/lmstudio.json`.
In that state, you can open the browser shell and settings surface, but normal gameplay/conversation progression requires LM Studio to be configured and running.

Note: the code/runtime surface is runnable from the repository, but some visual runtime assets may remain outside the committed tree unless and until a public asset bundle is published. Treat the current public repo as code-first and architecture-first unless the asset bundle is explicitly included.

## Quick start: Electron runtime

Run the desktop wrapper:

```bash
npm run electron
```

Development variant with devtools enabled:

```bash
npm run electron:dev
```

Packaging scripts:

```bash
npm run electron:dist
npm run electron:mac
npm run electron:win
npm run electron:pack
```

## LM Studio setup

Normal gameplay/conversation progression requires an OpenAI-compatible LM Studio endpoint.
The current player-facing setup expectation is documented in [`USER_README.ja.md`](USER_README.ja.md): `lmstudio-community` Gemma 4 31B `q4_k_m`, context size 64,000, evaluation batch size 2,048, at least 24GB VRAM, Max Concurrent Predictions `1`, Unified KV Cache disabled, and 4bit KV cache quantization for RTX 3090/4090-class 24GB GPUs.

Committed example config:

- `app/config/lmstudio.example.json`

Ignored local config path actually used at runtime:

- `app/config/lmstudio.json`

Default example values point at:

- `http://127.0.0.1:1234/v1`

### Behavior when LM Studio is not configured

- `npm start` still starts the local server
- the browser shell still loads
- the LM Studio settings surface remains available
- conversation/opening flows return a structured config-required error until settings are saved
- normal gameplay/conversation progression should be treated as unavailable until LM Studio is configured and running

This is intentional: missing LM Studio should not prevent the local server/settings surface from opening, but it is a **runtime requirement for the intended game experience**.

## Development and verification commands

Syntax / static sanity check:

```bash
npm run check
```

Main test suite:

```bash
npm test
```

## Runtime surface boundaries

This repo exposes multiple kinds of local surfaces. They are not all the same thing.

### 1. Player-facing runtime surface

The ordinary browser/Electron play flow is the main user-facing surface.
This includes the core map, interaction, training, inventory, save/load, and conversation flows.

### 2. Authoring surface

Some routes allow editing world or character-authored data from the local runtime.
These are development-time conveniences for the active repo workflow, not a claim that the project is a multi-user hosted authoring service.

### 3. Debug / control surface

Some local debug routes exist for flags, relationship state, progression, and inspection.
These are for development and verification. They should be treated as local tooling surfaces, not as a hardened public API contract.

## Storage model

The current architecture separates:

- authored content under `content/`
- canonical definitions under `data/definitions/`
- seed bootstrap data under `data/seeds/`
- mutable runtime/play state under `data/mutable/`

Legacy `game_data/...` compatibility still exists in places, but the direction of the repo is **split authored/definitions/mutable surfaces**, not a return to one giant mutable tree.

## License and reuse

- Code/package license stance: see `LICENSE`
- Asset-specific reuse boundary: see `assets/README.md`

The current repo stance is conservative: visibility of the repository does **not** mean unrestricted reuse of project assets.

## Known limitations / honesty notes

- LM Studio-backed conversation/game progression requires local configuration and a sufficiently capable LM Studio environment before the game works as intended
- the current player-facing LM Studio expectation is `lmstudio-community` Gemma 4 31B `q4_k_m`, context size 64,000, evaluation batch size 2,048, at least 24GB VRAM, Max Concurrent Predictions `1`, Unified KV Cache disabled, and 4bit KV cache quantization for RTX 3090/4090-class GPUs
- some visual runtime assets may remain outside the committed public tree, so a fresh public clone can be structurally runnable while still being visually incomplete
- this is still an active development repository, so some developer-facing routes remain present in the local runtime
- packaging exists, but “publicly visible repo” should not be confused with “final distribution-ready release”
