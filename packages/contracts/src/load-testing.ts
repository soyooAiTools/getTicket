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
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const nodeHealthStatusSchema = z.enum([
  'UNKNOWN',
  'HEALTHY',
  'DEGRADED',
  'UNHEALTHY',
  'OFFLINE',
]);

export const scenarioTemplateStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]);

export const scenarioTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional(),
    status: scenarioTemplateStatusSchema,
    targetBaseUrl: z.string().url(),
    nodePoolId: z.string().min(1),
    tags: z.record(z.string(), z.string()),
    requestTemplates: requestTemplatesSchema,
    phases: z.array(scenarioPhaseSchema).min(1),
  })
  .strict();

export const nodePoolSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1),
    role: nodeRoleSchema,
    status: nodeHealthStatusSchema,
    maxConcurrency: z.number().int().positive(),
    nodeCount: z.number().int().nonnegative(),
    activeNodeCount: z.number().int().nonnegative(),
    networkProfile: networkProfileSchema.optional(),
    labels: z.record(z.string(), z.string()),
  })
  .strict();

export const controlRunDraftSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    nodePoolId: z.string().min(1),
    status: runStatusSchema,
    requestedBy: z.string().min(1),
    requestedAt: z.string().datetime(),
    tags: z.record(z.string(), z.string()),
  })
  .strict();

export const controlRunRecordSchema = controlRunDraftSchema
  .extend({
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict();

export const nodeTelemetrySampleSchema = z
  .object({
    runId: z.string().min(1),
    nodeId: z.string().min(1),
    poolId: z.string().min(1),
    capturedAt: z.string().datetime(),
    status: nodeHealthStatusSchema,
    qps: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    p50LatencyMs: z.number().nonnegative(),
    p95LatencyMs: z.number().nonnegative(),
    activeRequests: z.number().int().nonnegative(),
  })
  .strict();

export const liveRunSnapshotSchema = z
  .object({
    run: controlRunRecordSchema,
    nodePool: nodePoolSchema,
    telemetrySamples: z.array(nodeTelemetrySampleSchema),
    capturedAt: z.string().datetime(),
    currentPhaseId: z.string().min(1),
    activeNodeCount: z.number().int().nonnegative(),
    unhealthyNodeCount: z.number().int().nonnegative(),
    aggregateQps: z.number().nonnegative(),
    aggregateErrorRate: z.number().min(0).max(1),
    aggregateP50LatencyMs: z.number().nonnegative(),
    aggregateP95LatencyMs: z.number().nonnegative(),
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
export type LoadTestRunDefinition = z.infer<typeof loadTestRunDefinitionSchema>;
export type PlannedNodeAssignment = z.infer<typeof plannedNodeAssignmentSchema>;
export type PhaseSummary = z.infer<typeof phaseSummarySchema>;
export type NodeRunSummary = z.infer<typeof nodeRunSummarySchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type NodeHealthStatus = z.infer<typeof nodeHealthStatusSchema>;
export type ScenarioTemplateStatus = z.infer<
  typeof scenarioTemplateStatusSchema
>;
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
