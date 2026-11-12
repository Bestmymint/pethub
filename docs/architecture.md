# Architecture

Source: `devtools/HANDOFF.md` (Thai) and the code. Keep this file in sync when the design changes.

## Overview

PetHub finds pet-friendly places in Thailand (Thai/English). Features: 3D Thailand map and OSM street
map, place submissions, reviews, favorites, reports, Social Meetups with group chat, owned-pet health
book, avatars, and an admin moderation area. The repo ships a public snapshot of 3,091 places.

## Runtime

```text
Browser -> Nginx (blue/green) -> Next.js standalone app
                                   -> PostgreSQL (application data, avatars)
                                   -> S3-compatible storage (uploaded media, external)
                                   -> SMTP provider or Mailpit (password reset)
Jenkins -> checkout -> tests, build, scans -> migration backup -> blue/green deploy -> smoke -> rollback
```

## Components

- `devtools/src/app`: routes and API (public, `/en/...`, auth, user, meetup, admin, health)
- `devtools/src/features`: UI and workflows per feature
- `devtools/src/lib`: domain, repositories, security, shared services
- `devtools/prisma`: schema, migrations, sanitized place snapshot with SHA-256 manifest
- `devtools/infra`: Compose, Jenkins, Nginx, worker and deploy scripts

## External dependencies

PostgreSQL 17, S3-compatible object store, SMTP, Nominatim (geocoding), OpenStreetMap tiles
(attribution required), Jenkins.

## Key stack

Next.js, React, TypeScript, Prisma, better-auth, Tailwind, maplibre-gl, three.js, Vitest, Playwright.
Exact versions: `devtools/package.json`.
