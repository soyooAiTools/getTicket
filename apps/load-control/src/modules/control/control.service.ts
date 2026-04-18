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
  type NodePool,
  type NodeRunSummary,
  type PlannedNodeAssignment,
  type RunStatus,
  type ScenarioTemplate,
} from '@ticketing/contracts';

import { ScenarioEngineService } from '../scenarios/scenario-engine.service';
import { ValidationPolicyService } from '../validation/validation-policy.service';
import { ControlRepository } from './control.repository';
import {
  DEFAULT_NODE_POOLS,
  DEFAULT_SCENARIO_TEMPLATES,
} from './default-control-catalog';

export type StoredRun = {
  definition: LoadTestRunDefinition;
  status: RunStatus;
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
};

type PersistedStoredRun = ControlRunRecord & {
  definition: LoadTestRunDefinition;
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
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

  private readonly runRecords = new Map<string, ControlRunRecord>();

  private readonly seededNodePools = this.cloneCatalog(DEFAULT_NODE_POOLS);

  private readonly seededTemplates = this.cloneCatalog(DEFAULT_SCENARIO_TEMPLATES);

  registerNode(node: NodeRegistration): NodeRegistration {
    this.nodes.set(node.id, node);
    return node;
  }

  listNodes(): NodeRegistration[] {
    return [...this.nodes.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  async createRun(
    input: ControlRunDraft | LoadTestRunDefinition,
  ): Promise<StoredRun> {
    const isDraft = this.isControlRunDraft(input);
    const draft = isDraft ? input : null;
    const definition: LoadTestRunDefinition = isDraft ? input.definition : input;
    const runId = input.id;

    if (draft && draft.id !== draft.definition.id) {
      throw new BadRequestException('Run draft id must match definition.id.');
    }

    const run: StoredRun = {
      definition,
      status: 'DRAFT',
      assignments: [],
      summaries: [],
    };

    this.runs.set(runId, run);

    if (draft) {
      this.runRecords.set(runId, this.toRunRecord(draft));
      await this.persistRunDraft(draft);
    }

    return run;
  }

  async listRuns(): Promise<ControlRunRecord[]> {
    if (this.controlRepository) {
      return this.controlRepository.listRuns();
    }

    if (this.runRecords.size > 0) {
      return [...this.runRecords.values()].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
    }

    return [...this.runs.values()].map((run) => this.toLegacyRunRecord(run));
  }

  async listNodePools(): Promise<NodePool[]> {
    const persistedPools = this.controlRepository
      ? await this.controlRepository.listNodePools()
      : [];

    return this.mergeCatalog(this.seededNodePools, persistedPools);
  }

  async listTemplates(): Promise<ScenarioTemplate[]> {
    const persistedTemplates = this.controlRepository
      ? await this.controlRepository.listTemplates()
      : [];

    return this.mergeCatalog(this.seededTemplates, persistedTemplates);
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
        const inMemoryRun = this.runs.get(runId);

        if (inMemoryRun) {
          return inMemoryRun;
        }

        throw new NotFoundException(`Unknown run: ${runId}`);
      }

      this.runRecords.set(runId, this.toPersistedRunRecord(persisted));

      const storedRun = this.runs.get(runId);

      if (storedRun) {
        storedRun.definition = persisted.definition;
        storedRun.status = persisted.status;
        storedRun.assignments = persisted.assignments ?? [];
        storedRun.summaries = persisted.summaries ?? [];
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

    if (this.controlRepository) {
      await this.controlRepository.saveAssignments(runId, assignments);
    }

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

    if (this.controlRepository) {
      await this.controlRepository.saveSummary(runId, summary);
    }

    await this.updateRunStatus(runId, run.status);
    return run;
  }

  async updateRunStatus(runId: string, status: RunStatus): Promise<void> {
    const run = this.runs.get(runId);

    if (run) {
      run.status = status;
    }

    const record = this.runRecords.get(runId);

    if (record) {
      this.runRecords.set(runId, {
        ...record,
        status,
        updatedAt: new Date().toISOString(),
      });
    }

    if (!this.controlRepository) {
      return;
    }

    const persistedRecord = await this.controlRepository.updateRunStatus(runId, status);
    this.runRecords.set(runId, persistedRecord);
  }

  async startRun(runId: string): Promise<StoredRun> {
    const run = await this.getRun(runId);

    if (run.status === 'RUNNING') {
      return run;
    }

    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
      throw new BadRequestException(
        `Run ${runId} cannot be started from status ${run.status}.`,
      );
    }

    if (run.assignments.length === 0) {
      throw new BadRequestException(
        `Run ${runId} must be planned before it can be started.`,
      );
    }

    await this.updateRunStatus(runId, 'RUNNING');
    run.status = 'RUNNING';
    return run;
  }

  async stopRun(runId: string): Promise<StoredRun> {
    const run = await this.getRun(runId);

    if (run.status === 'STOPPING' || run.status === 'STOPPED') {
      return run;
    }

    if (run.status === 'DRAFT') {
      throw new BadRequestException(
        `Run ${runId} must be started before it can be stopped.`,
      );
    }

    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
      return run;
    }

    await this.updateRunStatus(runId, 'STOPPING');
    run.status = 'STOPPING';
    return run;
  }

  private async persistRunDraft(draft: ControlRunDraft): Promise<void> {
    if (!this.controlRepository) {
      return;
    }

    await this.controlRepository.createRunDraft(draft);
  }

  private toStoredRun(run: PersistedStoredRun): StoredRun {
    return {
      definition: run.definition,
      status: run.status,
      assignments: run.assignments ?? [],
      summaries: run.summaries ?? [],
    };
  }

  private toRunRecord(draft: ControlRunDraft): ControlRunRecord {
    const now = new Date().toISOString();

    return {
      id: draft.id,
      templateId: draft.templateId,
      nodePoolId: draft.nodePoolId,
      mode: draft.definition.mode,
      targetBaseUrl: draft.definition.targetBaseUrl,
      status: 'DRAFT',
      tags: draft.definition.tags,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toPersistedRunRecord(run: PersistedStoredRun): ControlRunRecord {
    return {
      id: run.id,
      templateId: run.templateId,
      nodePoolId: run.nodePoolId,
      mode: run.mode,
      targetBaseUrl: run.targetBaseUrl,
      status: run.status,
      tags: run.tags,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  private toLegacyRunRecord(run: StoredRun): ControlRunRecord {
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

  private isControlRunDraft(
    input: ControlRunDraft | LoadTestRunDefinition,
  ): input is ControlRunDraft {
    return 'definition' in input;
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

  private cloneCatalog<T>(entries: readonly T[]): T[] {
    return [...structuredClone(entries)];
  }

  private mergeCatalog<T extends { id: string; name: string }>(
    seeded: readonly T[],
    persisted: readonly T[],
  ): T[] {
    const catalog = new Map<string, T>();

    for (const entry of seeded) {
      catalog.set(entry.id, structuredClone(entry));
    }

    for (const entry of persisted) {
      catalog.set(entry.id, structuredClone(entry));
    }

    return [...catalog.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }
}
