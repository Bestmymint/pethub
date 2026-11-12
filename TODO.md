# TODO

Notes only, not instructions.

## Now

- [ ] Run e2e tests against a local PostgreSQL and record the integration/e2e steps in `docs/setup.md` (integration tests already run locally; `docs/setup.md` still only says `npm run verify`)

## Next

- [ ] Discuss with the owner: the repo is public but the docs describe it as private (still said in `devtools/README.md` and `devtools/HANDOFF.md`)

## Later

- [ ] Review `PROJECT_COMPARISON.md`

## Done

- [x] Patch `next`, `zod`, `nodemailer`; resync lockfile (`npm audit --omit=dev`: 0 vulnerabilities)
- [x] Push `chore/security-lockfile-docs` and open a PR (merged as PR #1)
- [x] Review `devtools/.env.example` defaults (every secret value is empty)
- [x] Add Linux/bash steps to the main README (Quick start (Linux/macOS))
