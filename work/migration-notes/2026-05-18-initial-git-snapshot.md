# 2026-05-18 Initial git snapshot

## Summary
- Initialized the repository history with the reorganized `magic-academy-adventure-next` tree.
- Created root commit `faee4ef` (`Initial runtime staging snapshot`).
- Kept runtime-mutable play state out of version control by ignoring `data/mutable/`.
- Also kept machine-local LM Studio config out of version control by ignoring `app/config/imported_runtime_staging/lmstudio.json` while retaining `lmstudio.example.json` as the shared template.

## Verification
- `npm run check`
- `node --test app/tests/imported_runtime_staging/serverSplit.test.mjs app/tests/imported_runtime_staging/serverApi.test.mjs app/tests/imported_runtime_staging/serverLmStudio.test.mjs`
- Result: all checks passed; test run reported 51 passing subtests.

## Git state after commit
- `git status --short --ignored` shows only ignored entries:
  - `app/config/imported_runtime_staging/lmstudio.json`
  - `data/mutable/`
- No tracked modifications remain.

## Restart notes
- Current baseline commit: `faee4ef`.
- If this tree is moved to another machine, copy or recreate `app/config/imported_runtime_staging/lmstudio.json` from the example file and expect runtime play data to appear only under `data/mutable/`.
