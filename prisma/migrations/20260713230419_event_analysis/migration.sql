-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'STALE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnalysisType" AS ENUM ('STATISTICAL', 'EXPERIMENTAL_AI', 'HYBRID');

-- CreateTable
CREATE TABLE "EventAnalysis" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "featureVersion" TEXT,
    "predictionVersion" TEXT,
    "inputHash" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "analysisType" "AnalysisType" NOT NULL DEFAULT 'EXPERIMENTAL_AI',
    "confidence" DOUBLE PRECISION,
    "dataQualityScore" DOUBLE PRECISION,
    "headline" TEXT,
    "shortSummary" TEXT,
    "detailedSummary" TEXT,
    "predictedOutcome" JSONB,
    "possibleResults" JSONB,
    "observations" JSONB,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "uncertainties" JSONB,
    "keyFactors" JSONB,
    "playerInsights" JSONB,
    "visualScores" JSONB,
    "modelLimitations" JSONB,
    "inputSnapshot" JSONB,
    "rawResponse" JSONB,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJobRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "selected" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichmentJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAnalysis_eventId_idx" ON "EventAnalysis"("eventId");

-- CreateIndex
CREATE INDEX "EventAnalysis_status_idx" ON "EventAnalysis"("status");

-- CreateIndex
CREATE INDEX "EventAnalysis_generatedAt_idx" ON "EventAnalysis"("generatedAt");

-- CreateIndex
CREATE INDEX "EventAnalysis_status_lastAttemptAt_idx" ON "EventAnalysis"("status", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventAnalysis_eventId_inputHash_promptVersion_key" ON "EventAnalysis"("eventId", "inputHash", "promptVersion");

-- CreateIndex
CREATE INDEX "EnrichmentJobRun_startedAt_idx" ON "EnrichmentJobRun"("startedAt");

-- AddForeignKey
ALTER TABLE "EventAnalysis" ADD CONSTRAINT "EventAnalysis_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
