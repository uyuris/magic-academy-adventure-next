# Import Map

## Old main project → new project

- `docs/requirements/*` → `docs/requirements/`
- `tools/*` → `tools/`
- `assets_v*` and other generation trees → selected runtime-serving subsets consolidated into `assets/canonical/`, with provenance retained in repo-local manifests where still useful
- accepted asset subsets → `assets/canonical/`

## Old runtime staging → new project

- `src/*` → active runtime source under `app/src/`
- `public/*` → active browser shell under `app/public/`
- `tests/*` → active test suite under `app/tests/`
- `config/*` → local configuration surface under `app/config/`
- `character_visual_sets/*` → canonical serving root at `assets/canonical/character_visual_sets/`; provenance is retained in repo-local notes/manifests such as `assets/mapping/asset-origin-map.json`
- `public/generated/*` → compatibility-served from repo-local canonical assets rather than a separate runtime-export mirror
- `game_data` canonical definitions → `data/definitions/`
- `game_data` initial-state templates → `data/seeds/`
- `game_data` live/save/play/log outputs → `data/mutable/`
