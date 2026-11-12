---
status: accepted
date: 2026-11-11
---

# Use Markdown Architectural Decision Records

## Context and Problem Statement

Design decisions are scattered across long handoff documents and are hard to find or supersede.

## Considered Options

- Keep decisions inside `devtools/HANDOFF.md`
- One Markdown file per decision in `docs/decisions/` (MADR "minimal")

## Decision Outcome

Chosen option: one file per decision, named `NNNN-short-title.md`, because each decision gets a status,
date and stable link.

### Consequences

- Good, because decisions are reviewable in pull requests.
- Bad, because a little extra ceremony per decision.
