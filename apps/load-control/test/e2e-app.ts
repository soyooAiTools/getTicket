import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type {
  ControlRunDraft,
  ControlRunRecord,
  LoadTestRunDefinition,
  NodeHealthStatus,
  NodePool,
  NodeRole,
  NodeRunSummary,
  NodeTelemetrySample,
  PlannedNodeAssignment,
  RunStatus,
  ScenarioTemplate,
} from '@ticketing/contracts';

import { AppModule } from '../src/app.module';
import { ControlRepository } from '../src/modules/control/control.repository';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

type PersistedRunRecord = ControlRunRecord & {
  definition: LoadTestRunDefinition;
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
};

type UpsertNodeInput = Parameters<ControlRepository['upsertNode']>[0];
type UpsertNodeResult = Awaited<ReturnType<ControlRepository['upsertNode']>>;

export async function createLoadControlE2eApp(): Promise<INestApplication> {
  const runs = new Map<string, PersistedRunRecord>();

  const controlRepository: Partial<ControlRepository> = {
    async createRunDraft(draft: ControlRunDraft) {
      const now = new Date().toISOString();
      const record: PersistedRunRecord = {
        id: draft.id,
        templateId: draft.templateId,
        nodePoolId: draft.nodePoolId,
        mode: draft.definition.mode,
        targetBaseUrl: draft.definition.targetBaseUrl,
        status: 'DRAFT',
        tags: draft.definition.tags,
        createdAt: now,
        updatedAt: now,
        definition: draft.definition,
        assignments: [],
        summaries: [],
      };

      runs.set(record.id, record);
      return record;
    },

    async listRuns() {
      return [...runs.values()].map(
        ({
          definition: _definition,
          assignments: _assignments,
          summaries: _summaries,
          ...record
        }) => record,
      );
    },

    async getRun(runId: string) {
      return runs.get(runId) ?? null;
    },

    async updateRunStatus(runId: string, status: RunStatus) {
      const existing = runs.get(runId);

      if (!existing) {
        throw new Error(`Unknown run: ${runId}`);
      }

      const next = {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      };

      runs.set(runId, next);
      return next;
    },

    async saveAssignments(runId: string, assignments: PlannedNodeAssignment[]) {
      const existing = runs.get(runId);

      if (!existing) {
        throw new Error(`Unknown run: ${runId}`);
      }

      runs.set(runId, {
        ...existing,
        assignments,
        updatedAt: new Date().toISOString(),
      });
    },

    async saveSummary(runId: string, summary: NodeRunSummary) {
      const existing = runs.get(runId);

      if (!existing) {
        throw new Error(`Unknown run: ${runId}`);
      }

      const summaries = existing.summaries.filter(
        (entry) => entry.nodeId !== summary.nodeId,
      );

      summaries.push(summary);

      runs.set(runId, {
        ...existing,
        summaries,
        updatedAt: new Date().toISOString(),
      });
    },

    async upsertNode(input: UpsertNodeInput): Promise<UpsertNodeResult> {
      return {
        id: input.id,
        poolId: input.poolId,
        region: input.region,
        role: input.role,
        healthStatus: input.healthStatus,
        maxConcurrency: input.maxConcurrency,
        networkProfile: input.networkProfile as UpsertNodeResult['networkProfile'],
        labels: input.labels ?? {},
        lastSeenAt:
          typeof input.lastSeenAt === 'string'
            ? input.lastSeenAt
            : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },

    async listNodePools(): Promise<NodePool[]> {
      return [];
    },

    async listTemplates(): Promise<ScenarioTemplate[]> {
      return [];
    },

    async saveTelemetrySample(sample: NodeTelemetrySample) {
      return sample;
    },

    async listRecentTelemetry() {
      return [];
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    })
    .overrideProvider(RedisService)
    .useValue({
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
      getJson: async () => null,
      setJson: async () => undefined,
      delete: async () => 0,
    })
    .overrideProvider(ControlRepository)
    .useValue(controlRepository)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('control');
  await app.init();
  return app;
}
