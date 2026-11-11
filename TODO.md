# TODO

Notes only, not instructions.

## Now
- [ ] Get collaborator access, then push `chore/security-lockfile-docs` and open a draft PR
- [ ] Run integration + e2e tests against a local PostgreSQL and record the steps in `docs/setup.md`

## Next
- [ ] Review `devtools/.env.example` defaults (make sure none look like real secrets)
- [ ] Discuss with the owner: the repo is public but the docs describe it as private

## Later
- [ ] Review `PROJECT_COMPARISON.md`
- [ ] Add Linux/bash equivalents of the PowerShell steps to the main README

## Done
- [x] Patch `next`, `zod`, `nodemailer`; resync lockfile (`npm audit --omit=dev`: 0 vulnerabilities)
