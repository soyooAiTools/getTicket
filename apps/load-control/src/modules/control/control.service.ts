import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type ControlRunDraft,
  type ControlRunRecord,
  type LoadTestRunDefinition,
  type NodeRegistration,
  type NodeRunSummary,
  type PlannedNodeAssignment,
  type RunStatus,
} from '@ticketing/contracts';

import { ScenarioEngineService } from '../scenarios/scenario-engine.service';
import { ValidationPolicyService } from '../validation/validation-policy.service';
import { ControlRepository } from './control.repository';

export type StoredRun = {
  definition: LoadTestRunDefinition;
  status: RunStatus;
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
};

type PersistedStoredRun = ControlRunRecord & {
  definition: LoadTestRunDefinition;
};

@Injectable()
export class ControlService {
  constructor(
    private readonly scenarioEngineService: ScenarioEngineService = new ScenarioEngineService(),
    private readonly validationPolicy: ValidationPolicyService = new ValidationPolicyService(),
    private readonly controlRepository?: ControlRepository,
  ) {}

  readonly nodes = new Map<string, NodeRegistration>();

  readonly runs = new Map<string, StoredRun>();

  registerNode(node: NodeRegistration): NodeRegistration {
    this.nodes.set(node.id, node);
    return node;
  }

  listNodes(): NodeRegistration[] {
    return [...this.nodes.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  async createRun(definition: LoadTestRunDefinition): Promise<StoredRun> {
    const run: StoredRun = {
      definition,
      status: 'DRAFT',
      assignments: [],
      summaries: [],
    };

    this.runs.set(definition.id, run);
    await this.persistRunDraft(definition);
    return run;
  }

  async listRuns(): Promise<ControlRunRecord[]> {
    if (this.controlRepository) {
      return this.controlRepository.listRuns();
    }

    return [...this.runs.values()].map((run) => this.toControlRunRecord(run));
  }

  async planRun(runId: string): Promise<StoredRun> {
    const run = await this.getRun(runId);
    this.validationPolicy.assertAllowed(run.definition);
    const assignments = this.scenarioEngineService.planRun(
      run.definition,
      this.listNodes(),
    );

    return this.storeAssignments(runId, assignments);
  }

  async getRun(runId: string): Promise<StoredRun> {
    if (this.controlRepository) {
      const persisted = await this.controlRepository.getRun(runId);

      if (!persisted) {
        throw new NotFoundException(`Unknown run: ${runId}`);
      }

      const storedRun = this.runs.get(runId);

      if (storedRun) {
        storedRun.definition = persisted.definition;
        storedRun.status = persisted.status;
        return storedRun;
      }

      const reconstructed = this.toStoredRun(persisted);
      this.runs.set(runId, reconstructed);
      return reconstructed;
    }

    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Unknown run: ${runId}`);
    }

    return run;
  }

  async storeAssignments(
    runId: string,
    assignments: PlannedNodeAssignment[],
  ): Promise<StoredRun> {
    const run = await this.getRun(runId);
    run.assignments = assignments;
    run.status = 'PLANNED';
    await this.updateRunStatus(runId, 'PLANNED');
    return run;
  }

  async recordSummary(runId: string, summary: NodeRunSummary): Promise<StoredRun> {
    const run = await this.getRun(runId);
    this.assertSummaryMatchesAssignment(run, summary);

    const nextSummaries = run.summaries.filter(
      (entry) => entry.nodeId !== summary.nodeId,
    );

    nextSummaries.push(summary);
    run.summaries = nextSummaries;
    run.status = this.hasCollectedAllSummaries(run) ? 'COMPLETED' : 'PLANNED';
    await this.updateRunStatus(runId, run.status);
    return run;
  }

  async updateRunStatus(runId: string, status: RunStatus): Promise<void> {
    const run = this.runs.get(runId);

    if (run) {
      run.status = status;
    }

    if (!this.controlRepository) {
      return;
    }

    await this.controlRepository.updateRunStatus(runId, status);
  }

  private async persistRunDraft(
    definition: LoadTestRunDefinition,
  ): Promise<void> {
    if (!this.controlRepository) {
      return;
    }

    const draft: ControlRunDraft = {
      id: definition.id,
      templateId: definition.id,
      nodePoolId: definition.inventoryPoolId ?? definition.id,
      definition,
    };

    await this.controlRepository.createRunDraft(draft);
  }

  private toStoredRun(run: PersistedStoredRun): StoredRun {
    return {
      definition: run.definition,
      status: run.status,
      assignments: [],
      summaries: [],
    };
  }

  private toControlRunRecord(run: StoredRun): ControlRunRecord {
    const now = new Date().toISOString();

    return {
      id: run.definition.id,
      templateId: run.definition.id,
      nodePoolId: run.definition.inventoryPoolId ?? run.definition.id,
      mode: run.definition.mode,
      targetBaseUrl: run.definition.targetBaseUrl,
      status: run.status,
      tags: run.definition.tags,
      createdAt: now,
      updatedAt: now,
    };
  }

  private assertSummaryMatchesAssignment(
    run: StoredRun,
    summary: NodeRunSummary,
  ): void {
    if (summary.runId !== run.definition.id) {
      throw new BadRequestException(
        `Summary runId ${summary.runId} does not match run ${run.definition.id}.`,
      );
    }

    const assignment = run.assignments.find(
      (entry) => entry.nodeId === summary.nodeId,
    );

    if (!assignment) {
      throw new BadRequestException(
        `Node ${summary.nodeId} is not assigned to run ${run.definition.id}.`,
      );
    }

    const assignedPhaseIds = assignment.phases.map((phase) => phase.id);
    const duplicatePhaseIds = this.findDuplicateValues(
      summary.phaseSummaries.map((phaseSummary) => phaseSummary.phaseId),
    );
    const submittedPhaseIds = [
      ...new Set(summary.phaseSummaries.map((phaseSummary) => phaseSummary.phaseId)),
    ];
    const assignedPhaseIdSet = new Set(assignedPhaseIds);
    const submittedPhaseIdSet = new Set(submittedPhaseIds);
    const missingPhaseIds = assignedPhaseIds.filter(
      (phaseId) => !submittedPhaseIdSet.has(phaseId),
    );
    const unexpectedPhaseIds = submittedPhaseIds.filter(
      (phaseId) => !assignedPhaseIdSet.has(phaseId),
    );

    if (
      duplicatePhaseIds.length > 0 ||
      missingPhaseIds.length > 0 ||
      unexpectedPhaseIds.length > 0 ||
      submittedPhaseIds.length !== assignedPhaseIds.length
    ) {
      const details = [
        duplicatePhaseIds.length > 0
          ? `Duplicate [${duplicatePhaseIds.sort().join(', ')}].`
          : null,
        missingPhaseIds.length > 0
          ? `Missing [${missingPhaseIds.sort().join(', ')}].`
          : null,
        unexpectedPhaseIds.length > 0
          ? `Unexpected [${unexpectedPhaseIds.sort().join(', ')}].`
          : null,
      ].filter((detail): detail is string => detail !== null);

      throw new BadRequestException(
        `Summary for node ${summary.nodeId} must match assigned phases [${[...assignedPhaseIds]
          .sort()
          .join(', ')}]. ${details.join(' ')}`.trim(),
      );
    }
  }

  private findDuplicateValues(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
        continue;
      }

      seen.add(value);
    }

    return [...duplicates];
  }

  private hasCollectedAllSummaries(run: StoredRun): boolean {
    if (run.assignments.length === 0) {
      return false;
    }

    const expectedNodeIds = new Set(
      run.assignments.map((assignment) => assignment.nodeId),
    );

    if (run.summaries.length !== expectedNodeIds.size) {
      return false;
    }

    return [...expectedNodeIds].every((nodeId) =>
      run.summaries.some((summary) => summary.nodeId === nodeId),
    );
  }
}
