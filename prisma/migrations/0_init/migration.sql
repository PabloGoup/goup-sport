-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('live', 'today', 'upcoming', 'completed', 'postponed');

-- CreateEnum
CREATE TYPE "public"."ParticipantType" AS ENUM ('team', 'player');

-- CreateEnum
CREATE TYPE "public"."PredictionFactorDirection" AS ENUM ('positive', 'negative', 'neutral');

-- CreateEnum
CREATE TYPE "public"."SportCode" AS ENUM ('football', 'basketball', 'tennis');

-- CreateTable
CREATE TABLE "public"."DataSource" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "normalizedVersion" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sportId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."EventStatus" NOT NULL,
    "statusLabel" TEXT,
    "round" TEXT,
    "season" INTEGER,
    "homeId" TEXT NOT NULL,
    "awayId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "dataSourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "externalId" TEXT,
    "season" INTEGER,
    "logoUrl" TEXT,
    "sportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModelVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sportId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NewsItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "sportId" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" TEXT NOT NULL,
    "type" "public"."ParticipantType" NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "country" TEXT,
    "logoUrl" TEXT,
    "position" TEXT,
    "age" INTEGER,
    "nationality" TEXT,
    "recentForm" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Prediction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "predictedOutcome" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PredictionCaveat" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionCaveat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PredictionFactor" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "direction" "public"."PredictionFactorDirection" NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderIngestionLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "results" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "ProviderIngestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sport" (
    "id" TEXT NOT NULL,
    "code" "public"."SportCode" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamAggregateMetric" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamAggregateMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamMatchMetric" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatchMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_confidence_idx" ON "public"."Event"("confidence" ASC);

-- CreateIndex
CREATE INDEX "Event_externalId_idx" ON "public"."Event"("externalId" ASC);

-- CreateIndex
CREATE INDEX "Event_leagueId_idx" ON "public"."Event"("leagueId" ASC);

-- CreateIndex
CREATE INDEX "Event_sportId_idx" ON "public"."Event"("sportId" ASC);

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "public"."Event"("startsAt" ASC);

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "public"."Event"("status" ASC);

-- CreateIndex
CREATE INDEX "League_sportId_idx" ON "public"."League"("sportId" ASC);

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_idx" ON "public"."NewsItem"("publishedAt" ASC);

-- CreateIndex
CREATE INDEX "NewsItem_sportId_idx" ON "public"."NewsItem"("sportId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_slug_key" ON "public"."Participant"("slug" ASC);

-- CreateIndex
CREATE INDEX "Participant_sportId_idx" ON "public"."Participant"("sportId" ASC);

-- CreateIndex
CREATE INDEX "Participant_type_idx" ON "public"."Participant"("type" ASC);

-- CreateIndex
CREATE INDEX "Prediction_confidence_idx" ON "public"."Prediction"("confidence" ASC);

-- CreateIndex
CREATE INDEX "Prediction_eventId_idx" ON "public"."Prediction"("eventId" ASC);

-- CreateIndex
CREATE INDEX "Prediction_generatedAt_idx" ON "public"."Prediction"("generatedAt" ASC);

-- CreateIndex
CREATE INDEX "PredictionCaveat_predictionId_idx" ON "public"."PredictionCaveat"("predictionId" ASC);

-- CreateIndex
CREATE INDEX "PredictionFactor_predictionId_idx" ON "public"."PredictionFactor"("predictionId" ASC);

-- CreateIndex
CREATE INDEX "ProviderIngestionLog_provider_idx" ON "public"."ProviderIngestionLog"("provider" ASC);

-- CreateIndex
CREATE INDEX "ProviderIngestionLog_requestedAt_idx" ON "public"."ProviderIngestionLog"("requestedAt" ASC);

-- CreateIndex
CREATE INDEX "ProviderIngestionLog_resource_idx" ON "public"."ProviderIngestionLog"("resource" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Sport_code_key" ON "public"."Sport"("code" ASC);

-- CreateIndex
CREATE INDEX "TeamAggregateMetric_metricKey_idx" ON "public"."TeamAggregateMetric"("metricKey" ASC);

-- CreateIndex
CREATE INDEX "TeamAggregateMetric_participantId_idx" ON "public"."TeamAggregateMetric"("participantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeamAggregateMetric_participantId_scope_metricKey_source_ve_key" ON "public"."TeamAggregateMetric"("participantId" ASC, "scope" ASC, "metricKey" ASC, "source" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "TeamAggregateMetric_scope_idx" ON "public"."TeamAggregateMetric"("scope" ASC);

-- CreateIndex
CREATE INDEX "TeamAggregateMetric_sportId_idx" ON "public"."TeamAggregateMetric"("sportId" ASC);

-- CreateIndex
CREATE INDEX "TeamMatchMetric_eventId_idx" ON "public"."TeamMatchMetric"("eventId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchMetric_eventId_participantId_metricKey_source_vers_key" ON "public"."TeamMatchMetric"("eventId" ASC, "participantId" ASC, "metricKey" ASC, "source" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "TeamMatchMetric_metricKey_idx" ON "public"."TeamMatchMetric"("metricKey" ASC);

-- CreateIndex
CREATE INDEX "TeamMatchMetric_participantId_idx" ON "public"."TeamMatchMetric"("participantId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_awayId_fkey" FOREIGN KEY ("awayId") REFERENCES "public"."Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "public"."Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."League" ADD CONSTRAINT "League_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewsItem" ADD CONSTRAINT "NewsItem_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prediction" ADD CONSTRAINT "Prediction_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prediction" ADD CONSTRAINT "Prediction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prediction" ADD CONSTRAINT "Prediction_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "public"."ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PredictionCaveat" ADD CONSTRAINT "PredictionCaveat_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "public"."Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PredictionFactor" ADD CONSTRAINT "PredictionFactor_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "public"."Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamAggregateMetric" ADD CONSTRAINT "TeamAggregateMetric_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamAggregateMetric" ADD CONSTRAINT "TeamAggregateMetric_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMatchMetric" ADD CONSTRAINT "TeamMatchMetric_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMatchMetric" ADD CONSTRAINT "TeamMatchMetric_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

