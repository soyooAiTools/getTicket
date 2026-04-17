import { Injectable } from '@nestjs/common';

import {
  type LoadTestRunDefinition,
  type NodeRegistration,
  type PlannedNodeAssignment,
  type ScenarioPhase,
} from '@ticketing/contracts';

type PhasePoolKey =
  | 'queryConcurrency'
  | 'queuePollingConcurrency'
  | 'inventoryLockConcurrency'
  | 'orderSubmissionConcurrency';

const phasePoolKeys: PhasePoolKey[] = [
  'queryConcurrency',
  'queuePollingConcurrency',
  'inventoryLockConcurrency',
  'orderSubmissionConcurrency',
];

@Injectable()
export class ScenarioEngineService {
  planRun(
    run: LoadTestRunDefinition,
    nodes: NodeRegistration[],
  ): PlannedNodeAssignment[] {
    const nodeCaps = nodes.map((node) =>
      Math.min(node.maxConcurrency, run.maxNodeConcurrency),
    );
    const plannedPhasesByNode = run.phases.map((phase) =>
      this.planPhaseAssignments(phase, nodeCaps, run.maxGlobalQps),
    );

    return nodes.map((node, nodeIndex) => ({
      runId: run.id,
      nodeId: node.id,
      region: node.region,
      role: node.role,
      mode: run.mode,
      targetBaseUrl: run.targetBaseUrl,
      networkProfile: node.networkProfile,
      requestTemplates: run.requestTemplates,
      phases: plannedPhasesByNode.map(
        (plannedPhaseAssignments) => plannedPhaseAssignments[nodeIndex],
      ),
      tags: run.tags,
    }));
  }

  private planPhaseAssignments(
    phase: ScenarioPhase,
    nodeCaps: number[],
    maxGlobalQps: number,
  ): ScenarioPhase[] {
    const phasePoolBudgets = phasePoolKeys.map((key) => phase[key]);
    const phaseBudget = Math.min(
      this.totalPoolConcurrency(phasePoolBudgets),
      maxGlobalQps,
      this.totalPoolConcurrency(nodeCaps),
    );
    const nodeBudgets = this.allocateProportionally(nodeCaps, phaseBudget);
    const globalPoolBudgets = this.allocateProportionally(
      phasePoolBudgets,
      phaseBudget,
    );
    const remainingNodeBudgets = [...nodeBudgets];
    const nodePoolBudgets = nodeCaps.map(() => ({
      queryConcurrency: 0,
      queuePollingConcurrency: 0,
      inventoryLockConcurrency: 0,
      orderSubmissionConcurrency: 0,
    }));

    phasePoolKeys.forEach((poolKey, poolIndex) => {
      const poolAssignments = this.allocateProportionally(
        remainingNodeBudgets,
        globalPoolBudgets[poolIndex],
      );

      poolAssignments.forEach((assignment, nodeIndex) => {
        nodePoolBudgets[nodeIndex][poolKey] = assignment;
        remainingNodeBudgets[nodeIndex] -= assignment;
      });
    });

    return nodePoolBudgets.map((nodePhase) => ({
      ...phase,
      ...nodePhase,
    }));
  }

  private allocateProportionally(
    weights: number[],
    budget: number,
  ): number[] {
    const total = this.totalPoolConcurrency(weights);

    if (budget <= 0 || total <= 0) {
      return weights.map(() => 0);
    }

    if (budget >= total) {
      return [...weights];
    }

    const scaled = weights.map((weight, index) => ({
      index,
      scaled: (weight * budget) / total,
    }));
    const allocated = scaled.map((entry) => Math.floor(entry.scaled));
    let remainder = budget - this.totalPoolConcurrency(allocated);

    const ranked = scaled
      .map((entry, index) => ({
        index,
        fraction: entry.scaled - allocated[index],
      }))
      .sort((left, right) => {
        if (right.fraction !== left.fraction) {
          return right.fraction - left.fraction;
        }

        return left.index - right.index;
      });

    for (const { index } of ranked) {
      if (remainder <= 0) {
        break;
      }

      allocated[index] += 1;
      remainder -= 1;
    }

    return allocated;
  }

  private totalPoolConcurrency(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0);
  }
}
