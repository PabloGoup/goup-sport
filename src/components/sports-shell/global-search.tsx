"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SearchResult } from "@/domain/sports-intelligence/types";

export function GlobalSearch({ results }: { results: SearchResult[] }) {
  const [query, setQuery] = useState("");

  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return results
      .filter((result) =>
        [result.title, result.subtitle, result.type, result.sport]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [query, results]);

  return (
    <div className="relative ml-auto w-full max-w-[340px]">
      <label className="flex min-w-0 items-center gap-2 rounded-md border border-white/8 bg-white/8 px-3 py-2 text-[#ff7a2f]">
        <span className="text-xl">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#ff7a2f]"
        />
      </label>
      {filteredResults.length > 0 && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-[#dfe1e8] bg-white shadow-xl">
          {filteredResults.map((result) => (
            <Link
              key={`${result.type}-${result.id}`}
              href={result.href}
              onClick={() => setQuery("")}
              className="block border-b border-[#f0f1f5] px-4 py-3 last:border-b-0 hover:bg-[#f7f7f9]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-black text-[#26262d]">{result.title}</p>
                <span className="rounded bg-[#fff0e8] px-2 py-1 text-[10px] font-black uppercase text-[#ff5a00]">
                  {result.type}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-[#6f717c]">{result.subtitle}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
