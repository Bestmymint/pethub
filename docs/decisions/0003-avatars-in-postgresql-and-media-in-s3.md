---
status: accepted
date: 2026-11-11
---

# Avatars in PostgreSQL, other media in external S3-compatible storage

## Context and Problem Statement
Profile photos (JPG/PNG/WebP, max 5 MB) should work without extra setup; other uploaded media need
object storage. (Recorded from `devtools/AVATARS.md` and `devtools/README.md`.)

## Considered Options
* Everything in object storage
* Avatars in the application database, other media in S3

## Decision Outcome
Chosen option: avatars in PostgreSQL via Prisma; other uploads in an S3-compatible service managed
outside the repo (`S3_*` variables).

### Consequences
* Good, because avatars need no storage configuration.
* Bad, because avatar bytes grow the database and backups.
