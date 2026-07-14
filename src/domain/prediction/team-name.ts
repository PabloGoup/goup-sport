import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Nombre canonico de equipo para enlazar datos entre proveedores.
 * Aplica: minusculas, sin acentos, elimina sufijos de pais "(BEL)", anios
 * "1907", tokens de tipo de club (fc, sc, calcio...) y, por ultimo, un
 * diccionario de alias curados. Dos nombres del mismo club convergen aqui.
 */

// Tokens de tipo de club que se eliminan (como palabra suelta).
const CLUB_TOKENS = new Set([
  "fc", "cf", "sc", "afc", "cfc", "ac", "calcio", "kv", "sk", "fk", "if",
  "sad", "cd", "ca", "ec", "se", "aa", "bc",
]);

function baseNormalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([a-z]{2,4}\)/g, " ") // sufijos de pais tipo "(bel)"
    .replace(/\b\d{4}\b/g, " ") // anios de fundacion "1907"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripClubTokens(normalized: string): string {
  const tokens = normalized.split(" ").filter((t) => t && !CLUB_TOKENS.has(t));
  // No dejar el nombre vacio (equipo cuyo unico token es tipo-club).
  return tokens.length > 0 ? tokens.join(" ") : normalized;
}

let aliasMap: Record<string, string> | null = null;

function loadAliases(): Record<string, string> {
  if (aliasMap) return aliasMap;
  try {
    const file = path.join(process.cwd(), "data", "team-aliases.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { aliases?: Record<string, string> };
    aliasMap = parsed.aliases ?? {};
  } catch {
    aliasMap = {};
  }
  return aliasMap;
}

export function canonicalTeamName(name: string): string {
  const stripped = stripClubTokens(baseNormalize(name));
  const aliases = loadAliases();
  // El alias puede aplicarse antes o despues de quitar tokens de club.
  return aliases[stripped] ?? aliases[baseNormalize(name)] ?? stripped;
}

/** Solo para pruebas: permite inyectar alias sin leer el archivo. */
export function __setAliasesForTest(map: Record<string, string> | null) {
  aliasMap = map;
}
