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

**Demo accounts**: one admin (`demo-admin@example.com`) and one regular user (`demo-user@example.com`). Both use
the **same password, `PetHub-Demo-2026`**. Override the password with `DEMO_PASSWORD` (the e-mails with
`DEMO_ADMIN_EMAIL` / `DEMO_USER_EMAIL`); the defaults are in the `x-demo-env` block of
[`devtools/infra/compose.demo.yml`](devtools/infra/compose.demo.yml).

> **Upgrading from the earlier demo?** The old stack had two different passwords, kept in its database volume.
> Run `docker compose -f infra/compose.demo.yml down -v` once (this deletes the demo database and uploaded
> files), then `up -d --build` again, so the accounts are created with the shared password.

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
