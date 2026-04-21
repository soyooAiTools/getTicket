import { z } from 'zod';

export const validationModeSchema = z.enum([
  'PREPROD',
  'OBSERVE_ONLY',
  'WHITELIST_FULL_PATH',
  'GRAY_VALIDATION',
]);

export const nodeRoleSchema = z.enum(['ANCHOR', 'EDGE', 'CONTROL']);

export const httpMethodSchema = z.enum(['GET', 'POST']);

export const requestTemplateSchema = z
  .object({
    method: httpMethodSchema,
    path: z.string().startsWith('/'),
    timeoutMs: z.number().int().positive(),
  })
  .strict();

export const scenarioPhaseSchema = z
  .object({
    id: z.string().min(1),
    startsAtOffsetMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    queryConcurrency: z.number().int().nonnegative(),
    queuePollingConcurrency: z.number().int().nonnegative(),
    inventoryLockConcurrency: z.number().int().nonnegative(),
    orderSubmissionConcurrency: z.number().int().nonnegative(),
  })
  .strict();

export const networkProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    baseLatencyMs: z.number().int().nonnegative(),
    jitterMs: z.number().int().nonnegative(),
    packetLossRatio: z.number().min(0).max(1),
  })
  .strict();

export const nodeRegistrationSchema = z
  .object({
    id: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    networkProfile: networkProfileSchema,
    maxConcurrency: z.number().int().positive(),
  })
  .strict();

export const ticketTaskLaunchModeSchema = z.enum([
  'SYNC_WITH_JITTER',
  'STAGGERED',
]);

export const ticketTaskExecutionObjectiveSchema = z.enum([
  'QUEUE_ENTRY',
  'LOCK_ONLY',
  'FULL_SUBMIT',
]);

export const ticketTaskEventSchema = z
  .object({
    platform: z.string().min(1),
    eventName: z.string().min(1),
    city: z.string().min(1).optional(),
    venue: z.string().min(1).optional(),
    sessionLabel: z.string().min(1),
    saleStartsAt: z.string().datetime().optional(),
  })
  .strict();

export const ticketTaskTicketSchema = z
  .object({
    tierLabel: z.string().min(1),
    priceLabel: z.string().min(1).optional(),
    zoneLabel: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
  })
  .strict();

export const ticketTaskNodeStrategySchema = z
  .object({
    poolId: z.string().min(1),
    launchMode: ticketTaskLaunchModeSchema,
    preferredRegions: z.array(z.string().min(1)).optional(),
    expectedNodeCount: z.number().int().positive().optional(),
  })
  .strict();

export const ticketTaskExecutionStrategySchema = z
  .object({
    objective: ticketTaskExecutionObjectiveSchema,
    prewarmSeconds: z.number().int().nonnegative(),
    workerLaunchIntervalMs: z.number().int().positive().optional(),
    queuePollIntervalMs: z.number().int().positive().optional(),
    lockRetryLimit: z.number().int().nonnegative().optional(),
    orderSubmitLimit: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ticketTaskSchema = z
  .object({
    event: ticketTaskEventSchema,
    ticket: ticketTaskTicketSchema,
    nodeStrategy: ticketTaskNodeStrategySchema,
    executionStrategy: ticketTaskExecutionStrategySchema,
  })
  .strict();

const requestTemplatesSchema = z
  .object({
    query: requestTemplateSchema,
    queue: requestTemplateSchema,
    inventoryLock: requestTemplateSchema,
    orderSubmit: requestTemplateSchema,
  })
  .strict();

export const loadTestRunDefinitionSchema = z
  .object({
    id: z.string().min(1),
    mode: validationModeSchema,
    targetBaseUrl: z.string().url(),
    inventoryPoolId: z.string().min(1).optional(),
    maxGlobalQps: z.number().int().positive(),
    maxNodeConcurrency: z.number().int().positive(),
    tags: z.record(z.string(), z.string()),
    ticketTask: ticketTaskSchema.optional(),
    requestTemplates: requestTemplatesSchema,
    phases: z.array(scenarioPhaseSchema).min(1),
  })
  .strict();

export const plannedNodeAssignmentSchema = z
  .object({
    runId: z.string().min(1),
    nodeId: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    mode: validationModeSchema,
    targetBaseUrl: z.string().url(),
    networkProfile: networkProfileSchema,
    requestTemplates: requestTemplatesSchema,
    phases: z.array(scenarioPhaseSchema).min(1),
    tags: z.record(z.string(), z.string()),
  })
  .strict();

export const phaseSummarySchema = z
  .object({
    phaseId: z.string().min(1),
    requestCount: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
  })
  .strict();

export const nodeRunSummarySchema = z
  .object({
    runId: z.string().min(1),
    nodeId: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    mode: validationModeSchema,
    averageRttMs: z.number().nonnegative(),
    startupSkewMs: z.number().nonnegative(),
    phaseSummaries: z.array(phaseSummarySchema).min(1),
  })
  .strict();

export const runStatusSchema = z.enum([
  'DRAFT',
  'PLANNED',
  'RUNNING',
  'STOPPING',
  'STOPPED',
  'COMPLETED',
  'FAILED',
]);

export const nodeHealthStatusSchema = z.enum([
  'ONLINE',
  'DEGRADED',
  'OFFLINE',
  'BUSY',
]);

export const scenarioTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    definition: loadTestRunDefinitionSchema.omit({ id: true }),
  })
  .strict();

export const nodePoolSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    maxNodes: z.number().int().positive(),
    nodeIds: z.array(z.string().min(1)),
  })
  .strict();

export const controlRunDraftSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    nodePoolId: z.string().min(1),
    definition: loadTestRunDefinitionSchema,
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.id === draft.definition.id) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Run draft id must match definition.id.',
      path: ['definition', 'id'],
    });
  });

export const controlRunRecordSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    nodePoolId: z.string().min(1),
    mode: validationModeSchema,
    targetBaseUrl: z.string().url(),
    status: runStatusSchema,
    tags: z.record(z.string(), z.string()),
    ticketTask: ticketTaskSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const nodeTelemetrySampleSchema = z
  .object({
    runId: z.string().min(1),
    nodeId: z.string().min(1),
    phaseId: z.string().min(1).nullable(),
    status: nodeHealthStatusSchema,
    qps: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    p95LatencyMs: z.number().nonnegative(),
    activeWorkers: z.number().int().nonnegative(),
    recordedAt: z.string().datetime(),
  })
  .strict();

const liveRunNodeSchema = z
  .object({
    nodeId: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    status: nodeHealthStatusSchema,
    phaseId: z.string().min(1).nullable(),
    qps: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    p95LatencyMs: z.number().nonnegative(),
    activeWorkers: z.number().int().nonnegative(),
    recordedAt: z.string().datetime(),
  })
  .strict();

const liveRunAlertSchema = z
  .object({
    id: z.string().min(1),
    severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
    message: z.string().min(1),
    recordedAt: z.string().datetime(),
  })
  .strict();

export const liveRunSnapshotSchema = z
  .object({
    runId: z.string().min(1),
    status: runStatusSchema,
    currentPhaseId: z.string().min(1).nullable(),
    aggregateQps: z.number().nonnegative(),
    aggregateErrorRate: z.number().min(0).max(1),
    aggregateP95LatencyMs: z.number().nonnegative(),
    activeNodeCount: z.number().int().nonnegative(),
    unhealthyNodeCount: z.number().int().nonnegative(),
    nodes: z.array(liveRunNodeSchema),
    alerts: z.array(liveRunAlertSchema),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const calibrationRecommendationSchema = z
  .object({
    field: z.string().min(1),
    previousValue: z.number(),
    recommendedValue: z.number(),
  })
  .strict();

export const calibrationReportSchema = z
  .object({
    baselineRunId: z.string().min(1),
    productionRunId: z.string().min(1),
    realismScore: z.number().min(0).max(100),
    capacityScore: z.number().min(0).max(100),
    fairnessScore: z.number().min(0).max(100),
    controlScore: z.number().min(0).max(100),
    recommendedUpdates: z.array(calibrationRecommendationSchema).min(1),
  })
  .strict();

export type ValidationMode = z.infer<typeof validationModeSchema>;
export type NodeRole = z.infer<typeof nodeRoleSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type RequestTemplate = z.infer<typeof requestTemplateSchema>;
export type ScenarioPhase = z.infer<typeof scenarioPhaseSchema>;
export type NetworkProfile = z.infer<typeof networkProfileSchema>;
export type NodeRegistration = z.infer<typeof nodeRegistrationSchema>;
export type TicketTaskLaunchMode = z.infer<typeof ticketTaskLaunchModeSchema>;
export type TicketTaskExecutionObjective = z.infer<
  typeof ticketTaskExecutionObjectiveSchema
>;
export type TicketTaskEvent = z.infer<typeof ticketTaskEventSchema>;
export type TicketTaskTicket = z.infer<typeof ticketTaskTicketSchema>;
export type TicketTaskNodeStrategy = z.infer<
  typeof ticketTaskNodeStrategySchema
>;
export type TicketTaskExecutionStrategy = z.infer<
  typeof ticketTaskExecutionStrategySchema
>;
export type TicketTask = z.infer<typeof ticketTaskSchema>;
export type LoadTestRunDefinition = z.infer<typeof loadTestRunDefinitionSchema>;
export type PlannedNodeAssignment = z.infer<typeof plannedNodeAssignmentSchema>;
export type PhaseSummary = z.infer<typeof phaseSummarySchema>;
export type NodeRunSummary = z.infer<typeof nodeRunSummarySchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type NodeHealthStatus = z.infer<typeof nodeHealthStatusSchema>;
export type ScenarioTemplate = z.infer<typeof scenarioTemplateSchema>;
export type NodePool = z.infer<typeof nodePoolSchema>;
export type ControlRunDraft = z.infer<typeof controlRunDraftSchema>;
export type ControlRunRecord = z.infer<typeof controlRunRecordSchema>;
export type NodeTelemetrySample = z.infer<typeof nodeTelemetrySampleSchema>;
export type LiveRunSnapshot = z.infer<typeof liveRunSnapshotSchema>;
export type CalibrationRecommendation = z.infer<
  typeof calibrationRecommendationSchema
>;
export type CalibrationReport = z.infer<typeof calibrationReportSchema>;
