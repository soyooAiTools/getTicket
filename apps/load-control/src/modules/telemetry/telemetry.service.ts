import { Injectable, MessageEvent } from '@nestjs/common';
import {
  type LiveRunSnapshot,
  type NodeHealthStatus,
  type NodeRegistration,
  type NodeTelemetrySample,
  type PlannedNodeAssignment,
  liveRunSnapshotSchema,
} from '@ticketing/contracts';
import { concat, from, map, Observable, Subject } from 'rxjs';

import { ControlRepository } from '../control/control.repository';
import { ControlService, type StoredRun } from '../control/control.service';

type LiveNodeSnapshot = LiveRunSnapshot['nodes'][number];
type LiveAlert = LiveRunSnapshot['alerts'][number];

@Injectable()
export class TelemetryService {
  private readonly streams = new Map<string, Subject<LiveRunSnapshot>>();

  constructor(
    private readonly controlService: ControlService,
    private readonly controlRepository: ControlRepository,
  ) {}

  async ingestTelemetry(sample: NodeTelemetrySample): Promise<NodeTelemetrySample> {
    await this.controlService.getRun(sample.runId);

    const savedSample = await this.controlRepository.saveTelemetrySample(sample);
    const snapshot = await this.getLiveSnapshot(sample.runId);
    this.publish(snapshot);
    return savedSample;
  }

  async getLiveSnapshot(runId: string): Promise<LiveRunSnapshot> {
    const run = await this.controlService.getRun(runId);
    const telemetry = await this.controlRepository.listRecentTelemetry(runId, 200);

    const snapshot = this.buildSnapshot(run, telemetry);

    if (snapshot.status === 'STOPPING' && snapshot.activeNodeCount === 0) {
      await this.controlService.updateRunStatus(runId, 'STOPPED');
      snapshot.status = 'STOPPED';
    }

    return liveRunSnapshotSchema.parse(snapshot);
  }

  streamRun(runId: string): Observable<MessageEvent> {
    const initial = from(this.getLiveSnapshot(runId)).pipe(
      map((snapshot) => ({ data: snapshot }) as MessageEvent),
    );
    const updates = this.subjectFor(runId).pipe(
      map((snapshot) => ({ data: snapshot }) as MessageEvent),
    );

    return concat(initial, updates);
  }

  private buildSnapshot(
    run: StoredRun,
    telemetry: NodeTelemetrySample[],
  ): LiveRunSnapshot {
    const latestPerNode = this.latestTelemetryByNode(telemetry);
    const nodes = [...latestPerNode.values()]
      .map((sample) => this.toLiveNode(run, sample))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    const aggregateQps = nodes.reduce((sum, node) => sum + node.qps, 0);
    const aggregateErrorRate =
      aggregateQps > 0
        ? nodes.reduce((sum, node) => sum + node.errorRate * node.qps, 0) /
          aggregateQps
        : 0;
    const aggregateP95LatencyMs = nodes.length
      ? Math.max(...nodes.map((node) => node.p95LatencyMs))
      : 0;
    const activeNodeCount = nodes.filter((node) => node.activeWorkers > 0).length;
    const unhealthyNodeCount = nodes.filter(
      (node) => node.status !== 'ONLINE',
    ).length;
    const currentPhaseId = telemetry[0]?.phaseId ?? null;
    const alerts = nodes
      .filter((node) => node.status !== 'ONLINE')
      .map((node) => this.toAlert(node));
    const updatedAt = telemetry[0]?.recordedAt ?? new Date().toISOString();

    return {
      runId: run.definition.id,
      status: run.status,
      currentPhaseId,
      aggregateQps,
      aggregateErrorRate,
      aggregateP95LatencyMs,
      activeNodeCount,
      unhealthyNodeCount,
      nodes,
      alerts,
      updatedAt,
    };
  }

  private latestTelemetryByNode(
    telemetry: NodeTelemetrySample[],
  ): Map<string, NodeTelemetrySample> {
    const latest = new Map<string, NodeTelemetrySample>();

    for (const sample of telemetry) {
      if (!latest.has(sample.nodeId)) {
        latest.set(sample.nodeId, sample);
      }
    }

    return latest;
  }

  private toLiveNode(
    run: StoredRun,
    sample: NodeTelemetrySample,
  ): LiveNodeSnapshot {
    const assignment = run.assignments.find((entry) => entry.nodeId === sample.nodeId);
    const registeredNode = this.controlService
      .listNodes()
      .find((entry) => entry.id === sample.nodeId);

    return {
      nodeId: sample.nodeId,
      region: assignment?.region ?? registeredNode?.region ?? 'unknown',
      role: assignment?.role ?? registeredNode?.role ?? 'CONTROL',
      status: sample.status,
      phaseId: sample.phaseId,
      qps: sample.qps,
      errorRate: sample.errorRate,
      p95LatencyMs: sample.p95LatencyMs,
      activeWorkers: sample.activeWorkers,
      recordedAt: sample.recordedAt,
    };
  }

  private toAlert(node: LiveNodeSnapshot): LiveAlert {
    return {
      id: `alert-${node.nodeId}`,
      severity: node.status === 'OFFLINE' ? 'CRITICAL' : 'WARN',
      message: this.describeNodeStatus(node.nodeId, node.status),
      recordedAt: node.recordedAt,
    };
  }

  private describeNodeStatus(nodeId: string, status: NodeHealthStatus): string {
    switch (status) {
      case 'OFFLINE':
        return `Node ${nodeId} is offline.`;
      case 'DEGRADED':
        return `Node ${nodeId} is degraded.`;
      case 'BUSY':
        return `Node ${nodeId} is busy.`;
      default:
        return `Node ${nodeId} is reporting normally.`;
    }
  }

  private publish(snapshot: LiveRunSnapshot): void {
    this.subjectFor(snapshot.runId).next(snapshot);
  }

  private subjectFor(runId: string): Subject<LiveRunSnapshot> {
    const existing = this.streams.get(runId);

    if (existing) {
      return existing;
    }

    const created = new Subject<LiveRunSnapshot>();
    this.streams.set(runId, created);
    return created;
  }
}
