"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { EventInsight } from "@/domain/sports-intelligence/types";

const storageKey = "goup-sport:favorites";
const emptyFavorites: string[] = [];
let cachedRawFavorites: string | null = null;
let cachedFavorites: string[] = [];

function readFavorites() {
  if (typeof window === "undefined") return [];

  try {
    const rawFavorites = window.localStorage.getItem(storageKey) ?? "[]";
    if (rawFavorites === cachedRawFavorites) return cachedFavorites;

    const parsed = JSON.parse(rawFavorites);
    cachedRawFavorites = rawFavorites;
    cachedFavorites = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    return cachedFavorites;
  } catch {
    cachedRawFavorites = null;
    cachedFavorites = [];
    return [];
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("goup-sport:favorites-change", callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("goup-sport:favorites-change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function FavoritesPanel({ events }: { events: EventInsight[] }) {
  const favoriteIds = useSyncExternalStore(subscribe, readFavorites, () => emptyFavorites);

  const favorites = useMemo(
    () => favoriteIds.map((id) => events.find((event) => event.id === id)).filter((event): event is EventInsight => Boolean(event)),
    [events, favoriteIds],
  );

  return (
    <div className="border-t border-[#d7d8df] p-3">
      <p className="px-1 py-3 text-base font-black text-[#4a4c55]">Favoritos</p>
      <div className="h-0.5 bg-[#ff5a00]" />
      {favorites.length > 0 ? (
        <div className="mt-3 space-y-1">
          {favorites.map((event) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}`}
              className="block rounded-md px-2 py-3 text-sm font-bold hover:bg-white"
            >
              <span className="block truncate">{event.home.name}</span>
              <span className="block truncate text-xs text-[#6f717c]">vs {event.away.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 px-1 text-sm leading-5 text-[#6f717c]">
          Marca eventos con la estrella para verlos aqui.
        </p>
      )}
    </div>
  );
}
