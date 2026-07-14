import { PageShell, SectionHeader } from "@/components/sports-shell/ui";

export default function DashboardsPage() {
  return (
    <PageShell active="/dashboards">
      <div className="p-3 sm:p-5">
        <SectionHeader
          eyebrow="Dashboards"
          title="Experiencias por segmento"
          description="Cada publico necesita una vista distinta. Separar dashboards desde temprano evita que la plataforma se convierta en una sola pantalla imposible de mantener."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Periodistas", "Contexto rapido, tendencias, fuentes y explicaciones listas para pauta."],
            ["Streamers", "Cruces destacados, narrativa en vivo y comparaciones faciles de leer."],
            ["Clubes", "Rendimiento, scouting, alertas de forma y tracking por modelo."],
            ["Academias", "Seguimiento de desarrollo, historial y benchmarks por categoria."],
            ["Fantasy", "Proyecciones por jugador, disponibilidad y variacion de confianza."],
            ["Empresas", "API, reportes, dashboards privados y auditoria de modelos."],
          ].map(([segment, description]) => (
            <article key={segment} className="rounded-xl border border-[#dfe1e8] bg-white p-4 shadow-sm">
              <p className="text-xl font-black text-[#202128]">{segment}</p>
              <p className="mt-3 text-sm leading-6 text-[#6f717c]">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
