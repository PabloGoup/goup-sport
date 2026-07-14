import { afterEach, describe, expect, it } from "vitest";
import { canonicalTeamName, __setAliasesForTest } from "@/domain/prediction/team-name";

afterEach(() => __setAliasesForTest(null));

describe("canonicalTeamName", () => {
  it("normaliza acentos y mayusculas", () => {
    __setAliasesForTest({});
    expect(canonicalTeamName("O'Higgins")).toBe(canonicalTeamName("O Higgins"));
    expect(canonicalTeamName("Coquimbo Unido")).toBe("coquimbo unido");
  });

  it("elimina sufijos de pais (BEL)/(FRA)", () => {
    __setAliasesForTest({});
    expect(canonicalTeamName("Club Brugge KV (BEL)")).toBe(canonicalTeamName("Club Brugge"));
    expect(canonicalTeamName("Olympique de Marseille (FRA)")).toBe("olympique de marseille");
  });

  it("elimina anios de fundacion y tokens de tipo de club", () => {
    __setAliasesForTest({});
    expect(canonicalTeamName("Como 1907")).toBe("como");
    expect(canonicalTeamName("Udinese Calcio")).toBe("udinese");
    expect(canonicalTeamName("Mushuc Runa SC")).toBe("mushuc runa");
    expect(canonicalTeamName("CA Atlas")).toBe("atlas");
  });

  it("aplica alias curados en ambas direcciones de comparacion", () => {
    __setAliasesForTest({ "everton de vina del mar": "everton de vina" });
    expect(canonicalTeamName("Everton de Viña del Mar")).toBe(canonicalTeamName("Everton de Vina"));
  });

  it("no vacia el nombre si solo tiene tokens de club", () => {
    __setAliasesForTest({});
    expect(canonicalTeamName("FC").length).toBeGreaterThan(0);
  });

  it("no colapsa equipos distintos", () => {
    __setAliasesForTest({});
    expect(canonicalTeamName("San Martin de Tucuman")).not.toBe(canonicalTeamName("San Lorenzo"));
    expect(canonicalTeamName("New Mexico United")).not.toBe(canonicalTeamName("Manchester United"));
  });
});
