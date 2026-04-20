# Authorized Ticketing Platform

Monorepo for an authorized ticketing platform with a Nest API, a Taro miniapp, an admin web app, and shared contract schemas.

## Workspace

- `apps/api`: NestJS backend for auth, catalog, checkout, fulfillment, payments, refunds, viewers, and related support modules
- `apps/miniapp`: Taro miniapp for customer-facing browsing and ticket flow
- `apps/admin`: Vite admin console for operational views
- `packages/contracts`: shared Zod schemas used across apps
- `tests`: repo layout and workspace-level checks

## Common Commands

- `corepack pnpm install`
- `corepack pnpm dev:api`
- `corepack pnpm dev:admin`
- `corepack pnpm dev:miniapp`
- `corepack pnpm lint`
- `corepack pnpm test`

## B 阶段内测运行手册

启动前先把 `.env.example` 复制成 `.env` 并补齐内测环境变量。`TARO_APP_API_BASE_URL` 用来把小程序指向 API。`WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 用于小程序登录接口 `/api/auth/wechat/login`。真实微信支付还需要 `WECHAT_MCH_ID`、`WECHAT_MCH_CERT_SERIAL_NO`、`WECHAT_PRIVATE_KEY_PEM`、`WECHAT_API_V3_KEY`、`WECHAT_PLATFORM_CERT_SERIAL_NO`、`WECHAT_PLATFORM_PUBLIC_KEY_PEM` 和 `WECHAT_NOTIFY_URL`，其中 `WECHAT_NOTIFY_URL` 必须指向 `/api/payments/wechat/callback`。`.env.example` 里保留了 `WECHAT_CALLBACK_SECRET`，但当前实现的支付回调校验依赖微信平台证书和签名流程，而不是共享密钥 Header。

覆盖 `预发联调 + 首场真实开卖值守` 的总手册见：
[docs/superpowers/specs/2026-04-18-ticketing-beta-joint-runbook.md](D:/CodexFolder/docs/superpowers/specs/2026-04-18-ticketing-beta-joint-runbook.md)

可直接执行的配套文档：

- [docs/superpowers/plans/2026-04-18-ticketing-beta-preprod-checklist.md](D:/CodexFolder/docs/superpowers/plans/2026-04-18-ticketing-beta-preprod-checklist.md)
- [docs/superpowers/plans/2026-04-18-ticketing-beta-live-sale-duty-schedule.md](D:/CodexFolder/docs/superpowers/plans/2026-04-18-ticketing-beta-live-sale-duty-schedule.md)
- [docs/superpowers/plans/2026-04-18-ticketing-beta-support-operations-playbook.md](D:/CodexFolder/docs/superpowers/plans/2026-04-18-ticketing-beta-support-operations-playbook.md)

上游出票/退款提交依赖 `VENDOR_API_BASE_URL` 和 `VENDOR_API_KEY`。上游回调通过 `VENDOR_CALLBACK_SECRET` 保护，调用时需要向 `/api/fulfillment/vendor-callback-issued` 和 `/api/refunds/vendor-callback` 传 `x-vendor-callback-secret`。后台接口通过 `ADMIN_API_SECRET` 和 `x-admin-secret` 保护。后台应用现在默认请求同域 `/api`，如果要让后台连到其他环境，可以先在浏览器 localStorage 设置 `ticketing.admin.apiSecret` 和 `ticketing.admin.apiBaseUrl`，然后刷新页面。例如：

```js
localStorage.setItem('ticketing.admin.apiSecret', '<ADMIN_API_SECRET>');
localStorage.setItem('ticketing.admin.apiBaseUrl', 'https://beta.example.com/api');
```

启动流程：执行 `corepack pnpm install`，启动 PostgreSQL，执行 `corepack pnpm --filter api prisma:migrate`，然后再启动 API、后台和小程序。当前演出运营控制项在后台 `/events` 页面，不在 `BETA_*` 环境变量里。现在它们更接近运营/UI 控制，而不是后端硬熔断：`published` 会让演出从公开列表和详情接口消失，而 `saleStatus` 和 `refundEntryEnabled` 主要驱动后台和用户侧状态展示。草稿单创建和退款提交还不能只靠这两个字段被完全拦住，所以应把它们理解为“运营引导和流量暴露控制”，而不是绝对截止开关。设置完 localStorage 后，后台常用入口就是 `/events`、`/orders`、`/fulfillment`、`/refunds`。

联调彩排最小检查项：

1. 确认 `1` 场真实演出已发布，且后台可见退款入口状态。
2. 完成一次小程序登录、添加观演人、创建草稿单和真实微信支付。
3. 确认微信支付回调落地，订单进入上游提交通道，并收到一次成功出票回调。
4. 打开订单详情，提交一次退款申请，并确认收到一次成功退款回调。
5. 模拟一笔异常订单，确认能在后台 `/orders`、`/fulfillment`、`/refunds` 中完成分流处理。

## 预发部署

当前仓库已经补齐了预发部署所需的基础脚本和模板，目标架构是：

- 单台 Linux 宿主机
- 宿主机 `Nginx` 负责 `HTTPS + 后台静态站点 + /api 反向代理`
- `docker-compose.beta.yml` 负责 `api`、`postgres`、`redis`
- 小程序运行时请求 `https://beta.example.com/api`

部署设计与实施计划见：

- [docs/superpowers/specs/2026-04-18-ticketing-beta-preprod-deployment-design.md](D:/CodexFolder/docs/superpowers/specs/2026-04-18-ticketing-beta-preprod-deployment-design.md)
- [docs/superpowers/plans/2026-04-18-ticketing-beta-preprod-deployment-implementation.md](D:/CodexFolder/docs/superpowers/plans/2026-04-18-ticketing-beta-preprod-deployment-implementation.md)

仓库内的预发脚本入口：

- `ops/prepare-server.sh`：首次装机，安装 `Docker / Compose / Nginx / rsync` 并创建 `/srv/ticketing-beta` 目录结构
- `ops/deploy-beta.sh`：创建 release、同步 `admin/API/deploy` 文件、切换 `current`、启动 Compose、执行 `Prisma migrate deploy`、触发健康检查
- `ops/rollback-beta.sh`：切回指定 release 并重新拉起当前版本容器
- `ops/check-beta.sh`：检查首页、`/api/catalog/events` 和 Compose 服务状态
- `ops/backup-beta.sh`：备份 `Postgres`、当前 Compose 文件、Nginx 模板和共享 `.env`

服务器目录约定：

- `/srv/ticketing-beta/releases`：每次发布的独立版本目录
- `/srv/ticketing-beta/shared/.env`：API 容器运行时环境变量
- `/srv/ticketing-beta/current`：当前生效版本的软链接
- `/srv/ticketing-beta/ops`：部署、回滚、健康检查、备份脚本

当前说明：

- 这些脚本已经入库，但还需要在真实 Linux 预发机上执行
- 这个本地 Windows 工作区没有实际完成服务器装机、Nginx 激活或 Docker Compose 发布
- 如果本地缺少 `docker`、`nginx` 或 `bash`，先完成构建和语法校验，再去预发机做实跑验证

## Notes

- The API package uses Jest-based specs.
- Shared and frontend packages use Vitest.
- Root lint is a lightweight baseline pass over the workspace packages and repo-level checks, not a full style-enforcement sweep.
- The risk module currently exposes a baseline purchase-limit check; checkout policy data can be wired in later when a source of truth exists.
