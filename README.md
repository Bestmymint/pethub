# PetHub

Thai/English web app for finding pet-friendly places in Thailand (Next.js, Prisma, PostgreSQL).

**For a teacher or reviewer:** go to [Quick start in the course container](#quick-start-in-the-course-container)
to run the whole system with one `docker compose` command, then use the
[demo accounts](#demo-accounts-and-demo-data). Where each course requirement is evidenced is in the
[evidence-gate map](#evidence-gate-map).

## Contents

1. [What PetHub is](#what-pethub-is)
2. [Quick start in the course container](#quick-start-in-the-course-container)
3. [Demo accounts and demo data](#demo-accounts-and-demo-data)
4. [How it works](#how-it-works)
5. [Testing](#testing)
6. [CI/CD with Jenkins](#cicd-with-jenkins)
7. [Evidence-gate map](#evidence-gate-map)
8. [Project structure, tech stack, security](#project-structure)
9. [Documentation index](#documentation)

## What PetHub is

**Problem.** A pet owner who wants to take a pet out needs to know which places accept it: which animal
types, indoors or outdoors, and whether a leash is required. PetHub stores these rules for every place
(the `PetRule` model in `devtools/prisma/schema.prisma`) instead of leaving them to a general-purpose map.

**Target users.**

- Pet owners in Thailand who look for places that welcome pets (the site is in Thai and English).
- Members who organise or join group activities with their pets (Meetups).
- Administrators who check what members submit and handle reports.

**Solution.** A web app with a map of public places (a 3D map of Thailand and an OpenStreetMap street map),
a snapshot of 3,091 public places, member contributions that an administrator reviews before they appear,
and a Meetup area with group chat. The source of this description is `devtools/README.md` and
`devtools/HANDOFF.md` (both in Thai).

### Features

Each feature below exists in the code (the path is given); [traceability.md](docs/traceability.md) shows
which of them have automated tests.

| Area           | Feature                                                                                                                                                                   | Code                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Map and places | 3D Thailand map and OSM street map; search and filters (category, text, 24 hours, open now); place pages with pet rules; Thai/English pages (`/en/...`); light/dark theme | `src/features/map`, `src/lib/place-repository.ts`, `src/app/en`, `src/lib/theme.ts` |
| Emergency      | An emergency page listing open and 24-hour services, sorted by distance when the browser shares a location                                                                | `src/features/emergency`                                                            |
| Accounts       | Register, sign in, sign out, password reset by e-mail, profile, profile picture                                                                                           | `src/lib/auth.ts`, `src/features/auth`, `src/app/api/profile/avatar`                |
| Contributions  | Place submissions with draft, review, approval or rejection, images; address search and area lookup for the pin                                                           | `src/features/submissions`, `src/app/api/uploads`, `src/app/api/geocode`            |
| Community      | Reviews with ratings and images, favorites in collections, place reports, place verification, notifications                                                               | `src/features/community`, `src/features/user`                                       |
| Pets           | "My pets" workspace: profiles, health records, daily care, archive and restore                                                                                            | `src/features/pets`                                                                 |
| Meetups        | Create and discover Meetups, join by request, group chat with image messages, pinned messages (up to 10), reports, blocking, bans, host transfer, member pets view        | `src/features/meetups`, `src/app/api/meetups`                                       |
| Admin console  | Dashboard, submissions, places, categories, provinces, users, import review, reviews, reports, Meetups, Meetup reports, audit logs                                        | `src/app/admin`, `src/features/admin`                                               |
| Operations     | Health endpoints `/api/health/live` and `/api/health/ready`; one-command demo stack; admin demo-data tools (demo only)                                                    | `src/app/api/health`, `infra/compose.demo.yml`, `src/features/demo`                 |

Paths are relative to `devtools/`.

## Quick start in the course container

Everything below runs inside the course container `tuchsanai/devtools:2569_1`. The demo stack needs only
Docker and internet access to pull images and npm packages. It needs no `.env`, no Node.js and no other
configuration, and no SSH key setup for the application itself.

**Expect:** the first start builds the app image and imports the 3,091 public places. It takes about
4-5 minutes and needs roughly 10 GB of free disk (images and build cache).

### 1. Start the course container (on your machine)

The box must publish the ssh port, the app port 3000, and Mailpit's port 8025 (to read reset mails):

```bash
docker run -dit --name devtools --privileged -p 2222:22 -p 3000:3000 -p 8025:8025 tuchsanai/devtools:2569_1
ssh root@localhost -p 2222        # password: passwd
```

If you also run Jenkins inside the box as in the course lab, add `-p 8080:8080`:

```bash
docker run -dit --name devtools --privileged -p 2222:22 -p 8080:8080 -p 3000:3000 -p 8025:8025 tuchsanai/devtools:2569_1
```

The PetHub demo does not use port 8080, and the pipeline in this repository uses a separate Jenkins
container (see [devtools/infra/ci/README.md](devtools/infra/ci/README.md)).

### 2. Start PetHub (inside the container)

```bash
mkdir -p ~/labwork && cd ~/labwork
git clone https://github.com/Bestmymint/pethub.git
cd pethub/devtools
docker compose -f infra/compose.demo.yml up -d --build
```

Check progress from `~/labwork/pethub/devtools`:

```bash
docker compose -f infra/compose.demo.yml ps
```

When `app` shows `healthy`, open these URLs **on the machine that runs the container**:

| What                           | URL                                      |
| ------------------------------ | ---------------------------------------- |
| App                            | <http://localhost:3000>                  |
| Readiness (health check)       | <http://localhost:3000/api/health/ready> |
| Mailpit (password-reset mails) | <http://localhost:8025>                  |

`/api/health/ready` answers HTTP 200 with `{"status":"ready"...}` when the database is reachable, and 503
otherwise.

Use `localhost`, not `127.0.0.1`: the demo's app origin is `http://localhost:3000`, so password-reset links
point there and the login cookie is set for that host. (`127.0.0.1:3000` also passes the origin check, but a
session started there does not carry over to those links.)

### 3. Smoke test

Needs only `sh`, `curl` and `base64`. Run from `devtools/`:

```bash
sh infra/scripts/smoke-demo.sh
```

It checks readiness, logs in as the demo user, uploads a PNG, reads it back through `/api/media/...` and
compares the bytes, and confirms that a non-image upload is rejected with 415. It exits non-zero on the
first failure and ends with `SMOKE TEST PASSED`.

### 4. Stop and reset

```bash
docker compose -f infra/compose.demo.yml down       # stop, keep data
docker compose -f infra/compose.demo.yml down -v    # stop and delete the database and uploaded files
```

Running `up -d --build` again is safe: the one-shot steps are idempotent. After `down -v` the next `up`
starts from an empty database and imports everything again.

### Troubleshooting

| Problem                                                                       | Cause and fix                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page does not load at `127.0.0.1:3000`, or the reset link does not log in | Use `http://localhost:3000` (see above).                                                                                                                                                             |
| Do I need to set up SSH keys or a `.env`?                                     | No. The key setup in [`devtools/infra/ci/README.md`](devtools/infra/ci/README.md) is only for the Jenkins pipeline. The demo stack takes all its settings from `infra/compose.demo.yml`.             |
| The first start looks stuck                                                   | The first build compiles the app and imports 3,091 places (about 4-5 minutes). Watch `docker compose -f infra/compose.demo.yml ps` and `docker compose -f infra/compose.demo.yml logs -f setup app`. |
| Port 3000 or 8025 is taken                                                    | `DEMO_APP_PORT` and `DEMO_MAILPIT_PORT` change the published ports (see [Other demo settings](#other-demo-settings)). This has not been run in the course container.                                 |

### Running the stack directly (without the course container)

On a machine that has Docker (Engine with Compose v2+), run the same `docker compose` command from
`devtools/`. The app and Mailpit ports are published on `0.0.0.0` by default so they work through the course
container's port forwards. To keep them private to the machine:
`DEMO_BIND_ADDRESS=127.0.0.1 docker compose -f infra/compose.demo.yml up -d --build`.

### What the stack contains

PostgreSQL 17, Mailpit, SeaweedFS (S3-compatible, internal only), a one-shot `s3-init` (creates the
`pawmap-media` bucket), a one-shot `setup` (migrations, reference data, demo accounts, public places), the app
and the Meetup worker. Start-up order is enforced with `service_healthy` / `service_completed_successfully`.
This file is separate from `devtools/infra/compose.yml`, which belongs to the Jenkins blue/green deployment.

## Demo accounts and demo data

Three accounts, all with the **same password, `PetHub-Demo-2026`** (override it with `DEMO_PASSWORD`; the
e-mails with `DEMO_ADMIN_EMAIL` / `DEMO_USER_EMAIL` / `DEMO_USER2_EMAIL`). They are created by the setup step,
so they exist right after `docker compose up`, and setup adds any missing one to an existing database on the
next `up`. The defaults are in the `x-demo-env` block of
[`devtools/infra/compose.demo.yml`](devtools/infra/compose.demo.yml).

| Account                  | Role  | Password           | What it is for                                                                            |
| ------------------------ | ----- | ------------------ | ----------------------------------------------------------------------------------------- |
| `demo-admin@example.com` | Admin | `PetHub-Demo-2026` | The admin console: report lists, the sample-data buttons, moderation.                     |
| `demo-user@example.com`  | User  | `PetHub-Demo-2026` | A normal member. Hosts the Meetup "ฝึกคำสั่งพื้นฐานน้องหมากลางสวน".                       |
| `demo-user2@example.com` | User  | `PetHub-Demo-2026` | A second member, so two people can really talk. Hosts the Meetup "เคล็ดลับดูแลแมวสูงวัย". |

> **Demo only.** Every default in that compose file (database password, `BETTER_AUTH_SECRET`, S3 keys,
> account passwords) is public in this repository. Override all `DEMO_*` variables for anything beyond a local
> demo. These passwords are public defaults for the local demo and must not be reused anywhere else.

Every account has sample pets (dogs, cats and a rabbit, with Thai names), which show on the pets page and, for
the two members, on their profile in a Meetup chat. These pets belong to the accounts and are kept when the
sample data is deleted.

### Admin "Demo data" card

In this demo stack (`DEMO_TOOLS_ENABLED=true`, set only on the `app` service in `compose.demo.yml`) the admin
overview has a "ข้อมูลตัวอย่าง (Demo)" card. Sign in as `demo-admin@example.com` and:

- Press **สร้างข้อมูลตัวอย่าง** (create) to fill the site with Thai sample Meetups (with members and chat,
  including pinned messages, and two that link `demo-user` and `demo-user2`), pets for the made-up members,
  reviews, submissions in several statuses, notifications, and open reports of every kind. It is safe to press
  again: nothing is duplicated.
- Press **ลบข้อมูลตัวอย่าง** (delete) to remove exactly what was created (every sample row has an id starting
  with `demo_`), recalculate place ratings, and leave the imported places, real users, the three demo accounts
  and their pets untouched.

Each press is written to the audit log. With the variable absent or not `true` (every other environment) the
card is hidden and the action refuses.

### Testing chat with two sessions

After pressing **สร้างข้อมูลตัวอย่าง**, sign in as `demo-user` in a normal window and as `demo-user2` in a
private (incognito) window, since a browser keeps one session per profile. Both are members of the same
Meetups, so open "แชตกลุ่ม" in each window and write to each other. The Meetup hosted by `demo-user` lets
that user pin messages; the one hosted by `demo-user2` lets the other pin. Either can report the other's
message, and `demo-admin` sees the report in the admin console.

### Password-reset mail

Open <http://localhost:3000/forgot-password>, enter a demo e-mail, and read the message in Mailpit at
<http://localhost:8025>. The link in it opens the reset page on `http://localhost:3000`.

### Other demo settings

> **Upgrading from the earlier demo?** The old stack had two different passwords, kept in its database volume.
> Run `docker compose -f infra/compose.demo.yml down -v` once (this deletes the demo database and uploaded
> files), then `up -d --build` again, so the accounts are created with the shared password.

- **Nominatim** (address search and reverse geocoding) requires an identifying `User-Agent`, and it rejects
  fake contacts such as `example.com`. The demo defaults `NOMINATIM_CONTACT_EMAIL` to this repository URL via
  `DEMO_NOMINATIM_CONTACT`. For any real deployment set it to your own real contact (Nominatim usage policy).
- **Rate limits** (sign-in, uploads, reviews, Meetups) are **off** in this demo stack via
  `RATE_LIMIT_DISABLED=true`. Run with `DEMO_RATE_LIMIT_DISABLED=false` to enforce them. Outside that file the
  variable is unset, so limits stay on. The 1 request/second `/api/geocode` throttle is never affected,
  because it protects the Nominatim usage policy.
- **Ports:** `DEMO_APP_PORT` and `DEMO_MAILPIT_PORT` change the published ports (the app origin follows
  `DEMO_APP_PORT`; `DEMO_APP_HOST` / `DEMO_APP_SCHEME` change it further).

## How it works

Browser requests go to a Next.js app (pages, API routes and server actions). The app keeps application data
in PostgreSQL through Prisma, stores uploaded images in an S3-compatible bucket (SeaweedFS in the demo; avatars
stay in PostgreSQL), sends password-reset mail over SMTP (Mailpit in the demo) and asks Nominatim for address
search. A small worker process updates Meetup status and sends reminders. Authorization (session, role,
ownership, origin) is checked on the server.

Full diagrams, two end-to-end flows (place submission to public map; Meetup join, chat, pin, report) and a
table of what happens when each integration fails: [docs/architecture.md](docs/architecture.md).

## Testing

Run from `devtools/`. Install once with `npm ci && npm run db:generate`. No test count is quoted here: run
the commands to see the current results.

| What              | Command                          | Needs                                                                                                                                                                                                                           |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint              | `npm run lint`                   | Nothing else.                                                                                                                                                                                                                   |
| Type check        | `npm run typecheck`              | Nothing else (after `npm run db:generate`).                                                                                                                                                                                     |
| Format check      | `npm run format:check`           | Nothing else.                                                                                                                                                                                                                   |
| Unit tests        | `npm test`                       | Nothing else; no database.                                                                                                                                                                                                      |
| Integration tests | `npm run test:integration`       | PostgreSQL with migrations applied (`npm run db:migrate`), `DATABASE_URL`, and the `SEED_*` variables from `.env.example`.                                                                                                      |
| End-to-end tests  | `npm run test:e2e`               | A running app (default `http://127.0.0.1:3000`, override with `PLAYWRIGHT_BASE_URL`), the same database, `SEED_*` variables and Playwright browsers.                                                                            |
| Smoke test        | `sh infra/scripts/smoke-demo.sh` | A running demo stack.                                                                                                                                                                                                           |
| Full gate         | `npm run verify`                 | Runs the `verify:*` gates below, then format check, lint, type check, unit tests with coverage and `next build`. The build needs the runtime variables set (dummy local values are enough, see [docs/setup.md](docs/setup.md)). |

The `verify:*` gates are small scripts in `devtools/scripts/`; `npm run verify` runs them first:

| Command                       | What it checks                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:release`      | Tracked files: no `.env*` (except `.env.example`), dumps, logs, keys or retired credentials.                                      |
| `npm run verify:no-github`    | Tracked text files do not use GitHub Actions, Packages or raw files as dependencies (the project's own repository URL is exempt). |
| `npm run verify:sources`      | Every declared source URL uses an approved host.                                                                                  |
| `npm run verify:data`         | The province and district boundary files match their manifest checksums and counts (77 and 926).                                  |
| `npm run verify:migrations`   | Prisma migrations contain no table or column drops or type changes (except one approved case).                                    |
| `npm run verify:interactions` | Every workflow group in `tests/interaction-manifest.json` points to an existing test file.                                        |

At the time of writing `verify:no-github` reports only the bundled font licence and source notice files in
`devtools/public/fonts/google/`; run it to see the current output.

Without Docker, the first setup (database, seed, admin) is in [docs/setup.md](docs/setup.md).

### Local development (without Docker)

```bash
cd devtools
cp .env.example .env   # set your own values, never commit .env
npm ci && npm run db:generate
npm test               # fast checks need no database
```

## CI/CD with Jenkins

The pipeline in `devtools/infra/ci/` follows the course lab: Jenkins runs no Docker itself. It checks the code
out, ships it over ssh to the course container `devtools`, and runs build, test, push, deploy and smoke
there. Stages: Connect, Checkout and ship, Build, Test, Push, Deploy, Smoke. A red Build or Test stops the
pipeline before Push and Deploy, so the previous deployment keeps running. The trigger is Poll SCM
(`H/2 * * * *`); the image is pushed to Docker Hub as `<user>/pethub:<commit>` and `<user>/pethub:ci-<build>`.

- Job setup, credentials (names only) and the stage table: [devtools/infra/ci/README.md](devtools/infra/ci/README.md)
- Screenshots that prove a green run, an SCM-triggered run and a deliberate failing run, and how to
  reproduce them: [docs/evidence/README.md](docs/evidence/README.md)

## Evidence-gate map

| Gate            | Where the evidence is                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim           | [docs/traceability.md](docs/traceability.md): requirement, acceptance criteria, implementation, verification and status for each feature.                                        |
| Live System     | [Quick start](#quick-start-in-the-course-container) and the [smoke test](#3-smoke-test): the system runs, answers `/api/health/ready`, and passes `smoke-demo.sh`.               |
| Architecture    | [docs/architecture.md](docs/architecture.md) (components, flows, failure behaviour) and the [decision records](docs/decisions/).                                                 |
| Reproducibility | The course-container steps in the [quick start](#quick-start-in-the-course-container) and the [CI/CD](#cicd-with-jenkins) evidence in [docs/evidence/](docs/evidence/README.md). |
| Ownership       | Git history and [docs/ownership.md](docs/ownership.md); the AI-use summary (see the documentation index below).                                                                  |

## Project structure

```text
.
├── README.md                  this file
├── TODO.md                    working notes
├── docs/                      architecture, setup, traceability, ownership, AI usage, evidence, decisions
└── devtools/                  the application (run every npm command here)
    ├── src/app                routes and API
    ├── src/features           UI and workflows per feature
    ├── src/lib                domain, security, services
    ├── prisma                 schema, migrations, public places snapshot
    ├── infra                  Compose files, Jenkins pipeline, Nginx, worker, scripts
    └── tests                  unit, integration, end-to-end
```

### Tech stack

| Layer          | Technology                                                                |
| -------------- | ------------------------------------------------------------------------- |
| App            | Next.js 16, React 19, TypeScript 6 (Node.js 22.19 or newer)               |
| Data           | PostgreSQL 17, Prisma 6                                                   |
| Authentication | better-auth (e-mail and password)                                         |
| UI and maps    | Tailwind CSS 4, maplibre-gl (OpenStreetMap), three.js (3D Thailand map)   |
| Storage, mail  | S3-compatible storage (SeaweedFS in the demo), SMTP (Mailpit in the demo) |
| Tests          | Vitest, Playwright                                                        |
| Delivery       | Docker Compose, Jenkins, Docker Hub                                       |

Exact versions: `devtools/package.json`.

### Security and privacy

Points that can be checked in the repository:

- **Secrets come from the environment.** The app reads them with `requiredEnvironment` (`src/lib/server-config.ts`).
  `.env` files are not tracked; `.env.example` has names with placeholder values; `npm run verify:release` fails
  if a `.env*` file or a retired credential is tracked.
- **Placeholders in build inputs.** The two values `next build` needs are placeholder files in
  `devtools/infra/demo/build-inputs/`, passed as BuildKit secrets, not stored in the image.
- **Server-side authorization.** Admin pages and actions call `requireAdmin`; signed-in pages call
  `requireUser`; suspended users are redirected (`src/lib/auth-guards.ts`). The cookie is `Secure` in
  production mode.
- **Validation.** Forms are validated with zod on the server; sign-up, password reset and name changes get a
  server-side check through an auth hook (`src/lib/auth.ts`).
- **Rate limiting.** Better Auth limits sign-in, sign-up and reset requests; actions such as reviews,
  submissions, Meetup creation and messages use a database-backed limiter (`src/lib/rate-limit.ts`).
- **Origin check.** Uploads and avatar changes refuse an untrusted `Origin` (`src/lib/origin.ts`).
- **S3 handling.** The bucket is not published to the host; images are served only through
  `/api/media/[key]`, which checks the key format and who may read it. Uploads accept real JPEG, PNG or WebP
  content up to 5 MB, detected from the bytes, not the file name.
- **Container.** The runtime image runs as a non-root user (`devtools/Dockerfile`).
- **Demo defaults are public.** See the demo-only note above.

## Documentation

- [docs/architecture.md](docs/architecture.md): components, flows, failure behaviour
- [docs/traceability.md](docs/traceability.md): requirements, implementation, verification and status
- [docs/ownership.md](docs/ownership.md): contribution summary from git history
- [docs/ai-usage.md](docs/ai-usage.md): how AI assistants were used
- [docs/evidence/README.md](docs/evidence/README.md): CI/CD evidence and how to reproduce it
- [docs/setup.md](docs/setup.md): setup without Docker
- [docs/decisions/](docs/decisions/): architectural decision records
- [devtools/README.md](devtools/README.md): application README (Thai)
- [devtools/HANDOFF.md](devtools/HANDOFF.md): original handoff notes (Thai)
- [devtools/infra/ci/README.md](devtools/infra/ci/README.md): Jenkins pipeline
- [PROJECT_COMPARISON.md](PROJECT_COMPARISON.md): comparison with another project (Thai)
- [TODO.md](TODO.md): working notes
