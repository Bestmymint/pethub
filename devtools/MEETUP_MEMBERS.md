# Meetup members and places

## Place lookup and eligibility

`GET /api/meetups/places?q=<text>` returns `{ items: [...] }`, retaining the existing place option fields and a maximum of 20 suggestions. Queries are trimmed and limited to 100 characters. Empty queries return suggestions for the initial picker; nonempty queries match the public map's place search. The endpoint reads the same PostgreSQL `Place` records and `publicPlaceWhere()` predicate as the map: visible, not deleted, and not `PENDING`. Imported `STALE` places are included. Hidden, deleted, and pending places are excluded.

Meetup creation, editing, discovery, public cover images, join requests, and host approval use this same visibility rule. The server rechecks the place when an action is submitted, so a previously selected place that was hidden or deleted cannot be used. Existing place IDs are retained; no copied location dataset or external geocoding service is involved. Suggestions retain private/no-store response caching.

The shared autocomplete loads suggestions when an empty picker is focused, debounces typed queries, supports keyboard selection and retry, and ignores cancelled/stale responses. It is used by create, edit, and discovery screens.

## Member pet profiles

Routes: `/meetups/[id]/members/[memberId]` and `/en/meetups/[id]/members/[memberId]`. Message author names link to this page. These are authenticated, request-time server pages, not a public member directory or a new public pets API.

The viewer must retain access to that Meetup's chat (an active member or a valid administrator). The target must be an active, available member of that same Meetup. A block in either direction prevents access. Missing, unavailable, blocked, or unrelated targets return the same not-found result. Guests sign in and return to the requested profile.

Only the member's display name, a versioned local profile picture URL, and active pets' basic identity fields are selected: pet ID, name, species, breed, sex, and card colour. Archived pets, email addresses, private notes, birthdays, weight, health history, and care logs are not queried or rendered. Existing owner-only pet actions retain their ownership checks. Profile images are the same species illustrations used in the pet workspace and are labelled as illustrations.

Both languages include a return link to the original chat and a helpful empty state for a member without pets. Member profile pages are marked noindex.

## Verification

- `npm run test:integration -- tests/integration/meetup-members-places.test.ts tests/integration/pets.test.ts tests/integration/meetup-join-requests.test.ts`: PostgreSQL map/search parity, STALE create/edit/discovery/approval, visibility rechecks, member/admin access, two-way blocks, private-field exclusion, and existing owner isolation and join approval.
- `npx playwright test tests/e2e/meetup-members-places.spec.ts`: real chat author navigation, Thai/English profiles, mobile/dark accessibility, empty pets, guest return URL, nonmember rejection, DB-backed place selection, and publishing with the selected place ID.

These tests create temporary users, pets, places, and Meetups, then remove only their own fixtures. No schema migration is needed for these additions.
