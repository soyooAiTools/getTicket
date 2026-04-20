#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/srv/ticketing-beta}"
BASE_URL="${1:-https://beta.example.com}"
COMPOSE_FILE="${BASE_DIR}/current/docker-compose.beta.yml"

test -f "${COMPOSE_FILE}"

curl -fsSI "${BASE_URL}/" >/dev/null
curl -fsS "${BASE_URL}/api/catalog/events" >/dev/null
docker compose -f "${COMPOSE_FILE}" ps
