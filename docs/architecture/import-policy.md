# Import Policy

Governing artifact: this repo's documented read-only migration policy and current project layout. Keep policy references repo-local and avoid machine-specific external file paths in tracked docs.

## Non-negotiable rule

The following source projects are treated as read-only migration inputs and must not be edited in place:

- the older main Magic Academy Adventure project
- the older runtime-staging Magic Academy Adventure project

## Allowed operations

- inspect;
- inventory;
- copy into this project;
- document mapping from old path to new path.

## Forbidden operations

- move/rename/delete in the old projects;
- “cleaning up” old folders instead of importing them;
- treating imported snapshots as the canonical implementation surface;
- writing new implementation directly into `imports/`.

## Import target rule

- provenance copy → `imports/`
- active implementation → `app/`, `content/`, `data/`, `assets/`, `tools/`

## Provenance minimum

Every substantial import should retain enough path/context to answer:

- where it came from;
- why it was imported;
- whether it became canonical content, runtime export, or archive-only material.
