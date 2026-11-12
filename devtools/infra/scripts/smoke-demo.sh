#!/bin/sh
# Smoke test for the demo stack (infra/compose.demo.yml). Needs only sh, curl and base64.
#
#   sh infra/scripts/smoke-demo.sh
#
# Checks: readiness, login as the seeded demo user, PNG upload to the S3-compatible store,
# byte-for-byte read-back through the app's media endpoint, and rejection of a non-image upload.
# Overrides: SMOKE_BASE_URL (or DEMO_APP_PORT), DEMO_USER_EMAIL, DEMO_USER_PASSWORD, SMOKE_WAIT_SECONDS.
set -eu

BASE="${SMOKE_BASE_URL:-${SMOKE_SCHEME:-http}://127.0.0.1:${DEMO_APP_PORT:-3000}}"
EMAIL="${DEMO_USER_EMAIL:-demo-user@example.com}"
PASSWORD="${DEMO_USER_PASSWORD:-DemoUser-ChangeMe-2026}"
WAIT="${SMOKE_WAIT_SECONDS:-180}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
ok() { printf 'ok:   %s\n' "$1"; }

# 1. readiness
i=0
until curl -fsS -m 5 -o /dev/null "$BASE/api/health/ready" 2>/dev/null; do
  i=$((i + 2))
  [ "$i" -ge "$WAIT" ] && fail "app not ready at $BASE after ${WAIT}s"
  sleep 2
done
ok "readiness ($BASE/api/health/ready)"

# 2. login (cookies are replayed by hand because the session cookie is flagged Secure in production mode)
status="$(curl -sS -m 20 -o "$TMP/login.json" -D "$TMP/login.headers" -w '%{http_code}' \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/sign-in/email")"
[ "$status" = 200 ] || fail "login returned HTTP $status"
COOKIE="$(sed -n 's/^[Ss]et-[Cc]ookie: \([^;]*\).*/\1/p' "$TMP/login.headers" | tr -d '\r' | paste -sd ';' - | sed 's/;/; /g')"
[ -n "$COOKIE" ] || fail "login returned no session cookie"
ok "login as $EMAIL"

# 3. upload a valid 1x1 PNG
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$TMP/dot.png"
status="$(curl -sS -m 30 -o "$TMP/upload.json" -w '%{http_code}' -H "Cookie: $COOKIE" -H "Origin: $BASE" \
  -F 'scope=submission' -F "file=@$TMP/dot.png;type=image/png" "$BASE/api/uploads")"
[ "$status" = 201 ] || fail "upload returned HTTP $status: $(cat "$TMP/upload.json")"
MEDIA_URL="$(sed -n 's/.*"mediaUrl":"\([^"]*\)".*/\1/p' "$TMP/upload.json")"
[ -n "$MEDIA_URL" ] || fail "upload response has no mediaUrl"
ok "upload accepted ($MEDIA_URL)"

# 4. read it back through the app and compare bytes and content type
status="$(curl -sS -m 30 -o "$TMP/back.png" -D "$TMP/back.headers" -w '%{http_code}' -H "Cookie: $COOKIE" "$BASE$MEDIA_URL")"
[ "$status" = 200 ] || fail "media fetch returned HTTP $status"
cmp -s "$TMP/dot.png" "$TMP/back.png" || fail "downloaded bytes differ from the uploaded PNG"
grep -qi '^content-type: image/png' "$TMP/back.headers" || fail "media content type is not image/png"
ok "media read-back is byte-identical (image/png)"

# 5. a non-image must be rejected
printf 'this is not an image' > "$TMP/fake.png"
status="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -H "Cookie: $COOKIE" -H "Origin: $BASE" \
  -F 'scope=submission' -F "file=@$TMP/fake.png;type=image/png" "$BASE/api/uploads")"
[ "$status" = 415 ] || fail "fake image returned HTTP $status (expected 415)"
ok "non-image upload rejected (415)"

printf 'SMOKE TEST PASSED\n'
