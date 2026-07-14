import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBar, PageShell, SectionHeader, sportLabels } from "@/components/sports-shell/ui";
import { getPredictionDetail, listPredictions } from "@/domain/sports-intelligence/service";

type PredictionDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function PredictionDetailPage({ params }: PredictionDetailPageProps) {
  const { eventId } = await params;
  const prediction = getPredictionDetail(eventId);

  if (!prediction) notFound();

  const comparison = listPredictions().filter((item) => item.eventId !== eventId);

  return (
    <PageShell active="/modelos">
      <div className="p-3 sm:p-5">
        <Link href="/modelos" className="mb-4 inline-block text-sm font-black text-[#ff5a00]">
          Volver a modelos
        </Link>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow={`${sportLabels[prediction.event.sport]} / ${prediction.event.league}`}
              title={prediction.predictedOutcome}
              description={`${prediction.event.home.name} vs ${prediction.event.away.name}`}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Confianza", `${prediction.confidence}%`],
                ["Probabilidad", `${Math.round(prediction.probability * 100)}%`],
                ["Generado", new Date(prediction.generatedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f5f6f9] p-4">
                  <p className="text-xs font-black uppercase text-[#8a8d98]">{label}</p>
                  <p className="mt-2 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-[#f5f6f9] p-4">
              <div className="mb-2 flex justify-between text-sm font-black">
                <span>Confianza del modelo</span>
                <span className="text-[#ff5a00]">{prediction.confidence}%</span>
              </div>
              <ConfidenceBar value={prediction.confidence} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {prediction.factors.map((factor) => (
                <div key={factor.label} className="rounded-xl border border-[#e3e4ea] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{factor.label}</p>
                    <span className="font-mono text-sm font-black text-[#ff5a00]">
                      {factor.impact > 0 ? "+" : ""}
                      {factor.impact}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6f717c]">{factor.explanation}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff5a00]">
                Trazabilidad
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-[#8a8d98]">Modelo</p>
                  <p className="font-mono font-black">{prediction.modelVersion}</p>
                </div>
                <div>
                  <p className="font-bold text-[#8a8d98]">Fuente</p>
                  <p className="font-black">{prediction.event.source.provider}</p>
                </div>
                <div>
                  <p className="font-bold text-[#8a8d98]">Normalizador</p>
                  <p className="font-mono font-black">{prediction.event.source.normalizedVersion}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#ffd5c2] bg-[#fff5ef] p-5">
              <p className="font-black text-[#ff5a00]">Salvedades</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-[#6f717c]">
                {prediction.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <section className="mt-5">
          <SectionHeader eyebrow="Comparador" title="Otras predicciones" />
          <div className="grid gap-3 lg:grid-cols-3">
            {comparison.map((item) => (
              <Link
                key={item.eventId}
                href={`/modelos/${item.eventId}`}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <p className="font-black">{item.predictedOutcome}</p>
                <p className="mt-2 text-sm font-semibold text-[#6f717c]">
                  {item.event.home.shortName} vs {item.event.away.shortName}
                </p>
                <p className="mt-3 text-xl font-black text-[#ff5a00]">{item.confidence}%</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
