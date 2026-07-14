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
    <section className="overflow-hidden rounded-xl bg-[#111] text-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ffb48a]">Eventos destacados</p>
          <p className="mt-0.5 text-xs font-semibold text-white/65">Partidos reales y modelos GOUP</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Evento anterior"
            onClick={() => setActiveIndex((current) => (current - 1 + carouselEvents.length) % carouselEvents.length)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/20"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Evento siguiente"
            onClick={() => setActiveIndex((current) => (current + 1) % carouselEvents.length)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-lg font-black hover:bg-white/20"
          >
            ›
          </button>
        </div>
      </div>

      <div className="relative p-3">
        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
        >
          {carouselEvents.map((event, index) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}`}
              onFocus={() => setActiveIndex(index)}
              className={`relative min-h-[222px] w-[86%] shrink-0 snap-start overflow-hidden rounded-xl bg-[#181922] p-3 transition sm:w-[430px] lg:w-[468px] ${
                index === activeIndex ? "ring-2 ring-[#ff5a00]" : "opacity-90 hover:opacity-100"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-62"
                style={{ backgroundImage: `url(${sportBackgrounds[event.sport]})` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.5)),radial-gradient(circle_at_78%_24%,rgba(255,90,0,0.5),transparent_30%)]" />
              <div className="relative flex min-h-[198px] flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg">
                        {sportIcons[event.sport]}
                      </span>
                      <p className="truncate rounded bg-white/14 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em] text-[#ffd2bd]">
                        {sportLabels[event.sport]} / {event.country ?? "Global"} / {event.league}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#ff5a00] px-2 py-1 text-[10px] font-black uppercase">
                      {event.status === "live" ? "Live" : "Proximo"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamCrest team={event.home} className="h-10 w-10" />
                      <h2 className="truncate text-2xl font-black leading-tight sm:text-3xl">
                        {event.home.name}
                      </h2>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamCrest team={event.away} className="h-10 w-10" />
                      <h2 className="truncate text-2xl font-black leading-tight sm:text-3xl">
                        {event.away.name}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-3 truncate text-sm font-black text-[#5da9ff]">
                    {getEventStage(event)} · {eventTime(event)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {probabilityTiles(event).map(([label, value]) => (
                    <div key={label} className="rounded-md bg-white px-2 py-2 text-center text-[#1f2028]">
                      <p className="truncate text-[10px] font-black uppercase text-[#6f717c]">{label}</p>
                      <p className="mt-0.5 truncate text-sm font-black">{value}</p>
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
