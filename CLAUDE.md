# PetHub

Thai/English web app for finding pet-friendly places (Next.js + Prisma + PostgreSQL).
All application code is in `devtools/`; run every npm command from there.
See `devtools/README.md` and `devtools/HANDOFF.md` for the full (Thai) docs, and `devtools/AGENTS.md`
for the auto-generated Next.js note (read `node_modules/next/dist/docs/` before changing Next.js code).

## Commands (run in `devtools/`)
- Install: `npm ci`, then `npm run db:generate`
- Dev: `npm run dev` (http://127.0.0.1:3000; needs `.env` and PostgreSQL)
- Quick checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`
- Full gate: `npm run verify` (also needs a database for migrations/integration)
- Integration/e2e: `npm run test:integration`, `npm run test:e2e` (need PostgreSQL + seed env)

## Layout
- `devtools/src/app` routes and API, `src/features` UI per feature, `src/lib` domain/security/services
- `devtools/prisma` schema, migrations, public places snapshot
- `devtools/infra` Compose, Jenkins, Nginx, deploy scripts; `devtools/tests` unit/integration/e2e
- `docs/` architecture, setup, ADRs in `docs/decisions/`

## Conventions (non-defaults only)
- Node >= 22.19.0; dependencies are pinned to exact versions.
- Authorization (session, role, ownership, origin) is enforced server-side; never move it to the client.
- Never put secrets in `NEXT_PUBLIC_*` variables.
- Conventional Commits; branch from `main`, open PRs (draft first); never push to `main`.

## Gotchas
- CI/CD is Jenkins. The repo forbids GitHub Actions/Packages/raw files as dependencies
  (`npm run verify:no-github`), so do not add `.github/workflows`.
- `devtools/AGENTS.md` is rewritten by `next dev`; do not hand-edit its generated block.
- Changing the expected place count (3,091) to pass an import check is not allowed.
- `.env.example` has default values: treat them as placeholders and never reuse them outside local dev.

## Do not
- Do not read, print or commit `.env*` (except `.env.example`) or any secret.
- Do not run `db:migrate`, `admin:create` or `places:import*` against a non-local database.
- Do not push to `main`, force-push, or rewrite published history.
- Do not add `AGENTS.md` files or tool attribution to commits, PRs or files.
