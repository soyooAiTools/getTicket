-- CreateEnum
CREATE TYPE "ValidationMode" AS ENUM ('PREPROD', 'OBSERVE_ONLY', 'WHITELIST_FULL_PATH', 'GRAY_VALIDATION');

-- CreateEnum
CREATE TYPE "NodeRole" AS ENUM ('ANCHOR', 'EDGE', 'CONTROL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('DRAFT', 'PLANNED', 'RUNNING', 'STOPPING', 'STOPPED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NodeHealthStatus" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE', 'BUSY');

-- CreateTable
CREATE TABLE "NodePool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "role" "NodeRole" NOT NULL,
    "status" "NodeHealthStatus" NOT NULL,
    "maxConcurrency" INTEGER NOT NULL,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "activeNodeCount" INTEGER NOT NULL DEFAULT 0,
    "labels" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadControlNode" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "role" "NodeRole" NOT NULL,
    "healthStatus" "NodeHealthStatus" NOT NULL,
    "maxConcurrency" INTEGER NOT NULL,
    "networkProfile" JSONB,
    "labels" JSONB NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadControlNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadControlRun" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nodePoolId" TEXT NOT NULL,
    "mode" "ValidationMode" NOT NULL,
    "targetBaseUrl" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadControlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadControlAssignment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "phasePlan" JSONB NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadControlAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadControlSummary" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadControlSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadControlTelemetrySample" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "phaseId" TEXT,
    "status" "NodeHealthStatus" NOT NULL,
    "qps" DOUBLE PRECISION NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "p95LatencyMs" INTEGER NOT NULL,
    "activeWorkers" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadControlTelemetrySample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoadControlNode_poolId_healthStatus_idx" ON "LoadControlNode"("poolId", "healthStatus");

-- CreateIndex
CREATE INDEX "LoadControlNode_region_role_idx" ON "LoadControlNode"("region", "role");

-- CreateIndex
CREATE INDEX "LoadControlRun_templateId_status_idx" ON "LoadControlRun"("templateId", "status");

-- CreateIndex
CREATE INDEX "LoadControlRun_nodePoolId_status_idx" ON "LoadControlRun"("nodePoolId", "status");

-- CreateIndex
CREATE INDEX "LoadControlAssignment_runId_assignedAt_idx" ON "LoadControlAssignment"("runId", "assignedAt");

-- CreateIndex
CREATE INDEX "LoadControlAssignment_poolId_assignedAt_idx" ON "LoadControlAssignment"("poolId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoadControlAssignment_runId_nodeId_key" ON "LoadControlAssignment"("runId", "nodeId");

-- CreateIndex
CREATE INDEX "LoadControlSummary_runId_reportedAt_idx" ON "LoadControlSummary"("runId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoadControlSummary_runId_nodeId_key" ON "LoadControlSummary"("runId", "nodeId");

-- CreateIndex
CREATE INDEX "LoadControlTelemetrySample_runId_recordedAt_idx" ON "LoadControlTelemetrySample"("runId", "recordedAt");

-- CreateIndex
CREATE INDEX "LoadControlTelemetrySample_nodeId_recordedAt_idx" ON "LoadControlTelemetrySample"("nodeId", "recordedAt");

-- CreateIndex
CREATE INDEX "LoadControlTelemetrySample_phaseId_recordedAt_idx" ON "LoadControlTelemetrySample"("phaseId", "recordedAt");

-- AddForeignKey
ALTER TABLE "LoadControlNode" ADD CONSTRAINT "LoadControlNode_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "NodePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlRun" ADD CONSTRAINT "LoadControlRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScenarioTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlRun" ADD CONSTRAINT "LoadControlRun_nodePoolId_fkey" FOREIGN KEY ("nodePoolId") REFERENCES "NodePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlAssignment" ADD CONSTRAINT "LoadControlAssignment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoadControlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlAssignment" ADD CONSTRAINT "LoadControlAssignment_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "LoadControlNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlAssignment" ADD CONSTRAINT "LoadControlAssignment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "NodePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlSummary" ADD CONSTRAINT "LoadControlSummary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoadControlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlSummary" ADD CONSTRAINT "LoadControlSummary_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "LoadControlNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlTelemetrySample" ADD CONSTRAINT "LoadControlTelemetrySample_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoadControlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadControlTelemetrySample" ADD CONSTRAINT "LoadControlTelemetrySample_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "LoadControlNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
