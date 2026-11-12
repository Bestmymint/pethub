# PetHub

Thai/English web app for finding pet-friendly places in Thailand (Next.js, Prisma, PostgreSQL).

Source files, documentation, and previews from the Zente_devtool workspace.

- [Application source and setup instructions](devtools/README.md)
- [Project comparison](PROJECT_COMPARISON.md)

Run application commands from `devtools/`. Copy `devtools/.env.example` to
`devtools/.env` and supply your local configuration as described in the application
README.

Local credentials, installed dependencies, generated output, and startup backups
are excluded from version control.

## Run everything with one command

Needs only Docker (Engine with Compose v2+) and internet access to pull images and npm packages.
No `.env`, Node.js or other configuration is required.

```bash
cd devtools
docker compose -f infra/compose.demo.yml up -d --build
```

The first run builds the app image and imports the 3,091 public places: it takes about 4-5 minutes and needs
roughly 10 GB of free disk (images and build cache). When `docker compose -f infra/compose.demo.yml ps` shows
`app` as `healthy`:

| What                           | URL                                      |
| ------------------------------ | ---------------------------------------- |
| App                            | <http://localhost:3000>                  |
| Readiness                      | <http://localhost:3000/api/health/ready> |
| Mailpit (password-reset mails) | <http://localhost:8025>                  |

Use `localhost`, not `127.0.0.1`: the demo's app origin is `http://localhost:3000`, so password-reset links
point there and the login cookie is set for that host. (`127.0.0.1:3000` also passes the origin check, but a
session started there does not carry over to those links.)

The app and Mailpit ports are published on `0.0.0.0` by default so they work through the course box's port
forwards. When you run the stack directly on a machine, keep it private to that machine with
`DEMO_BIND_ADDRESS=127.0.0.1 docker compose -f infra/compose.demo.yml up -d --build`.

### Using the course box

The box must publish the app port (and Mailpit's, to read reset mails). Start it as in the Jenkins lab, with
Mailpit added:

```bash
docker run -dit --name devtools --privileged --tmpfs /run -p 2222:22 -p 8080:8080 -p 3000:3000 -p 8025:8025 -p 8000:8000 tuchsanai/devtools:2569_1
ssh root@localhost -p 2222        # password: passwd
```

Inside the box:

```bash
mkdir -p ~/labwork && cd ~/labwork
git clone https://github.com/Bestmymint/pethub.git
cd pethub/devtools
docker compose -f infra/compose.demo.yml up -d --build
```

Then open <http://localhost:3000> and <http://localhost:8025> on the machine that runs the box.

Stack: PostgreSQL 17, Mailpit, SeaweedFS (S3-compatible, internal only), a one-shot `s3-init` (creates the
`pawmap-media` bucket), a one-shot `setup` (migrations, reference data, demo accounts, public places), the app
and the meetup worker. Start-up order is enforced with `service_healthy` / `service_completed_successfully`.

**Demo accounts**: three accounts, all with the **same password, `PetHub-Demo-2026`** (override it with
`DEMO_PASSWORD`; the e-mails with `DEMO_ADMIN_EMAIL` / `DEMO_USER_EMAIL` / `DEMO_USER2_EMAIL`). They are created by the
setup step, so they exist right after `docker compose up`, and setup adds any missing one to an existing database on
the next `up`. The defaults are in the `x-demo-env` block of
[`devtools/infra/compose.demo.yml`](devtools/infra/compose.demo.yml).

| Account                  | Role  | What it is for                                                                            |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------- |
| `demo-admin@example.com` | Admin | The admin console: report lists, the sample-data buttons, moderation.                     |
| `demo-user@example.com`  | User  | A normal member. Hosts the Meetup "ฝึกคำสั่งพื้นฐานน้องหมากลางสวน".                       |
| `demo-user2@example.com` | User  | A second member, so two people can really talk. Hosts the Meetup "เคล็ดลับดูแลแมวสูงวัย". |

Every account has sample pets (dogs, cats and a rabbit, with Thai names), which show on the pets page and, for the two
members, on their profile in a Meetup chat. These pets belong to the accounts and are kept when the sample data is
deleted.

**Testing chat with two people.** After pressing **สร้างข้อมูลตัวอย่าง** (below), sign in as `demo-user` in a normal
window and as `demo-user2` in a private (incognito) window, since a browser keeps one session per profile. Both are
members of the same Meetups, so open "แชตกลุ่ม" in each window and write to each other. The Meetup hosted by `demo-user`
lets that user pin messages; the one hosted by `demo-user2` lets the other pin. Either can report the other's message,
and `demo-admin` sees the report in the admin console.

> **Upgrading from the earlier demo?** The old stack had two different passwords, kept in its database volume.
> Run `docker compose -f infra/compose.demo.yml down -v` once (this deletes the demo database and uploaded
> files), then `up -d --build` again, so the accounts are created with the shared password.

**Sample data.** In this demo stack (`DEMO_TOOLS_ENABLED=true`, set only in `compose.demo.yml`) the admin overview
has a "ข้อมูลตัวอย่าง (Demo)" card. Sign in as the admin and press **สร้างข้อมูลตัวอย่าง** to fill the site with
Thai sample Meetups (with members and chat, including pinned messages, and two that link `demo-user` and
`demo-user2`), pets for the made-up members, reviews, submissions in several statuses, notifications, and open
reports of every kind. It is safe to press again: nothing is duplicated. **ลบข้อมูลตัวอย่าง**
removes exactly what was created (every sample row has an id starting with `demo_`), recalculates place ratings, and
never touches the imported places, real users, the three demo accounts or their pets. Each press is written to the audit log. With
the variable absent or not `true` (every other environment) the card is hidden and the action refuses.

> **Demo only.** Every default in that file (database password, `BETTER_AUTH_SECRET`, S3 keys, account passwords)
> is public in this repository. Override all `DEMO_*` variables for anything beyond a local demo. Use
> `DEMO_APP_PORT` and `DEMO_MAILPIT_PORT` to change the published ports (the app origin follows `DEMO_APP_PORT`;
> `DEMO_APP_HOST` / `DEMO_APP_SCHEME` change it further).

Nominatim (address search and reverse geocoding) requires an identifying `User-Agent`, and it rejects fake
contacts such as `example.com`. The demo defaults `NOMINATIM_CONTACT_EMAIL` to this repository URL via
`DEMO_NOMINATIM_CONTACT`. For any real deployment set it to your own real contact (Nominatim usage policy).

Application rate limits (sign-in, uploads, reviews, meetups) are **off** in this demo stack via
`RATE_LIMIT_DISABLED=true`. Run with `DEMO_RATE_LIMIT_DISABLED=false` to enforce them. Outside this file the
variable is unset, so limits stay on. The 1 request/second `/api/geocode` throttle is never affected, because it
protects the Nominatim usage policy.

Smoke test (needs only `sh`, `curl` and `base64`, run from `devtools/`):

```bash
sh infra/scripts/smoke-demo.sh
```

It checks readiness, logs in as the demo user, uploads a PNG, reads it back through `/api/media/...` and compares
the bytes, and confirms that a non-image upload is rejected with 415. It exits non-zero on the first failure.

Stop and reset:

```bash
docker compose -f infra/compose.demo.yml down       # stop, keep data
docker compose -f infra/compose.demo.yml down -v    # stop and delete the database and uploaded files
```

Running `up -d --build` again is safe: the one-shot steps are idempotent. This file is separate from
`devtools/infra/compose.yml`, which belongs to the Jenkins blue/green deployment.

## Quick start (Linux/macOS)

```bash
cd devtools
cp .env.example .env   # set your own values, never commit .env
npm ci && npm run db:generate
npm test               # fast checks need no database
```

Full setup (database, seed, admin): [docs/setup.md](docs/setup.md).

## Documentation

- [docs/architecture.md](docs/architecture.md): components and runtime
- [docs/decisions/](docs/decisions/): architectural decision records
- [devtools/HANDOFF.md](devtools/HANDOFF.md): original handoff notes (Thai)
- [TODO.md](TODO.md): working notes
