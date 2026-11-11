# Setup (Linux / macOS)

The upstream docs use PowerShell; this is the bash equivalent. Details: `devtools/README.md`.

## Prerequisites
Node.js >= 22.19.0, npm, PostgreSQL 17 (local or container), an S3-compatible store and SMTP/Mailpit
only if you exercise uploads or password reset.

## Steps (from `devtools/`)
1. `cp .env.example .env` and set every value yourself (new secrets per environment; never commit `.env`).
2. `npm ci`
3. `npm run db:generate && npm run db:migrate && npm run db:seed && npm run places:import-public`
   (expected result: 3,091 places).
4. `npm run admin:create -- <admin-email> <password-file-outside-the-repo>`
5. `npm run dev`

## Checks
- Fast, no database: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`
- `npm run build` needs the runtime variables to be set (dummy local values are enough to compile)
- Full gate, including integration/e2e: `npm run verify` (needs PostgreSQL)
