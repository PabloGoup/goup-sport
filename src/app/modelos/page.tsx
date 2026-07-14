import { listPredictions } from "@/domain/sports-intelligence/service";
import { PageShell, PredictionCard, SectionHeader } from "@/components/sports-shell/ui";

export default function ModelsPage() {
  const predictions = listPredictions();

  return (
    <PageShell active="/modelos">
      <div className="p-3 sm:p-5">
        <SectionHeader
          eyebrow="Modelos IA"
          title="Predicciones explicables"
          description="Cada prediccion muestra version, confianza, factores de impacto y salvedades. Este modulo debe crecer hacia backtesting, drift y comparacion historica."
        />

        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff5a00]">
                Comparador
              </p>
              <h2 className="mt-1 text-xl font-black">Predicciones principales</h2>
              <p className="mt-2 text-sm leading-6 text-[#6f717c]">
                Compara rapidamente confianza, probabilidad y modelo antes de entrar al detalle.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[680px] divide-y divide-[#e3e4ea]">
              {predictions.map((prediction) => (
                <div
                  key={prediction.eventId}
                  className="grid grid-cols-[1.4fr_110px_110px_1fr] items-center gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-black">{prediction.event.home.shortName} vs {prediction.event.away.shortName}</p>
                    <p className="text-xs font-semibold text-[#6f717c]">{prediction.predictedOutcome}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#8a8d98]">Confianza</p>
                    <p className="font-black text-[#ff5a00]">{prediction.confidence}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#8a8d98]">Probabilidad</p>
                    <p className="font-black">{Math.round(prediction.probability * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#8a8d98]">Modelo</p>
                    <p className="truncate font-mono text-xs">{prediction.modelVersion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-3">
          {predictions.map((prediction) => (
            <PredictionCard key={prediction.eventId} prediction={prediction} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
