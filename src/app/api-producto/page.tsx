import Link from "next/link";
import { PageShell, SectionHeader } from "@/components/sports-shell/ui";

export default function ApiProductPage() {
  return (
    <PageShell active="/api-producto">
      <div className="p-3 sm:p-5">
        <SectionHeader
          eyebrow="API"
          title="Sports Intelligence como producto"
          description="La API debe tener versionado, autenticacion, planes, rate limiting y documentacion. Esta pagina separa el producto tecnico de la experiencia editorial."
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-xl border border-[#dfe1e8] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Endpoints iniciales</h2>
            <div className="mt-4 space-y-3">
              {[
                ["/api/v1/events", "Eventos disponibles. Filtros: sport, status, sort, minConfidence."],
                ["/api/v1/events/evt-football-001", "Detalle de evento, prediccion asociada y relacionados."],
                ["/api/v1/predictions", "Ranking de predicciones con explicabilidad, caveats y modelo."],
                ["/api/v1/predictions/evt-football-001", "Detalle de prediccion para un evento especifico."],
                ["/api/v1/search?q=Santiago", "Busqueda por equipo, liga, deporte, prediccion o noticia."],
                [
                  "/api/v1/providers/api-sports/football/fixtures?date=2026-07-13",
                  "Preview de fixtures desde API-Sports con API_SPORTS_KEY server-side.",
                ],
              ].map(([endpoint, description]) => (
                <Link
                  key={endpoint}
                  href={endpoint}
                  className="block rounded-lg border border-[#e3e4ea] bg-[#f7f7f9] p-4 transition hover:border-[#ff5a00]/60"
                >
                  <p className="font-mono text-sm font-black text-[#ff5a00]">{endpoint}</p>
                  <p className="mt-2 text-sm leading-6 text-[#6f717c]">{description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#dfe1e8] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Capacidades por plan</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Free", "Eventos, estadisticas basicas y predicciones principales."],
                ["Premium", "Modelos detallados, historial completo, comparadores e IA explicativa."],
                ["Enterprise", "Dashboards, SLAs, capacidad dedicada y soporte de integraciones."],
              ].map(([plan, description]) => (
                <div key={plan} className="rounded-lg bg-[#f7f7f9] p-4">
                  <p className="font-black text-[#ff5a00]">{plan}</p>
                  <p className="mt-2 text-sm leading-6 text-[#6f717c]">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
