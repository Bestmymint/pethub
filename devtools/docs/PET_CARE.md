# Pet care workspace

Routes: `/pets` and `/en/pets`. Guests sign in with the existing Better Auth account and return to the pet workspace. These pages include pet profiles, health notes and vaccines, weight history, follow-up dates, daily care, and JSON export. No appointment or clinic-booking module is included.

## Data and action contract

All mutations are Next.js server actions in `src/features/pets/actions.ts`, using the repository's `ActionResult` contract. The server derives `ownerId` from `requireUser`; callers never choose an owner. Pets, health records, and care logs are stored in PostgreSQL. Run `npm run db:generate` and `npm run db:migrate` after pulling the change.

- `savePet(input, id?, locale?)`: creates or updates an active owned profile. Fields: name (1–40), species (`dog`, `cat`, `other`), breed (up to 80), sex (`male`, `female`, `unknown`), optional ISO birth date, optional weight (0–200 kg, exclusive zero), colour (`peach`, `sage`, `lavender`), notes (up to 1000). Dates must exist in the calendar and birthdays cannot be in the future. Unknown ownership fields are discarded.
- `setPetArchived(id, archived, locale?)`: archives/restores an owned pet without deleting health or care history. Archived pets cannot receive new records or care checks until restored.
- `addHealthRecord(input, locale?)`: fields are petId, category (`checkup`, `vaccine`, `weight`, `note`), title (1–100), note (up to 2000), optional positive value up to 200, record date no later than today in Bangkok, and optional follow-up date on/after the record. Weight is required for weight records. Writes lock the pet row through an owner-filtered update inside a transaction, so concurrent weight records preserve the latest record by date rather than insertion order.
- `togglePetCare(input, locale?)`: fields are petId, task (`breakfast`, `play`, `dinner`), and boolean done. The server chooses today's Bangkok date. A unique `(petId, task, date)` key makes checking idempotent. The workspace refreshes when it detects a new local day.

Missing or foreign-owned pets return the same not-found result. Daily checklists are a fixed set of three tasks, with no external reminders. Follow-up reminders are shown in the workspace; they do not schedule email or push messages. Health history is a personal journal, without diagnosis or generated medical advice.

Members of the same Meetup can view each other’s active pet identity cards from chat author links. That separate read selects only basic profile fields and enforces group membership and blocks; it does not expose health, weight, notes, or care logs. See [MEETUP_MEMBERS.md](../MEETUP_MEMBERS.md).

## UI and assets

The landing page, cream/green/pastel theme, sidebar, pet cards, forms, and weight chart adapt the user's PawSpace design. Shared CSS tokens update the existing PawMap components; feature-specific styles are scoped under `paw-*` and `pet-*` classes. Existing map, place, community, Meetup and admin routes continue using their existing data services.

Illustration photos are local assets under `public/images/pawspace`, with attribution in that directory. DM Sans fonts retain their original OFL license under `public/fonts/pawspace`. No external image/font service is needed at runtime. Illustration photos are not user uploads; the existing S3 upload configuration is not required for pet profiles.

## Verification

- `npm test -- tests/unit/pet-schema.test.ts`: dates, limits, weight requirements, task validation, Bangkok calendar, and ownership-field stripping.
- `npm run test:integration -- tests/integration/pets.test.ts`: real PostgreSQL owner isolation, concurrent/backdated weight records, daily care persistence, archive and restore. Creates temporary users and deletes only those users and their cascaded test data.
- `npx playwright test tests/e2e/pets.spec.ts`: browser profile/health/care/archive lifecycle, guest redirect, English/Thai pages, and desktop/tablet/mobile widths. Uses temporary users with the existing signed-session helper.

The WebGL availability of the user's browser remains independent of pet care and the theme. The 3D map still needs a browser capable of creating its graphics context.
