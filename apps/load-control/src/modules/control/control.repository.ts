import { Injectable } from '@nestjs/common';

import {
  type ControlRunDraft,
  type ControlRunRecord,
  type NodeHealthStatus,
  type NodePool,
  type NodeRole,
  type NodeTelemetrySample,
  type RunStatus,
  type ScenarioTemplate,
} from '@ticketing/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

type NodePoolRecord = NodePool;

type LoadControlNodeInput = {
  id: string;
  poolId: string;
  region: string;
  role: NodeRole;
  healthStatus: NodeHealthStatus;
  maxConcurrency: number;
  networkProfile: Record<string, unknown>;
  labels?: Record<string, string>;
  lastSeenAt?: string | Date | null;
};

type LoadControlNodeRecord = LoadControlNodeInput & {
  lastSeenAt: string;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class ControlRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createRunDraft(draft: ControlRunDraft): Promise<ControlRunRecord> {
    const record = await this.runClient.upsert({
      where: { id: draft.id },
      create: this.toRunWritePayload(draft, null, null),
      update: this.toRunWritePayload(draft, null, null),
    });

    const mapped = this.mapRun(record);
    await this.redis.setJson(this.runCacheKey(mapped.id), mapped);
    return mapped;
  }

  async listRuns(): Promise<ControlRunRecord[]> {
    const records = await this.runClient.findMany({
      orderBy: { requestedAt: 'desc' },
    });

    return records.map((record: unknown) => this.mapRun(record));
  }

  async upsertNode(input: LoadControlNodeInput): Promise<LoadControlNodeRecord> {
    const record = await this.nodeClient.upsert({
      where: { id: input.id },
      create: this.toNodeWritePayload(input),
      update: this.toNodeWritePayload(input),
    });

    return this.mapNode(record);
  }

  async listNodePools(): Promise<NodePool[]> {
    const records = await this.nodePoolClient.findMany({
      orderBy: { name: 'asc' },
    });

    return records.map((record: unknown) => this.mapNodePool(record));
  }

  async listTemplates(): Promise<ScenarioTemplate[]> {
    const records = await this.templateClient.findMany({
      orderBy: { name: 'asc' },
    });

    return records.map((record: unknown) => this.mapTemplate(record));
  }

  async saveTelemetrySample(
    sample: NodeTelemetrySample,
  ): Promise<NodeTelemetrySample> {
    const record = await this.telemetryClient.create({
      data: {
        runId: sample.runId,
        nodeId: sample.nodeId,
        poolId: sample.poolId,
        capturedAt: new Date(sample.capturedAt),
        status: sample.status,
        qps: sample.qps,
        errorRate: sample.errorRate,
        p50LatencyMs: sample.p50LatencyMs,
        p95LatencyMs: sample.p95LatencyMs,
        activeRequests: sample.activeRequests,
      },
    });

    const recent = await this.listRecentTelemetry(sample.runId);
    await this.redis.setJson(this.telemetryCacheKey(sample.runId), recent);
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

    const records = await this.telemetryClient.findMany({
      where: { runId },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    });

    const telemetry = records.map((record: unknown) => this.mapTelemetry(record));
    await this.redis.setJson(this.telemetryCacheKey(runId), telemetry);
    return telemetry;
  }

  async getRun(runId: string): Promise<ControlRunRecord | null> {
    const cached = await this.redis.getJson<ControlRunRecord>(
      this.runCacheKey(runId),
    );

    if (cached) {
      return cached;
    }

    const record = await this.runClient.findUnique({
      where: { id: runId },
    });

    if (!record) {
      return null;
    }

    const mapped = this.mapRun(record);
    await this.redis.setJson(this.runCacheKey(mapped.id), mapped);
    return mapped;
  }

  async updateRunStatus(
    runId: string,
    status: RunStatus,
    lifecycle: {
      startedAt?: string | null;
      completedAt?: string | null;
    } = {},
  ): Promise<ControlRunRecord> {
    const record = await this.runClient.update({
      where: { id: runId },
      data: {
        status,
        startedAt:
          lifecycle.startedAt === undefined
            ? undefined
            : this.toDateValue(lifecycle.startedAt),
        completedAt:
          lifecycle.completedAt === undefined
            ? undefined
            : this.toDateValue(lifecycle.completedAt),
      },
    });

    const mapped = this.mapRun(record);
    await this.redis.setJson(this.runCacheKey(mapped.id), mapped);
    return mapped;
  }

  private get runClient(): any {
    return (this.prisma as any).loadControlRun;
  }

  private get nodeClient(): any {
    return (this.prisma as any).loadControlNode;
  }

  private get nodePoolClient(): any {
    return (this.prisma as any).nodePool;
  }

  private get templateClient(): any {
    return (this.prisma as any).scenarioTemplate;
  }

  private get telemetryClient(): any {
    return (this.prisma as any).loadControlTelemetrySample;
  }

  private toRunWritePayload(
    draft: ControlRunDraft,
    startedAt: string | null,
    completedAt: string | null,
  ) {
    return {
      id: draft.id,
      templateId: draft.templateId,
      nodePoolId: draft.nodePoolId,
      status: draft.status,
      requestedBy: draft.requestedBy,
      requestedAt: this.toDateValue(draft.requestedAt),
      startedAt: this.toDateValue(startedAt),
      completedAt: this.toDateValue(completedAt),
      tags: draft.tags,
    };
  }

  private toNodeWritePayload(input: LoadControlNodeInput) {
    return {
      id: input.id,
      poolId: input.poolId,
      region: input.region,
      role: input.role,
      healthStatus: input.healthStatus,
      maxConcurrency: input.maxConcurrency,
      networkProfile: input.networkProfile,
      labels: input.labels ?? {},
      lastSeenAt: this.toDateValue(input.lastSeenAt ?? new Date()),
    };
  }

  private mapRun(record: unknown): ControlRunRecord {
    const run = record as Record<string, unknown>;

    return {
      id: String(run.id),
      templateId: String(run.templateId),
      nodePoolId: String(run.nodePoolId),
      status: String(run.status) as RunStatus,
      requestedBy: String(run.requestedBy),
      requestedAt: this.toIsoString(run.requestedAt),
      startedAt: this.toNullableIsoString(run.startedAt),
      completedAt: this.toNullableIsoString(run.completedAt),
      tags: this.toStringRecord(run.tags),
    };
  }

  private mapNode(record: unknown): LoadControlNodeRecord {
    const node = record as Record<string, unknown>;

    return {
      id: String(node.id),
      poolId: String(node.poolId),
      region: String(node.region),
      role: String(node.role) as NodeRole,
      healthStatus: String(node.healthStatus) as NodeHealthStatus,
      maxConcurrency: Number(node.maxConcurrency),
      networkProfile: node.networkProfile as Record<string, unknown>,
      labels: this.toStringRecord(node.labels),
      lastSeenAt: this.toIsoString(node.lastSeenAt),
      createdAt:
        node.createdAt == null ? undefined : this.toIsoString(node.createdAt),
      updatedAt:
        node.updatedAt == null ? undefined : this.toIsoString(node.updatedAt),
    };
  }

  private mapNodePool(record: unknown): NodePoolRecord {
    const pool = record as Record<string, unknown>;

    return {
      id: String(pool.id),
      name: String(pool.name),
      region: String(pool.region),
      role: String(pool.role) as NodeRole,
      status: String(pool.status) as NodeHealthStatus,
      maxConcurrency: Number(pool.maxConcurrency),
      nodeCount: Number(pool.nodeCount),
      activeNodeCount: Number(pool.activeNodeCount),
      networkProfile:
        pool.networkProfile == null
          ? undefined
          : (pool.networkProfile as NodePoolRecord['networkProfile']),
      labels: this.toStringRecord(pool.labels),
    };
  }

  private mapTemplate(record: unknown): ScenarioTemplate {
    const template = record as Record<string, unknown>;

    return {
      id: String(template.id),
      name: String(template.name),
      description:
        typeof template.description === 'string'
          ? template.description
          : undefined,
      status: String(template.status) as ScenarioTemplate['status'],
      targetBaseUrl: String(template.targetBaseUrl),
      nodePoolId: String(template.nodePoolId),
      tags: this.toStringRecord(template.tags),
      requestTemplates: template.requestTemplates as ScenarioTemplate['requestTemplates'],
      phases: template.phases as ScenarioTemplate['phases'],
    };
  }

  private mapTelemetry(record: unknown): NodeTelemetrySample {
    const sample = record as Record<string, unknown>;

    return {
      runId: String(sample.runId),
      nodeId: String(sample.nodeId),
      poolId: String(sample.poolId),
      capturedAt: this.toIsoString(sample.capturedAt),
      status: String(sample.status) as NodeHealthStatus,
      qps: Number(sample.qps),
      errorRate: Number(sample.errorRate),
      p50LatencyMs: Number(sample.p50LatencyMs),
      p95LatencyMs: Number(sample.p95LatencyMs),
      activeRequests: Number(sample.activeRequests),
    };
  }

  private toStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        String(entry),
      ]),
    );
  }

  private toDateValue(value: string | Date | null | undefined): Date | null {
    if (value == null) {
      return null;
    }

    return value instanceof Date ? value : new Date(value);
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }

    return new Date(String(value)).toISOString();
  }

  private toNullableIsoString(value: unknown): string | null {
    if (value == null) {
      return null;
    }

    return this.toIsoString(value);
  }

  private runCacheKey(runId: string): string {
    return `load-control:run:${runId}`;
  }

  private telemetryCacheKey(runId: string): string {
    return `load-control:telemetry:${runId}`;
  }
}
