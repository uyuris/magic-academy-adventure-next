# Asset Flow

## Purpose

Separate accepted asset truth from runtime placement and from imported generation history.

## Flow

1. imported source generations or source-project asset trees arrive under `imports/` or `assets/source_archives/`;
2. accepted sets are normalized into `assets/canonical/`;
3. compatibility browser routes are mapped from canonical-backed classes by the runtime server rather than requiring a separate runtime-export tree.

## Rules

- `assets/canonical/` is the source of truth for accepted asset sets.
- accepted character visual sets live under `assets/canonical/character_visual_sets/`.
- canonical visual sets must be materialized real directories/files inside this project; do not use symlink mirrors if the project should survive zip distribution to another environment.
- legacy routes `/source-assets/*`, `/source-sheet-assets/*`, `/source-sheet-crops/*`, `/v5-assets/*`, and `/v5-additional-assets/*` are retired from the live runtime surface.
- imported runtime-staging `character_visual_sets` provenance is tracked in manifests and origin maps, not duplicate runtime trees.
- imported runtime-staging `public/generated` provenance is tracked in manifests and origin maps after canonicalization; active serving no longer requires `assets/runtime_exports/`.
- `app/public/` is the authored shell surface (`index.html`, `app.js`, `style.css`).
- `/generated/*` is a compatibility route that maps canonical-backed classes such as backgrounds, title, load images, training card images, scene standees, and face emotions.
- `/canonical/*` is the direct canonical route for accepted runtime assets, including character visual sets.
- `app/public/generated/` and `assets/runtime_exports/` must not exist as active runtime dependencies.
- `app/public/imported_runtime_staging/` is a migration seam/reference surface, not an active generated-export dependency once Phase E is complete.
- preview sheets and identity notes stay with canonical visual sets.
