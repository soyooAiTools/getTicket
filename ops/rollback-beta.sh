#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/srv/ticketing-beta}"
TARGET_RELEASE="${1:?usage: rollback-beta.sh <release-dir-name>}"
TARGET_DIR="${BASE_DIR}/releases/${TARGET_RELEASE}"
COMPOSE_FILE="${BASE_DIR}/current/docker-compose.beta.yml"

test -d "${TARGET_DIR}"

ln -sfn "${TARGET_DIR}" "${BASE_DIR}/current"

docker compose -f "${COMPOSE_FILE}" up -d --build
"${BASE_DIR}/ops/check-beta.sh"
