"use client";

import { useEffect, useState } from "react";
import { ModuleCard } from "../module-card";

interface Quote {
  quote: string;
  author: string;
}

export function QuoteModule() {
  const [data, setData] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  async function fetchQuote() {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/quote");
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchQuote();
  }, []);

  return (
    <ModuleCard
      title="Quote of the Day"
      accent="from-amber-500/30 to-yellow-500/10"
      actions={
        <button
          type="button"
          onClick={fetchQuote}
          aria-label="Refresh quote"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/60 hover:text-white"
        >
          Refresh
        </button>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="h-4 w-4/5 rounded-full bg-white/10 animate-pulse" />
            <div className="h-4 w-3/5 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-1/3 rounded-full bg-white/6 animate-pulse mt-2" />
          </div>
        )}

        {!isLoading && error && (
          <p className="text-sm text-slate-500">Unable to load quote.</p>
        )}

        {!isLoading && data && (
          <>
            <p className="text-2xl font-light leading-snug text-amber-50">
              &ldquo;{data.quote}&rdquo;
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              — {data.author}
            </p>
          </>
        )}
      </div>
    </ModuleCard>
  );
}
