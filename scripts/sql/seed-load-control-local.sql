INSERT INTO load_control."NodePool" (
  "id",
  "name",
  "region",
  "role",
  "status",
  "maxConcurrency",
  "nodeCount",
  "activeNodeCount",
  "labels",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'pool-control-01',
    '香港核心节点池',
    'hk',
    'CONTROL',
    'ONLINE',
    3,
    0,
    0,
    '{}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'pool-observe-01',
    '香港观测节点池',
    'hk',
    'CONTROL',
    'ONLINE',
    2,
    0,
    0,
    '{}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "region" = EXCLUDED."region",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "maxConcurrency" = EXCLUDED."maxConcurrency",
  "labels" = EXCLUDED."labels",
  "updatedAt" = NOW();

INSERT INTO load_control."ScenarioTemplate" (
  "id",
  "name",
  "description",
  "definition",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'template-preprod-01',
    '预发开售窗口演练',
    '用于完整开售链路的预发演练模板。',
    '{
      "mode": "PREPROD",
      "targetBaseUrl": "https://preprod.example.com",
      "inventoryPoolId": "inventory-main",
      "maxGlobalQps": 200,
      "maxNodeConcurrency": 16,
      "tags": { "profile": "preprod-release-window" },
      "ticketTask": {
        "event": {
          "platform": "大麦",
          "eventName": "周杰伦嘉年华世界巡回演唱会",
          "city": "上海",
          "venue": "上海体育场",
          "sessionLabel": "2026-05-01 19:30",
          "saleStartsAt": "2026-04-25T12:00:00.000Z"
        },
        "ticket": {
          "tierLabel": "内场票",
          "priceLabel": "980元",
          "zoneLabel": "A区",
          "quantity": 2
        },
        "nodeStrategy": {
          "poolId": "pool-control-01",
          "launchMode": "SYNC_WITH_JITTER",
          "preferredRegions": ["hk"],
          "expectedNodeCount": 6
        },
        "executionStrategy": {
          "objective": "FULL_SUBMIT",
          "prewarmSeconds": 30,
          "workerLaunchIntervalMs": 1000,
          "queuePollIntervalMs": 1500,
          "lockRetryLimit": 3,
          "orderSubmitLimit": 2
        }
      },
      "requestTemplates": {
        "query": { "method": "GET", "path": "/catalog", "timeoutMs": 500 },
        "queue": { "method": "POST", "path": "/queue", "timeoutMs": 500 },
        "inventoryLock": { "method": "POST", "path": "/inventory/lock", "timeoutMs": 500 },
        "orderSubmit": { "method": "POST", "path": "/orders", "timeoutMs": 500 }
      },
      "phases": [
        {
          "id": "warmup",
          "startsAtOffsetMs": 0,
          "durationMs": 30000,
          "queryConcurrency": 4,
          "queuePollingConcurrency": 2,
          "inventoryLockConcurrency": 0,
          "orderSubmissionConcurrency": 0
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'template-observe-01',
    '只观测冒烟演练',
    '适合低风险链路观察和可用性冒烟验证。',
    '{
      "mode": "OBSERVE_ONLY",
      "targetBaseUrl": "https://preprod.example.com",
      "maxGlobalQps": 120,
      "maxNodeConcurrency": 16,
      "tags": { "profile": "observe-only-smoke" },
      "ticketTask": {
        "event": {
          "platform": "大麦",
          "eventName": "周杰伦嘉年华世界巡回演唱会",
          "city": "上海",
          "venue": "上海体育场",
          "sessionLabel": "2026-05-01 19:30",
          "saleStartsAt": "2026-04-25T12:00:00.000Z"
        },
        "ticket": {
          "tierLabel": "内场票",
          "priceLabel": "980元",
          "zoneLabel": "A区",
          "quantity": 2
        },
        "nodeStrategy": {
          "poolId": "pool-observe-01",
          "launchMode": "STAGGERED",
          "preferredRegions": ["hk"],
          "expectedNodeCount": 2
        },
        "executionStrategy": {
          "objective": "QUEUE_ENTRY",
          "prewarmSeconds": 20,
          "workerLaunchIntervalMs": 1200,
          "queuePollIntervalMs": 1800,
          "lockRetryLimit": 0,
          "orderSubmitLimit": 0
        }
      },
      "requestTemplates": {
        "query": { "method": "GET", "path": "/catalog", "timeoutMs": 500 },
        "queue": { "method": "POST", "path": "/queue", "timeoutMs": 500 },
        "inventoryLock": { "method": "POST", "path": "/inventory/lock", "timeoutMs": 500 },
        "orderSubmit": { "method": "POST", "path": "/orders", "timeoutMs": 500 }
      },
      "phases": [
        {
          "id": "observe",
          "startsAtOffsetMs": 0,
          "durationMs": 30000,
          "queryConcurrency": 4,
          "queuePollingConcurrency": 2,
          "inventoryLockConcurrency": 0,
          "orderSubmissionConcurrency": 0
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'template-peak-lock-01',
    '开售瞬时锁票演练',
    '聚焦热点库存争抢和锁票阶段的瞬时冲击。',
    '{
      "mode": "PREPROD",
      "targetBaseUrl": "https://preprod.example.com",
      "inventoryPoolId": "inventory-main",
      "maxGlobalQps": 260,
      "maxNodeConcurrency": 24,
      "tags": { "profile": "peak-lock-rehearsal" },
      "ticketTask": {
        "event": {
          "platform": "大麦",
          "eventName": "周杰伦嘉年华世界巡回演唱会",
          "city": "上海",
          "venue": "上海体育场",
          "sessionLabel": "2026-05-01 19:30",
          "saleStartsAt": "2026-04-25T12:00:00.000Z"
        },
        "ticket": {
          "tierLabel": "看台票",
          "priceLabel": "580元",
          "zoneLabel": "看台上层",
          "quantity": 2
        },
        "nodeStrategy": {
          "poolId": "pool-control-01",
          "launchMode": "SYNC_WITH_JITTER",
          "preferredRegions": ["hk"],
          "expectedNodeCount": 6
        },
        "executionStrategy": {
          "objective": "LOCK_ONLY",
          "prewarmSeconds": 25,
          "workerLaunchIntervalMs": 800,
          "queuePollIntervalMs": 1200,
          "lockRetryLimit": 4,
          "orderSubmitLimit": 0
        }
      },
      "requestTemplates": {
        "query": { "method": "GET", "path": "/catalog", "timeoutMs": 500 },
        "queue": { "method": "POST", "path": "/queue", "timeoutMs": 500 },
        "inventoryLock": { "method": "POST", "path": "/inventory/lock", "timeoutMs": 500 },
        "orderSubmit": { "method": "POST", "path": "/orders", "timeoutMs": 500 }
      },
      "phases": [
        {
          "id": "warmup",
          "startsAtOffsetMs": 0,
          "durationMs": 15000,
          "queryConcurrency": 4,
          "queuePollingConcurrency": 2,
          "inventoryLockConcurrency": 0,
          "orderSubmissionConcurrency": 0
        },
        {
          "id": "peak-lock",
          "startsAtOffsetMs": 15000,
          "durationMs": 20000,
          "queryConcurrency": 10,
          "queuePollingConcurrency": 6,
          "inventoryLockConcurrency": 8,
          "orderSubmissionConcurrency": 0
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "updatedAt" = NOW();

DELETE FROM load_control."LoadControlRun"
WHERE "id" IN (
  'run-preprod-1',
  'run-preprod-2',
  'run-preprod-3',
  'run-ticket-task-demo-2026-04-21-0216'
);

INSERT INTO load_control."LoadControlRun" (
  "id",
  "templateId",
  "nodePoolId",
  "mode",
  "targetBaseUrl",
  "definition",
  "status",
  "tags",
  "createdAt",
  "updatedAt"
) VALUES (
  'run-local-demo-01',
  'template-preprod-01',
  'pool-control-01',
  'PREPROD',
  'http://localhost:3000/api',
  '{
    "id": "run-local-demo-01",
    "mode": "PREPROD",
    "targetBaseUrl": "http://localhost:3000/api",
    "inventoryPoolId": "inventory-main",
    "maxGlobalQps": 180,
    "maxNodeConcurrency": 12,
    "tags": {
      "source": "local-demo",
      "profile": "ticket-task-demo"
    },
    "ticketTask": {
      "event": {
        "platform": "大麦",
        "eventName": "周杰伦上海站",
        "city": "上海",
        "venue": "上海体育场",
        "sessionLabel": "2026-05-01 19:30",
        "saleStartsAt": "2026-04-25T12:00:00.000Z"
      },
      "ticket": {
        "tierLabel": "内场票",
        "priceLabel": "980元",
        "zoneLabel": "A区",
        "quantity": 2
      },
      "nodeStrategy": {
        "poolId": "pool-control-01",
        "launchMode": "SYNC_WITH_JITTER",
        "preferredRegions": ["hk"],
        "expectedNodeCount": 6
      },
      "executionStrategy": {
        "objective": "FULL_SUBMIT",
        "prewarmSeconds": 30,
        "workerLaunchIntervalMs": 1000,
        "queuePollIntervalMs": 1500,
        "lockRetryLimit": 3,
        "orderSubmitLimit": 2
      }
    },
    "requestTemplates": {
      "query": { "method": "GET", "path": "/catalog", "timeoutMs": 500 },
      "queue": { "method": "POST", "path": "/queue", "timeoutMs": 500 },
      "inventoryLock": { "method": "POST", "path": "/inventory/lock", "timeoutMs": 500 },
      "orderSubmit": { "method": "POST", "path": "/orders", "timeoutMs": 500 }
    },
    "phases": [
      {
        "id": "warmup",
        "startsAtOffsetMs": 0,
        "durationMs": 30000,
        "queryConcurrency": 4,
        "queuePollingConcurrency": 2,
        "inventoryLockConcurrency": 0,
        "orderSubmissionConcurrency": 0
      }
    ]
  }'::jsonb,
  'DRAFT',
  '{
    "source": "local-demo",
    "profile": "ticket-task-demo"
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "templateId" = EXCLUDED."templateId",
  "nodePoolId" = EXCLUDED."nodePoolId",
  "mode" = EXCLUDED."mode",
  "targetBaseUrl" = EXCLUDED."targetBaseUrl",
  "definition" = EXCLUDED."definition",
  "status" = EXCLUDED."status",
  "tags" = EXCLUDED."tags",
  "updatedAt" = NOW();
