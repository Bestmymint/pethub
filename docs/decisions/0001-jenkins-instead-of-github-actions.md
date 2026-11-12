---
status: accepted
date: 2026-11-11
---

# Jenkins is the CI/CD system; GitHub is source hosting only

## Context and Problem Statement

The project was handed over with Jenkins pipelines (tests, scans, image build, blue/green deploy,
rollback). `npm run verify:no-github` fails if GitHub Actions, Packages, GHCR, raw files or release assets
are used as a dependency or data source. (Recorded from `devtools/HANDOFF.md`; the original rationale is the owner's.)

## Considered Options

- Jenkins (existing)
- GitHub Actions

## Decision Outcome

Chosen option: Jenkins. Do not add `.github/workflows`.

### Consequences

- Good, because the pipeline already covers deploy, migration backup and rollback.
- Bad, because there is no CI feedback on GitHub pull requests; run `npm run verify` locally before a PR.
