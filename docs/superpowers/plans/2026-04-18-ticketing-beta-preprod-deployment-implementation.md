# Ticketing Beta Pre-Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current ticketing workspace into a deployable pre-production stack with a production-ready API build, same-origin admin routing, Dockerized API runtime, Nginx templates, and shell scripts for server preparation, deployment, rollback, health checks, and backup.

**Architecture:** Keep pre-production on one Linux host with host-level Nginx and Docker Compose for `api`, `postgres`, and `redis`. Make the admin a static artifact served by Nginx, make the miniapp point to a real beta API domain, and codify release management around `/srv/ticketing-beta/releases`, `/srv/ticketing-beta/shared`, `/srv/ticketing-beta/current`, and `/srv/ticketing-beta/ops`.

**Tech Stack:** NestJS, Node.js, pnpm, Docker, Docker Compose, Nginx, Bash, PostgreSQL, Redis, Taro miniapp, React admin

---

## Proposed File Structure

- `apps/admin/src/services/request.ts`
  Responsibility: default admin API traffic to same-origin `/api` instead of browser `localhost`.
- `apps/api/package.json`
  Responsibility: add production build and start scripts.
- `apps/api/tsconfig.build.json`
  Responsibility: compile Nest API to a dedicated `dist` output for deployment.
- `apps/api/Dockerfile`
  Responsibility: build a deployable API image with generated Prisma client and compiled output.
- `apps/api/.dockerignore`
  Responsibility: keep Docker build context lean and deterministic.
- `docker-compose.beta.yml`
  Responsibility: define pre-production runtime services for `api`, `postgres`, and `redis`.
- `deploy/nginx/ticketing-beta.conf`
  Responsibility: host-level Nginx site config for same-origin admin and API routing.
- `deploy/compose/api.env.example`
  Responsibility: document server-side runtime env variables for the API container.
- `ops/prepare-server.sh`
  Responsibility: bootstrap a fresh Linux host with required packages and server directory structure.
- `ops/deploy-beta.sh`
  Responsibility: create a release, stage admin artifacts, refresh API image/runtime, run migrations, and switch `current`.
- `ops/rollback-beta.sh`
  Responsibility: switch back to the previous release and restore service pointers.
- `ops/check-beta.sh`
  Responsibility: run a minimal host/runtime health check against Nginx, containers, and `/api/catalog/events`.
- `ops/backup-beta.sh`
  Responsibility: back up Postgres and key config files into a timestamped archive.
- `README.md`
  Responsibility: explain the pre-production deployment workflow in Chinese and point operators to the right scripts.

### Task 1: Fix Admin Same-Origin API Defaults

**Files:**
- Modify: `apps/admin/src/services/request.ts`
- Test: `corepack pnpm --filter admin build`

- [ ] **Step 1: Update the admin default API base URL to same-origin `/api`**

```ts
// apps/admin/src/services/request.ts
const DEFAULT_API_BASE_URL = '/api';
```

- [ ] **Step 2: Preserve localStorage override support without changing operator behavior**

```ts
// apps/admin/src/services/request.ts
function buildApiUrl(path: string) {
  const baseUrl =
    readBrowserSetting(API_BASE_URL_STORAGE_KEY) ?? DEFAULT_API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
```

- [ ] **Step 3: Build the admin app to confirm the same-origin default compiles**

Run: `corepack pnpm --filter admin build`

Expected: PASS, producing the admin `dist` artifact.

### Task 2: Add Production API Build And Start Scripts

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/tsconfig.build.json`
- Test: `corepack pnpm --filter api exec tsc -p tsconfig.build.json`

- [ ] **Step 1: Add build and start scripts for the API package**

```json
// apps/api/package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js"
  }
}
```

- [ ] **Step 2: Create a build-specific TypeScript config for the API**

```json
// apps/api/tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "./dist",
    "sourceMap": true
  },
  "exclude": ["test", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Compile the API with the production build config**

Run: `corepack pnpm --filter api exec tsc -p tsconfig.build.json`

Expected: PASS, producing `apps/api/dist/main.js`.

### Task 3: Create The API Docker Image Definition

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Test: `docker build -f apps/api/Dockerfile -t ticketing-api-beta .`

- [ ] **Step 1: Add a root-aware Dockerfile for the API image**

```Dockerfile
# apps/api/Dockerfile
FROM node:20-bookworm-slim AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN corepack pnpm --filter @ticketing/contracts test -- contracts.spec.ts
RUN corepack pnpm --filter api prisma:generate
RUN corepack pnpm --filter api build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml /workspace/pnpm-lock.yaml ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /workspace/node_modules/@prisma ./node_modules/@prisma
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Keep the Docker build context lean**

```dockerignore
# apps/api/.dockerignore
.git
node_modules
**/node_modules
dist
**/dist
.codex-temp
.codex_tmp_openai_skills
docs
```

- [ ] **Step 3: Attempt a local API image build**

Run: `docker build -f apps/api/Dockerfile -t ticketing-api-beta .`

Expected: PASS if Docker is available; otherwise document that Docker is unavailable in the current environment and continue with file-level verification.

### Task 4: Define The Beta Compose Runtime

**Files:**
- Create: `docker-compose.beta.yml`
- Create: `deploy/compose/api.env.example`
- Test: `docker compose -f docker-compose.beta.yml config`

- [ ] **Step 1: Add the beta runtime compose file**

```yaml
# docker-compose.beta.yml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file:
      - /srv/ticketing-beta/shared/.env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - beta

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ticketing
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - beta

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - beta

networks:
  beta:

volumes:
  postgres-data:
  redis-data:
```

- [ ] **Step 2: Document the server-side API env file shape**

```env
# deploy/compose/api.env.example
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ticketing
REDIS_URL=redis://redis:6379
ADMIN_API_SECRET=replace-me
VIEWER_ID_CARD_KEY=replace-me
WECHAT_APP_ID=replace-me
WECHAT_APP_SECRET=replace-me
WECHAT_MCH_ID=replace-me
WECHAT_MCH_CERT_SERIAL_NO=replace-me
WECHAT_PRIVATE_KEY_PEM=replace-me
WECHAT_API_V3_KEY=replace-me
WECHAT_PLATFORM_CERT_SERIAL_NO=replace-me
WECHAT_PLATFORM_PUBLIC_KEY_PEM=replace-me
WECHAT_NOTIFY_URL=https://beta.example.com/api/payments/wechat/callback
VENDOR_API_BASE_URL=https://vendor.example.com/api
VENDOR_API_KEY=replace-me
VENDOR_CALLBACK_SECRET=replace-me
```

- [ ] **Step 3: Validate the compose file shape**

Run: `docker compose -f docker-compose.beta.yml config`

Expected: PASS if Docker is available; otherwise note that Compose validation could not run in the current environment.

### Task 5: Add The Host Nginx Site Template

**Files:**
- Create: `deploy/nginx/ticketing-beta.conf`
- Test: manual config review

- [ ] **Step 1: Add the pre-production Nginx config template**

```nginx
# deploy/nginx/ticketing-beta.conf
server {
    listen 80;
    server_name beta.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name beta.example.com;

    ssl_certificate /etc/letsencrypt/live/beta.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beta.example.com/privkey.pem;

    root /srv/ticketing-beta/current/admin-dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Verify the config matches the agreed architecture**

Expected review points:
- `admin` is served from `/srv/ticketing-beta/current/admin-dist`
- `/api/` is proxied to the API runtime
- front-end routing falls back to `index.html`
- ACME challenge path is preserved

### Task 6: Add Server Preparation And Health Scripts

**Files:**
- Create: `ops/prepare-server.sh`
- Create: `ops/check-beta.sh`
- Test: shell syntax validation

- [ ] **Step 1: Create the server bootstrap script**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/srv/ticketing-beta"

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx curl jq
sudo systemctl enable docker
sudo systemctl start docker

sudo mkdir -p \
  "${BASE_DIR}/releases" \
  "${BASE_DIR}/shared" \
  "${BASE_DIR}/ops"

sudo chown -R "$USER":"$USER" "${BASE_DIR}"
```

- [ ] **Step 2: Create the beta health-check script**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://beta.example.com}"

curl -fsS "${BASE_URL}/api/catalog/events" >/dev/null
docker compose -f /srv/ticketing-beta/current/docker-compose.beta.yml ps
```

- [ ] **Step 3: Validate shell syntax**

Run: `bash -n ops/prepare-server.sh ops/check-beta.sh`

Expected: PASS with no output.

### Task 7: Add Deploy, Rollback, And Backup Scripts

**Files:**
- Create: `ops/deploy-beta.sh`
- Create: `ops/rollback-beta.sh`
- Create: `ops/backup-beta.sh`
- Test: shell syntax validation

- [ ] **Step 1: Create the deploy script skeleton**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/srv/ticketing-beta"
RELEASE_ID="$(date +%Y-%m-%d-%H%M%S)"
RELEASE_DIR="${BASE_DIR}/releases/${RELEASE_ID}"

mkdir -p "${RELEASE_DIR}"
rsync -a --delete apps/admin/dist/ "${RELEASE_DIR}/admin-dist/"
cp docker-compose.beta.yml "${RELEASE_DIR}/docker-compose.beta.yml"

ln -sfn "${RELEASE_DIR}" "${BASE_DIR}/current"

docker compose -f "${BASE_DIR}/current/docker-compose.beta.yml" up -d --build
docker compose -f "${BASE_DIR}/current/docker-compose.beta.yml" exec api \
  sh -lc "corepack pnpm prisma migrate deploy"

"${BASE_DIR}/ops/check-beta.sh"
```

- [ ] **Step 2: Create the rollback script**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/srv/ticketing-beta"
TARGET_RELEASE="${1:?usage: rollback-beta.sh <release-dir-name>}"
TARGET_DIR="${BASE_DIR}/releases/${TARGET_RELEASE}"

test -d "${TARGET_DIR}"
ln -sfn "${TARGET_DIR}" "${BASE_DIR}/current"
docker compose -f "${BASE_DIR}/current/docker-compose.beta.yml" up -d --build
"${BASE_DIR}/ops/check-beta.sh"
```

- [ ] **Step 3: Create the backup script**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/srv/ticketing-beta"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_DIR="${BASE_DIR}/shared/backups/${STAMP}"

mkdir -p "${BACKUP_DIR}"
docker compose -f "${BASE_DIR}/current/docker-compose.beta.yml" exec -T postgres \
  pg_dump -U postgres ticketing > "${BACKUP_DIR}/ticketing.sql"
cp "${BASE_DIR}/shared/.env" "${BACKUP_DIR}/env.backup"
```

- [ ] **Step 4: Validate shell syntax**

Run: `bash -n ops/deploy-beta.sh ops/rollback-beta.sh ops/backup-beta.sh`

Expected: PASS with no output.

### Task 8: Document The Deployment Workflow In Chinese

**Files:**
- Modify: `README.md`
- Test: manual doc review

- [ ] **Step 1: Add a Chinese deployment section to the README**

```md
## 预发部署

推荐预发结构：

- 宿主机 `Nginx`
- Docker Compose 运行 `api/postgres/redis`
- 后台静态构建产物由 Nginx 托管
- 小程序运行时请求预发域名下的 `/api`

关键脚本：

- `ops/prepare-server.sh`
- `ops/deploy-beta.sh`
- `ops/rollback-beta.sh`
- `ops/check-beta.sh`
- `ops/backup-beta.sh`
```

- [ ] **Step 2: Link the deployment spec and script entry points**

Expected review points:
- README points to the Chinese deployment spec
- README points to the new ops scripts
- README does not claim deployment is already complete

### Task 9: Verification Pass

**Files:**
- Verify only

- [ ] **Step 1: Run workspace verification relevant to the deployment changes**

Run: `corepack pnpm --filter admin build`
Expected: PASS

Run: `corepack pnpm --filter api exec tsc -p tsconfig.build.json`
Expected: PASS

Run: `corepack pnpm lint`
Expected: PASS

- [ ] **Step 2: Run shell syntax verification**

Run: `bash -n ops/prepare-server.sh ops/deploy-beta.sh ops/rollback-beta.sh ops/check-beta.sh ops/backup-beta.sh`

Expected: PASS

- [ ] **Step 3: Record environment limitations**

Expected note:
- if Docker is unavailable locally, explicitly state that `docker build` and `docker compose config` were prepared but not executed in this environment
- if a real Linux host is unavailable locally, explicitly state that server bootstrap and Nginx activation were not executed here
