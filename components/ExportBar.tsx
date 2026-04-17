"use client";

import { useState } from "react";

export function ExportBar({ tab }: { tab: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createShare() {
    setLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tab, ttlHours: 168 }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) setShareUrl(data.url);
    } finally {
      setLoading(false);
    }
  }

  const btn =
    "text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded border border-border font-mono transition-all";

  return (
    <div className="flex gap-2 mb-4 justify-end flex-wrap">
      <a
        href={`/api/export/csv?tab=${tab}`}
        className={`${btn} text-muted hover:border-neon-cyan hover:text-neon-cyan`}
      >
        CSV
      </a>
      <a
        href={`/api/export/pdf?tab=${tab}`}
        className={`${btn} text-muted hover:border-neon-cyan hover:text-neon-cyan`}
      >
        PDF
      </a>
      {(tab === "finanzen" || tab === "clients" || tab === "overview") && (
        <a
          href="/api/export/tax"
          className={`${btn} text-muted hover:border-neon-yellow hover:text-neon-yellow`}
        >
          Steuer
        </a>
      )}
      {tab === "finanzen" && (
        <a
          href={`/api/export/ustva?month=${new Date().toISOString().slice(0, 7)}`}
          className={`${btn} text-muted hover:border-neon-yellow hover:text-neon-yellow`}
        >
          UStVA XML
        </a>
      )}
      <button
        onClick={createShare}
        disabled={loading}
        className={`${btn} text-muted hover:border-neon-green hover:text-neon-green disabled:opacity-50`}
      >
        {loading ? "…" : "Share-Link"}
      </button>
      {shareUrl && (
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="text-[10px] bg-bg-tertiary border border-border rounded px-2 w-60 font-mono"
        />
      )}
    </div>
  );
}
