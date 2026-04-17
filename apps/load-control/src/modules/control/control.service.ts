import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type LoadTestRunDefinition,
  type NodeRegistration,
  type NodeRunSummary,
  type PlannedNodeAssignment,
} from '@ticketing/contracts';

import { ScenarioEngineService } from '../scenarios/scenario-engine.service';
import { ValidationPolicyService } from '../validation/validation-policy.service';

export type StoredRun = {
  definition: LoadTestRunDefinition;
  status: 'DRAFT' | 'PLANNED' | 'COMPLETED';
  assignments: PlannedNodeAssignment[];
  summaries: NodeRunSummary[];
};

@Injectable()
export class ControlService {
  constructor(
    private readonly scenarioEngineService: ScenarioEngineService = new ScenarioEngineService(),
    private readonly validationPolicy: ValidationPolicyService = new ValidationPolicyService(),
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

  createRun(definition: LoadTestRunDefinition): StoredRun {
    const run: StoredRun = {
      definition,
      status: 'DRAFT',
      assignments: [],
      summaries: [],
    };

    this.runs.set(definition.id, run);
    return run;
  }

  planRun(runId: string): StoredRun {
    const run = this.getRun(runId);
    this.validationPolicy.assertAllowed(run.definition);
    const assignments = this.scenarioEngineService.planRun(
      run.definition,
      this.listNodes(),
    );

    return this.storeAssignments(runId, assignments);
  }

  getRun(runId: string): StoredRun {
    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Unknown run: ${runId}`);
    }

    return run;
  }

  storeAssignments(
    runId: string,
    assignments: PlannedNodeAssignment[],
  ): StoredRun {
    const run = this.getRun(runId);
    run.assignments = assignments;
    run.status = 'PLANNED';
    return run;
  }

  recordSummary(runId: string, summary: NodeRunSummary): StoredRun {
    const run = this.getRun(runId);
    this.assertSummaryMatchesAssignment(run, summary);

    const nextSummaries = run.summaries.filter(
      (entry) => entry.nodeId !== summary.nodeId,
    );

    nextSummaries.push(summary);
    run.summaries = nextSummaries;
    run.status = this.hasCollectedAllSummaries(run) ? 'COMPLETED' : 'PLANNED';
    return run;
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
