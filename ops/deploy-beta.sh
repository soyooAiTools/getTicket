#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/srv/ticketing-beta}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
RELEASE_ID="${1:-$(date +%Y-%m-%d-%H%M%S)}"
RELEASE_DIR="${BASE_DIR}/releases/${RELEASE_ID}"
COMPOSE_FILE="${BASE_DIR}/current/docker-compose.beta.yml"

test -d "${REPO_ROOT}/apps/admin/dist"
test ! -e "${RELEASE_DIR}"

install -d "${RELEASE_DIR}/apps" "${RELEASE_DIR}/packages" "${BASE_DIR}/ops"

rsync -a "${REPO_ROOT}/apps/api/" "${RELEASE_DIR}/apps/api/"
rsync -a "${REPO_ROOT}/packages/contracts/" "${RELEASE_DIR}/packages/contracts/"
rsync -a "${REPO_ROOT}/deploy/" "${RELEASE_DIR}/deploy/"
rsync -a --delete "${REPO_ROOT}/apps/admin/dist/" "${RELEASE_DIR}/admin-dist/"

for file in package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore docker-compose.beta.yml; do
  cp "${REPO_ROOT}/${file}" "${RELEASE_DIR}/${file}"
done

for script in prepare-server.sh deploy-beta.sh rollback-beta.sh check-beta.sh backup-beta.sh; do
  install -m 755 "${REPO_ROOT}/ops/${script}" "${BASE_DIR}/ops/${script}"
done

ln -sfn "${RELEASE_DIR}" "${BASE_DIR}/current"

docker compose -f "${COMPOSE_FILE}" up -d --build
docker compose -f "${COMPOSE_FILE}" exec -T api \
  sh -lc 'cd /app && ./node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma'

"${BASE_DIR}/ops/check-beta.sh"
