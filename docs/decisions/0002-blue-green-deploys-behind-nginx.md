---
status: accepted
date: 2026-11-11
---

# Blue/green deployment behind Nginx

## Context and Problem Statement
Deploys must be verifiable and reversible. (Recorded from `devtools/HANDOFF.md` and `devtools/infra/`.)

## Considered Options
* In-place restart
* Blue/green slots switched by Nginx upstream

## Decision Outcome
Chosen option: blue/green. A `pg_dump` is taken before migrations, the previous slot is kept until the
candidate passes readiness and smoke tests, and Jenkins can roll back (`infra/scripts/`).

### Consequences
* Good, because rollback is fast.
* Bad, because migrations must stay compatible with the previous slot while both run.
