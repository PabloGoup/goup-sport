import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

type Competition = {
  competition_id: number;
  season_id: number;
  competition_name: string;
  season_name: string;
  country_name: string;
};

const defaultTargets = [
  "43/106", // FIFA World Cup 2022
  "43/3", // FIFA World Cup 2018
  "55/282", // UEFA Euro 2024
  "223/282", // Copa America 2024
  "16/4", // Champions League 2018/2019
  "11/90", // La Liga 2020/2021
  "9/281", // Bundesliga 2023/2024
  "7/235", // Ligue 1 2022/2023
  "44/107", // MLS 2023
  "2/27", // Premier League 2015/2016
];

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function parseTargets(value?: string) {
  return (value ? value.split(",") : defaultTargets)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [competition, season] = item.split("/");
      if (!competition || !season) throw new Error(`Invalid target "${item}". Use competition/season.`);
      return { competition, season, key: item };
    });
}

async function main() {
  const repoRoot = path.resolve(process.cwd(), readArg("repo") ?? "data-providers/statsbomb-open-data");
  const competitionsPath = path.join(repoRoot, "data/competitions.json");
  const targets = parseTargets(readArg("targets"));
  const skipFeatures = readArg("skip-features") === "true";
  const limit = readArg("limit");

  if (!existsSync(competitionsPath)) {
    throw new Error(`StatsBomb competitions file not found: ${competitionsPath}`);
  }

  const competitions = JSON.parse(await readFile(competitionsPath, "utf8")) as Competition[];
  const known = new Map(competitions.map((item) => [`${item.competition_id}/${item.season_id}`, item]));

  for (const target of targets) {
    const metadata = known.get(target.key);
    if (!metadata) {
      console.warn(`[statsbomb:batch] Skipping unknown target ${target.key}`);
      continue;
    }

    console.log(
      `[statsbomb:batch] Importing ${target.key} ${metadata.competition_name} ${metadata.season_name}`,
    );

    const ingestArgs = [
      "tsx",
      "scripts/ingest-statsbomb-open-data.ts",
      `--competition=${target.competition}`,
      `--season=${target.season}`,
    ];
    if (limit) ingestArgs.push(`--limit=${limit}`);

    await run("npx", ingestArgs);

    if (!skipFeatures) {
      await run("npx", [
        "tsx",
        "scripts/extract-statsbomb-football-features.ts",
        `--competition=${target.competition}`,
        `--season=${target.season}`,
      ]);
    }
  }

  console.log("[statsbomb:batch] Completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
