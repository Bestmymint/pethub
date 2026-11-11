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
