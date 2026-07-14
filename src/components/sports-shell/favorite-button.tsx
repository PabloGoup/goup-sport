"use client";

import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";

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

export function FavoriteButton({ eventId }: { eventId: string }) {
  const favorites = useSyncExternalStore(subscribe, readFavorites, () => emptyFavorites);
  const isFavorite = favorites.includes(eventId);

  function toggleFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const favorites = readFavorites();
    const nextFavorites = favorites.includes(eventId)
      ? favorites.filter((favorite) => favorite !== eventId)
      : [...favorites, eventId];

    window.localStorage.setItem(storageKey, JSON.stringify(nextFavorites));
    window.dispatchEvent(new CustomEvent("goup-sport:favorites-change", { detail: nextFavorites }));
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`rounded-full px-2 py-1 text-lg leading-none ${
        isFavorite ? "text-[#ff5a00]" : "text-[#a1a4ae]"
      }`}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}
