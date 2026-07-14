import { PrismaClient, PredictionFactorDirection } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { events, news, predictions } from "../src/domain/sports-intelligence/mock-data";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const sportNames = {
  football: "Futbol",
  basketball: "Basketball",
  tennis: "Tenis",
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedSports() {
  for (const event of events) {
    await prisma.sport.upsert({
      where: { id: `sport-${event.sport}` },
      update: {
        name: sportNames[event.sport],
      },
      create: {
        id: `sport-${event.sport}`,
        code: event.sport,
        name: sportNames[event.sport],
      },
    });
  }
}

async function seedLeagues() {
  const uniqueLeagues = new Map(events.map((event) => [`${event.sport}:${event.league}`, event]));

  for (const event of uniqueLeagues.values()) {
    await prisma.league.upsert({
      where: { id: `league-${event.sport}-${slugify(event.league)}` },
      update: {
        name: event.league,
      },
      create: {
        id: `league-${event.sport}-${slugify(event.league)}`,
        name: event.league,
        sportId: `sport-${event.sport}`,
      },
    });
  }
}

async function seedParticipants() {
  const participants = events.flatMap((event) => [
    { sport: event.sport, participant: event.home },
    { sport: event.sport, participant: event.away },
  ]);

  for (const { sport, participant } of participants) {
    await prisma.participant.upsert({
      where: { id: participant.id },
      update: {
        name: participant.name,
        shortName: participant.shortName,
        recentForm: participant.form,
      },
      create: {
        id: participant.id,
        type: participant.id.startsWith("player-") ? "player" : "team",
        name: participant.name,
        shortName: participant.shortName,
        slug: slugify(participant.name),
        sportId: `sport-${sport}`,
        recentForm: participant.form,
      },
    });
  }
}

async function seedDataSources() {
  const sources = new Map(events.map((event) => [event.source.id, event.source]));

  for (const source of sources.values()) {
    await prisma.dataSource.upsert({
      where: { id: source.id },
      update: {
        provider: source.provider,
        collectedAt: new Date(source.collectedAt),
        normalizedVersion: source.normalizedVersion,
      },
      create: {
        id: source.id,
        provider: source.provider,
        collectedAt: new Date(source.collectedAt),
        normalizedVersion: source.normalizedVersion,
      },
    });
  }
}

async function seedModelVersions() {
  const modelVersions = new Set(events.map((event) => event.modelVersion));

  for (const modelVersion of modelVersions) {
    await prisma.modelVersion.upsert({
      where: { id: modelVersion },
      update: {
        name: modelVersion,
        version: modelVersion.split("-").at(-1) ?? modelVersion,
      },
      create: {
        id: modelVersion,
        name: modelVersion,
        version: modelVersion.split("-").at(-1) ?? modelVersion,
      },
    });
  }
}

async function seedEvents() {
  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        startsAt: new Date(event.startsAt),
        status: event.status,
        venue: event.venue,
        confidence: event.confidence,
      },
      create: {
        id: event.id,
        sportId: `sport-${event.sport}`,
        leagueId: `league-${event.sport}-${slugify(event.league)}`,
        startsAt: new Date(event.startsAt),
        status: event.status,
        homeId: event.home.id,
        awayId: event.away.id,
        venue: event.venue,
        confidence: event.confidence,
        dataSourceId: event.source.id,
      },
    });
  }
}

async function seedPredictions() {
  for (const prediction of predictions) {
    const event = events.find((item) => item.id === prediction.eventId);
    if (!event) continue;

    await prisma.prediction.upsert({
      where: { id: `prediction-${prediction.eventId}` },
      update: {
        predictedOutcome: prediction.predictedOutcome,
        confidence: prediction.confidence,
        probability: prediction.probability,
        generatedAt: new Date(prediction.generatedAt),
      },
      create: {
        id: `prediction-${prediction.eventId}`,
        eventId: prediction.eventId,
        predictedOutcome: prediction.predictedOutcome,
        confidence: prediction.confidence,
        probability: prediction.probability,
        generatedAt: new Date(prediction.generatedAt),
        modelVersionId: prediction.modelVersion,
        dataSourceId: event.source.id,
      },
    });

    await prisma.predictionFactor.deleteMany({
      where: { predictionId: `prediction-${prediction.eventId}` },
    });

    await prisma.predictionCaveat.deleteMany({
      where: { predictionId: `prediction-${prediction.eventId}` },
    });

    for (const [index, factor] of prediction.factors.entries()) {
      await prisma.predictionFactor.create({
        data: {
          id: `factor-${prediction.eventId}-${index}`,
          predictionId: `prediction-${prediction.eventId}`,
          label: factor.label,
          impact: factor.impact,
          direction:
            factor.impact > 0
              ? PredictionFactorDirection.positive
              : factor.impact < 0
                ? PredictionFactorDirection.negative
                : PredictionFactorDirection.neutral,
          explanation: factor.explanation,
        },
      });
    }

    for (const [index, caveat] of prediction.caveats.entries()) {
      await prisma.predictionCaveat.create({
        data: {
          id: `caveat-${prediction.eventId}-${index}`,
          predictionId: `prediction-${prediction.eventId}`,
          text: caveat,
        },
      });
    }
  }
}

async function seedNews() {
  for (const item of news) {
    await prisma.newsItem.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        source: item.source,
        publishedAt: new Date(item.publishedAt),
      },
      create: {
        id: item.id,
        title: item.title,
        source: item.source,
        publishedAt: new Date(item.publishedAt),
        sportId: `sport-${item.sport}`,
      },
    });
  }
}

async function main() {
  await seedSports();
  await seedLeagues();
  await seedParticipants();
  await seedDataSources();
  await seedModelVersions();
  await seedEvents();
  await seedPredictions();
  await seedNews();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
