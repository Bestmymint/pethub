# Profile pictures

`POST /api/profile/avatar` accepts a `file` multipart field containing a genuine JPEG, PNG or WebP up to 5 MiB. Requires a trusted origin and an active authenticated user; ownership always comes from the session. Images are decoded, auto-oriented, cropped to 256 square pixels, stripped of metadata, and encoded as WebP with a 128 KiB output ceiling. Invalid/corrupt images return 415, oversized uploads 413, unauthorized users 401, untrusted origins 403, and excessive uploads 429. Returns `{ image: <local avatar URL> }`. `DELETE` removes the caller's picture and returns `{ image: null }`.

The small normalized WebP is persisted as a data URL in the existing nullable `User.image` column. No migration or object storage configuration is needed. Better Auth's existing session shape retains this image field; UI and chat responses use a local URL rather than embedding the bytes repeatedly.

`GET /api/avatars/[userId]?v=<image fingerprint>` serves the current WebP only to its owner, an active administrator, or another active member of a shared nondeleted Meetup. The target must be active and two-way blocks are respected. Unavailable images and unauthorized targets return 404. Responses use private/no-store caching and nosniff. Chat messages expose only a versioned local avatar URL, never the underlying data URL.

Profile editing includes immediate preview, upload/replace, remove, pending and localized error states. These picture changes save independently of name/language edits. Chat shows a circular clickable avatar beside incoming messages and preserves outgoing alignment, replies, moderation, pagination, and scrolling. Avatar links open the same member pet page as author names. Missing/failed images show an icon. Thai/English, light/dark, mobile and keyboard access remain supported.

## Verification

- `npm run test:integration -- tests/integration/avatars.test.ts tests/integration/meetup-members-places.test.ts`: actual image decoding, database persistence, ownership, trusted origin, corrupt/oversized files, member/admin image access, blocks, suspension, removal, and existing member pet isolation.
- `npx playwright test tests/e2e/avatars.spec.ts`: upload/replace/remove in the profile, reload persistence, two-browser live updates, clickable incoming avatars, existing name editing, localized errors, mobile/dark layout, and axe accessibility.

Tests use temporary accounts and remove their own fixtures. No external image service is called.
