"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventInsight } from "@/domain/sports-intelligence/types";
import {
  getEventPrimaryMetric,
  getEventSecondaryMetric,
  getEventStage,
  sportIcons,
  sportBackgrounds,
  sportLabels,
  TeamCrest,
} from "./ui";

function eventTime(event: EventInsight) {
  return new Date(event.startsAt).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function probabilityTiles(event: EventInsight) {
  const primary = getEventPrimaryMetric(event);
  const secondary = getEventSecondaryMetric(event);

  if (event.confidence > 0) {
    return [
      [event.home.name, `${event.confidence}%`],
      ["Empate", `${Math.max(24, 100 - event.confidence - 18)}%`],
      [event.away.name, `${Math.max(18, 100 - event.confidence)}%`],
    ];
  }

  return [
    [primary.label, primary.value],
    ["Pais", event.country ?? "Global"],
    [secondary.label, secondary.value],
  ];
}

const cardAccents = [
  "linear-gradient(110deg,rgba(0,196,204,0.88),rgba(8,20,34,0.7) 48%,rgba(8,20,34,0.2))",
  "linear-gradient(110deg,rgba(86,51,197,0.9),rgba(8,20,34,0.68) 50%,rgba(8,20,34,0.18))",
  "linear-gradient(110deg,rgba(255,90,0,0.88),rgba(8,20,34,0.7) 48%,rgba(8,20,34,0.18))",
  "linear-gradient(110deg,rgba(16,120,104,0.9),rgba(8,20,34,0.68) 50%,rgba(8,20,34,0.18))",
];

export function EventCarousel({ events }: { events: EventInsight[] }) {
  const carouselEvents = useMemo(() => events.slice(0, 12), [events]);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (carouselEvents.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselEvents.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [carouselEvents.length]);

  useEffect(() => {
    const track = trackRef.current;
    const target = track?.children.item(activeIndex) as HTMLElement | null;
    if (!track || !target) return;

    track.scrollTo({
      left: target.offsetLeft - track.offsetLeft,
      behavior: "smooth",
    });
  }, [activeIndex]);

  if (carouselEvents.length === 0) return null;

  return (
    <section className="overflow-hidden text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black">Eventos destacados</h2>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Evento anterior"
            onClick={() => setActiveIndex((current) => (current - 1 + carouselEvents.length) % carouselEvents.length)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/18"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Evento siguiente"
            onClick={() => setActiveIndex((current) => (current + 1) % carouselEvents.length)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/18"
          >
            ›
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
        >
          {carouselEvents.map((event, index) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}`}
              onFocus={() => setActiveIndex(index)}
              className={`relative min-h-[250px] w-[88%] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#102132] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.28)] transition sm:w-[520px] lg:w-[590px] ${
                index === activeIndex ? "ring-2 ring-[#ff5a00]" : "opacity-92 hover:opacity-100"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-72"
                style={{ backgroundImage: `url(${sportBackgrounds[event.sport]})` }}
              />
              <div
                className="absolute inset-0"
                style={{ background: cardAccents[index % cardAccents.length] }}
              />
              <div className="absolute -right-10 top-6 h-40 w-40 rounded-full border-[22px] border-white/10" />
              <div className="absolute -right-5 bottom-8 text-[120px] leading-none opacity-20">
                {sportIcons[event.sport]}
              </div>
              <div className="relative flex min-h-[218px] flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-lg">
                        {sportIcons[event.sport]}
                      </span>
                      <p className="truncate rounded bg-white/16 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em] text-white">
                        {sportLabels[event.sport]} / {event.country ?? "Global"} / {event.league}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#ff5a00] px-2 py-1 text-[10px] font-black uppercase">
                      {event.status === "live" ? "Live" : "Proximo"}
                    </span>
                  </div>

                  <div className="mt-8 max-w-[78%]">
                    <h3 className="text-sm font-black text-white/78">{getEventStage(event)} · {eventTime(event)}</h3>
                    <div className="mt-3 grid gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <TeamCrest team={event.home} className="h-10 w-10" />
                        <h2 className="truncate text-3xl font-black leading-tight sm:text-4xl">
                          {event.home.name}
                        </h2>
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <TeamCrest team={event.away} className="h-10 w-10" />
                        <h2 className="truncate text-3xl font-black leading-tight sm:text-4xl">
                          {event.away.name}
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-white text-[#071522]">
                  {probabilityTiles(event).map(([label, value]) => (
                    <div key={label} className="border-r border-[#dfe5eb] px-3 py-2 text-center last:border-r-0">
                      <p className="truncate text-[10px] font-black uppercase text-[#6f717c]">{label}</p>
                      <p className="mt-0.5 truncate text-base font-black text-[#00969b]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          {carouselEvents.map((event, index) => (
            <button
              key={event.id}
              type="button"
              aria-label={`Ir al evento ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === activeIndex ? "w-8 bg-[#ff5a00]" : "w-2.5 bg-white/35"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
