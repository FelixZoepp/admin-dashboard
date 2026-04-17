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

  return (
    <div className="flex gap-2 mb-4 justify-end flex-wrap">
      <a
        href={`/api/export/csv?tab=${tab}`}
        className="text-xs px-3 py-1.5 rounded border border-border hover:border-accent-blue hover:text-accent-blue transition-colors"
      >
        CSV
      </a>
      <a
        href={`/api/export/pdf?tab=${tab}`}
        className="text-xs px-3 py-1.5 rounded border border-border hover:border-accent-blue hover:text-accent-blue transition-colors"
      >
        PDF
      </a>
      {(tab === "finanzen" || tab === "clients" || tab === "overview") && (
        <a
          href="/api/export/tax"
          className="text-xs px-3 py-1.5 rounded border border-border hover:border-accent-yellow hover:text-accent-yellow transition-colors"
        >
          Steuer-Export
        </a>
      )}
      <button
        onClick={createShare}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded border border-border hover:border-accent-green hover:text-accent-green transition-colors disabled:opacity-50"
      >
        {loading ? "…" : "Share-Link"}
      </button>
      {shareUrl && (
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="text-[11px] bg-bg-tertiary border border-border rounded px-2 w-60"
        />
      )}
    </div>
  );
}
