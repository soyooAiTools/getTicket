#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/srv/ticketing-beta}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_DIR="${BASE_DIR}/shared/backups/${STAMP}"
COMPOSE_FILE="${BASE_DIR}/current/docker-compose.beta.yml"
NGINX_TEMPLATE="${BASE_DIR}/current/deploy/nginx/ticketing-beta.conf"

mkdir -p "${BACKUP_DIR}"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U postgres ticketing > "${BACKUP_DIR}/ticketing.sql"

cp "${BASE_DIR}/shared/.env" "${BACKUP_DIR}/env.backup"
cp "${COMPOSE_FILE}" "${BACKUP_DIR}/docker-compose.beta.yml"

if [ -f "${NGINX_TEMPLATE}" ]; then
  cp "${NGINX_TEMPLATE}" "${BACKUP_DIR}/ticketing-beta.conf"
fi
