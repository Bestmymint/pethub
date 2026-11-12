# PetHub

Thai/English web app for finding pet-friendly places in Thailand (Next.js, Prisma, PostgreSQL).

Source files, documentation, and previews from the Zente_devtool workspace.

- [Application source and setup instructions](devtools/README.md)
- [Project comparison](PROJECT_COMPARISON.md)
- [UI previews](previews/)

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

The first run builds the app image and imports the 3,091 public places, so it takes several minutes. When
`docker compose -f infra/compose.demo.yml ps` shows `app` as `healthy`:

| What                           | URL                                          |
| ------------------------------ | -------------------------------------------- |
| App                            | <http://localhost:3000> (bound to 127.0.0.1) |
| Readiness                      | <http://localhost:3000/api/health/ready>     |
| Mailpit (password-reset mails) | <http://localhost:8025> (bound to 127.0.0.1) |

Stack: PostgreSQL 17, Mailpit, SeaweedFS (S3-compatible, internal only), a one-shot `s3-init` (creates the
`pawmap-media` bucket), a one-shot `setup` (migrations, reference data, demo accounts, public places), the app
and the meetup worker. Start-up order is enforced with `service_healthy` / `service_completed_successfully`.

**Demo accounts**: one admin and one regular user, created from `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` and
`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`. Their throwaway defaults are in the `x-demo-env` block of
[`devtools/infra/compose.demo.yml`](devtools/infra/compose.demo.yml).

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
