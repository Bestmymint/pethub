#!/bin/sh
# Remote steps of the PetHub pipeline. The Jenkinsfile ships the source to the course box and runs
#
#   sh $WORK_DIR/devtools/infra/ci/remote.sh <build|test|push|deploy|smoke|cleanup>
#
# over ssh, so every docker command runs ON the box. Settings come in as environment variables
# (never as arguments), and the only secret, the registry token, arrives on stdin for `push`.
# This file can also be run by hand on the box, without Jenkins, to dry-run a stage.
#
#   WORK_DIR           shipped source tree                      (default /root/ci-work/pethub)
#   PETHUB_IMAGE       image reference <user>/pethub:<commit>   (build, push, deploy, smoke)
#   PETHUB_REVISION    full commit hash                         (build, deploy, smoke)
#   PETHUB_EXTRA_TAG   optional second tag, e.g. <user>/pethub:ci-<n>   (build, push)
#   DH_USER            registry user name                       (push)
#   DOCKER_CONFIG_DIR  throwaway docker config directory        (push, cleanup)
#   SMOKE_BASE_URL     app URL on the box                       (smoke; default http://127.0.0.1:3000)
set -eu

WORK_DIR="${WORK_DIR:-/root/ci-work/pethub}"
APP_DIR="$WORK_DIR/devtools"

log() { printf '[remote] %s\n' "$*"; }
fail() {
  printf '[remote] FAIL: %s\n' "$*" >&2
  exit 1
}

need() {
  for name in "$@"; do
    eval "value=\${$name:-}"
    [ -n "$value" ] || fail "environment variable $name is not set"
  done
}

compose() {
  docker compose -f infra/compose.demo.yml -f infra/ci/compose.ci.yml "$@"
}

revision_label() {
  docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"
}

cmd_build() {
  need PETHUB_IMAGE PETHUB_REVISION
  cd "$APP_DIR"
  # The app image is the one that gets pushed; the one-shot setup image (migrations, seed, import) stays local.
  compose build app setup
  if [ -n "${PETHUB_EXTRA_TAG:-}" ]; then
    docker tag "$PETHUB_IMAGE" "$PETHUB_EXTRA_TAG"
  fi
  label="$(revision_label "$PETHUB_IMAGE")"
  [ "$label" = "$PETHUB_REVISION" ] || fail "image revision label is '$label', expected '$PETHUB_REVISION'"
  log "built $PETHUB_IMAGE (revision $label)"
}

cmd_test() {
  cd "$APP_DIR"
  export CI=true
  npm ci
  npm run db:generate
  npm run lint
  npm run typecheck
  npx vitest run --reporter=default
  log "lint, typecheck and unit tests passed"
}

cmd_push() {
  need PETHUB_IMAGE DH_USER DOCKER_CONFIG_DIR
  # Throwaway docker config: the token never lands in the default ~/.docker/config.json.
  umask 077
  mkdir -p "$DOCKER_CONFIG_DIR"
  trap 'rm -rf "$DOCKER_CONFIG_DIR"' EXIT
  export DOCKER_CONFIG="$DOCKER_CONFIG_DIR"
  # The token is read from stdin by docker itself; it is never stored in a shell variable or an argument.
  docker login --username "$DH_USER" --password-stdin
  docker push "$PETHUB_IMAGE"
  if [ -n "${PETHUB_EXTRA_TAG:-}" ]; then
    docker push "$PETHUB_EXTRA_TAG"
  fi
  repository="${PETHUB_IMAGE%:*}"
  pushed="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$PETHUB_IMAGE" |
    sed -n "s|^${repository}@||p" | head -n 1)"
  [ -n "$pushed" ] || fail "no registry digest recorded for $PETHUB_IMAGE after the push"
  pulled="$(docker pull "$PETHUB_IMAGE" | sed -n 's/^Digest: //p' | head -n 1)"
  [ "$pulled" = "$pushed" ] || fail "digest after pulling back ('$pulled') differs from the pushed one ('$pushed')"
  log "pushed and verified $PETHUB_IMAGE@$pushed"
}

cmd_deploy() {
  need PETHUB_IMAGE PETHUB_REVISION
  cd "$APP_DIR"
  docker image inspect "$PETHUB_IMAGE" >/dev/null 2>&1 || fail "image $PETHUB_IMAGE is not on this host"
  # No rebuild: the app and the worker use the image that was built, pushed and pulled back.
  # The one-shot setup service re-runs; its migrations, seed and import are idempotent.
  compose up -d --no-build
  compose ps
  log "deployed $PETHUB_IMAGE"
}

cmd_smoke() {
  need PETHUB_IMAGE PETHUB_REVISION
  cd "$APP_DIR"
  base="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
  waited=0
  code=000
  while [ "$waited" -lt 180 ]; do
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$base/api/health/ready" || true)"
    [ "$code" = 200 ] && break
    sleep 3
    waited=$((waited + 3))
  done
  [ "$code" = 200 ] || fail "$base/api/health/ready answered $code after ${waited}s"
  log "readiness 200 after ${waited}s"

  SMOKE_BASE_URL="$base" sh infra/scripts/smoke-demo.sh

  container="$(compose ps -q app)"
  [ -n "$container" ] || fail "the app container is not running"
  running_label="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$container")"
  [ "$running_label" = "$PETHUB_REVISION" ] ||
    fail "the running app was built from '$running_label', expected '$PETHUB_REVISION'"
  running_image="$(docker inspect --format '{{.Image}}' "$container")"
  expected_image="$(docker image inspect --format '{{.Id}}' "$PETHUB_IMAGE")"
  [ "$running_image" = "$expected_image" ] || fail "the running app is not using $PETHUB_IMAGE"
  log "running app matches revision $running_label"
}

cmd_cleanup() {
  need DOCKER_CONFIG_DIR
  case "$DOCKER_CONFIG_DIR" in
    /root/ci-work/docker-config-*) rm -rf -- "$DOCKER_CONFIG_DIR" ;;
    *) fail "refusing to remove $DOCKER_CONFIG_DIR" ;;
  esac
  log "removed temporary docker config"
}

case "${1:-}" in
  build) cmd_build ;;
  test) cmd_test ;;
  push) cmd_push ;;
  deploy) cmd_deploy ;;
  smoke) cmd_smoke ;;
  cleanup) cmd_cleanup ;;
  *)
    printf 'usage: remote.sh build|test|push|deploy|smoke|cleanup\n' >&2
    exit 2
    ;;
esac
