# Parity Checklist

- [ ] Requirements destination files exist in the new project.
- [ ] Architecture and import-policy files exist in the new project.
- [ ] Read-only rule for old projects is written in an external artifact and mirrored in project docs.
- [ ] New top-level surfaces exist: `app/`, `content/`, `data/`, `assets/`, `tools/`, `work/`.
- [ ] Runtime server, public shell, tests, and config surfaces live directly under `app/`.
- [ ] `data/definitions`, `data/seeds`, and `data/mutable` are distinct.
- [ ] `assets/canonical` is the canonical runtime asset source, and compatibility routes resolve back into that canonical tree instead of a separate runtime-export mirror.
- [ ] `app/public/` is the authored shell, while compatibility routes such as `/generated/*` are served from canonical-backed repo-local assets rather than imported-public fallbacks.
- [ ] Old-to-new import mapping is documented in a way that matches the current repo, not an intermediate migration layout.
- [ ] Provenance/manifests can be retained without requiring extra top-level import directories in the public repo.
