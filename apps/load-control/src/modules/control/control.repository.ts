import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';

import {
  type ControlRunDraft,
  type ControlRunRecord,
  type LoadTestRunDefinition,
  type NodeHealthStatus,
  type NodePool,
  type NodeRole,
  type NodeTelemetrySample,
  type RunStatus,
  type ScenarioTemplate,
} from '@ticketing/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

type RunDelegate = PrismaClient['loadControlRun'];
type NodeDelegate = PrismaClient['loadControlNode'];
type NodePoolDelegate = PrismaClient['nodePool'];
type TemplateDelegate = PrismaClient['scenarioTemplate'];
type TelemetryDelegate = PrismaClient['loadControlTelemetrySample'];

type PersistedRunRecord = ControlRunRecord & {
  definition: LoadTestRunDefinition;
};

type LoadControlNodeRecord = {
  id: string;
  poolId: string;
  region: string;
  role: NodeRole;
  healthStatus: NodeHealthStatus;
  maxConcurrency: number;
  networkProfile: Prisma.JsonValue | null;
  labels: Record<string, string>;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ControlRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createRunDraft(draft: ControlRunDraft): Promise<ControlRunRecord> {
    const record = await this.runDelegate.upsert({
      where: { id: draft.id },
      create: this.toRunCreateInput(draft),
      update: this.toRunUpdateInput(draft),
    });

    const persisted = this.mapPersistedRun(record);
    await this.redis.setJson(this.runCacheKey(persisted.id), persisted);
    return this.mapRun(record);
  }

  async listRuns(): Promise<ControlRunRecord[]> {
    const records = await this.runDelegate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.mapRun(record));
  }

  async upsertNode(input: {
    id: string;
    poolId: string;
    region: string;
    role: NodeRole;
    healthStatus: NodeHealthStatus;
    maxConcurrency: number;
    networkProfile: Prisma.InputJsonValue | null;
    labels?: Record<string, string>;
    lastSeenAt?: string | Date | null;
  }): Promise<LoadControlNodeRecord> {
    const record = await this.nodeDelegate.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        poolId: input.poolId,
        region: input.region,
        role: input.role,
        healthStatus: input.healthStatus,
        maxConcurrency: input.maxConcurrency,
        networkProfile: input.networkProfile ?? Prisma.DbNull,
        labels: input.labels ?? {},
        lastSeenAt: this.toDateValue(input.lastSeenAt ?? new Date()),
      },
      update: {
        poolId: input.poolId,
        region: input.region,
        role: input.role,
        healthStatus: input.healthStatus,
        maxConcurrency: input.maxConcurrency,
        networkProfile: input.networkProfile ?? Prisma.DbNull,
        labels: input.labels ?? {},
        lastSeenAt: this.toDateValue(input.lastSeenAt ?? new Date()),
      },
    });

    return this.mapNode(record);
  }

  async listNodePools(): Promise<NodePool[]> {
    const records = await this.nodePoolDelegate.findMany({
      include: {
        nodes: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return records.map((record) => this.mapNodePool(record));
  }

  async listTemplates(): Promise<ScenarioTemplate[]> {
    const records = await this.templateDelegate.findMany({
      orderBy: { name: 'asc' },
    });

    return records.map((record) => this.mapTemplate(record));
  }

  async saveTelemetrySample(
    sample: NodeTelemetrySample,
  ): Promise<NodeTelemetrySample> {
    const record = await this.telemetryDelegate.create({
      data: {
        runId: sample.runId,
        nodeId: sample.nodeId,
        phaseId: sample.phaseId,
        status: sample.status,
        qps: sample.qps,
        errorRate: sample.errorRate,
        p95LatencyMs: sample.p95LatencyMs,
        activeWorkers: sample.activeWorkers,
        recordedAt: new Date(sample.recordedAt),
      },
    });

    const freshTelemetry = await this.loadRecentTelemetryFromDatabase(sample.runId);
    await this.redis.setJson(this.telemetryCacheKey(sample.runId), freshTelemetry);

    return this.mapTelemetry(record);
  }

  async listRecentTelemetry(
    runId: string,
    limit = 50,
  ): Promise<NodeTelemetrySample[]> {
    const cached = await this.redis.getJson<NodeTelemetrySample[]>(
      this.telemetryCacheKey(runId),
    );

    if (cached) {
      return cached.slice(0, limit);
    }

    const telemetry = await this.loadRecentTelemetryFromDatabase(runId, limit);
    await this.redis.setJson(this.telemetryCacheKey(runId), telemetry);
    return telemetry;
  }

  async getRun(runId: string): Promise<PersistedRunRecord | null> {
    const cached = await this.redis.getJson<PersistedRunRecord>(
      this.runCacheKey(runId),
    );

    if (cached) {
      return cached;
    }

    const record = await this.runDelegate.findUnique({
      where: { id: runId },
    });

    if (!record) {
      return null;
    }

    const mapped = this.mapPersistedRun(record);
    await this.redis.setJson(this.runCacheKey(mapped.id), mapped);
    return mapped;
  }

  async updateRunStatus(
    runId: string,
    status: RunStatus,
  ): Promise<ControlRunRecord> {
    const record = await this.runDelegate.update({
      where: { id: runId },
      data: { status },
    });

    const persisted = this.mapPersistedRun(record);
    await this.redis.setJson(this.runCacheKey(persisted.id), persisted);
    return this.mapRun(record);
  }

  private get runDelegate(): RunDelegate {
    return this.prisma.loadControlRun;
  }

  private get nodeDelegate(): NodeDelegate {
    return this.prisma.loadControlNode;
  }

  private get nodePoolDelegate(): NodePoolDelegate {
    return this.prisma.nodePool;
  }

  private get templateDelegate(): TemplateDelegate {
    return this.prisma.scenarioTemplate;
  }

  private get telemetryDelegate(): TelemetryDelegate {
    return this.prisma.loadControlTelemetrySample;
  }

  private toRunCreateInput(draft: ControlRunDraft): Prisma.LoadControlRunUncheckedCreateInput {
    const { definition } = draft;

    return {
      id: draft.id,
      templateId: draft.templateId,
      nodePoolId: draft.nodePoolId,
      mode: definition.mode,
      targetBaseUrl: definition.targetBaseUrl,
      definition,
      status: 'DRAFT',
      tags: definition.tags,
    };
  }

  private toRunUpdateInput(draft: ControlRunDraft): Prisma.LoadControlRunUncheckedUpdateInput {
    const { definition } = draft;

    return {
      templateId: draft.templateId,
      nodePoolId: draft.nodePoolId,
      mode: definition.mode,
      targetBaseUrl: definition.targetBaseUrl,
      definition,
      status: 'DRAFT',
      tags: definition.tags,
    };
  }

  private async loadRecentTelemetryFromDatabase(
    runId: string,
    limit = 50,
  ): Promise<NodeTelemetrySample[]> {
    const records = await this.telemetryDelegate.findMany({
      where: { runId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    return records.map((record) => this.mapTelemetry(record));
  }

  private mapRun(record: {
    id: string;
    templateId: string;
    nodePoolId: string;
    mode: LoadTestRunDefinition['mode'];
    targetBaseUrl: string;
    status: RunStatus;
    tags: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): ControlRunRecord {
    return {
      id: record.id,
      templateId: record.templateId,
      nodePoolId: record.nodePoolId,
      mode: record.mode,
      targetBaseUrl: record.targetBaseUrl,
      status: record.status,
      tags: this.toStringRecord(record.tags),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapPersistedRun(record: {
    id: string;
    templateId: string;
    nodePoolId: string;
    mode: LoadTestRunDefinition['mode'];
    targetBaseUrl: string;
    status: RunStatus;
    tags: Prisma.JsonValue;
    definition: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): PersistedRunRecord {
    return {
      ...this.mapRun(record),
      definition: record.definition as LoadTestRunDefinition,
    };
  }

  private mapNode(record: {
    id: string;
    poolId: string;
    region: string;
    role: NodeRole;
    healthStatus: NodeHealthStatus;
    maxConcurrency: number;
    networkProfile: Prisma.JsonValue | null;
    labels: Prisma.JsonValue;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): LoadControlNodeRecord {
    return {
      id: record.id,
      poolId: record.poolId,
      region: record.region,
      role: record.role,
      healthStatus: record.healthStatus,
      maxConcurrency: record.maxConcurrency,
      networkProfile: record.networkProfile,
      labels: this.toStringRecord(record.labels),
      lastSeenAt: record.lastSeenAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapNodePool(record: {
    id: string;
    name: string;
    region: string;
    role: NodeRole;
    nodes: { id: string }[];
    nodeCount: number;
  }): NodePool {
    const nodeIds = record.nodes.map((node) => node.id);

    return {
      id: record.id,
      name: record.name,
      region: record.region,
      role: record.role,
      maxNodes: Math.max(record.nodeCount, nodeIds.length),
      nodeIds,
    };
  }

  private mapTemplate(record: {
    id: string;
    name: string;
    description: string;
    definition: Prisma.JsonValue;
  }): ScenarioTemplate {
    const { id: _definitionId, ...definition } =
      (record.definition as LoadTestRunDefinition) ?? {};

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      definition: definition as Omit<LoadTestRunDefinition, 'id'>,
    };
  }

  private mapTelemetry(record: {
    runId: string;
    nodeId: string;
    phaseId: string | null;
    status: NodeHealthStatus;
    qps: number;
    errorRate: number;
    p95LatencyMs: number;
    activeWorkers: number;
    recordedAt: Date;
  }): NodeTelemetrySample {
    return {
      runId: record.runId,
      nodeId: record.nodeId,
      phaseId: record.phaseId,
      status: record.status,
      qps: record.qps,
      errorRate: record.errorRate,
      p95LatencyMs: record.p95LatencyMs,
      activeWorkers: record.activeWorkers,
      recordedAt: record.recordedAt.toISOString(),
    };
  }

  private toStringRecord(value: Prisma.JsonValue): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, Prisma.JsonValue>).map(
        ([key, entry]) => [key, String(entry)],
      ),
    );
  }

  private toDateValue(value: string | Date | null | undefined): Date {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      return new Date(value);
    }

    return new Date();
  }

  private runCacheKey(runId: string): string {
    return `load-control:run:${runId}`;
  }

  private telemetryCacheKey(runId: string): string {
    return `load-control:telemetry:${runId}`;
  }
}
