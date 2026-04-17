"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Position = { id: string; title: string };
type Application = { id: string; candidate_name: string };

const CATEGORIES = [
  { value: "interview", label: "Interview (Zeit / Raum / Tool)" },
  { value: "trial_day", label: "Probetag (Vergütung / Materialkosten)" },
  { value: "ad_spend", label: "Ad Spend (LinkedIn / Indeed)" },
  { value: "tool", label: "Tool / Software (ATS, Tests)" },
  { value: "agency", label: "Agentur / Headhunter" },
  { value: "other", label: "Sonstiges" },
];

export function CostForm({
  positions,
  applications,
}: {
  positions: Position[];
  applications: Application[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const sb = supabaseBrowser();
    const { error } = await sb.from("recruiting_costs").insert({
      category: fd.get("category"),
      description: fd.get("description") || null,
      amount: Number(fd.get("amount") || 0),
      position_id: fd.get("position_id") || null,
      application_id: fd.get("application_id") || null,
      incurred_at: fd.get("incurred_at") || new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    if (error) setMsg(`Fehler: ${error.message}`);
    else {
      setMsg("Kosten gespeichert.");
      (e.currentTarget as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid grid-cols-2 md:grid-cols-3 gap-3">
      <label className="flex flex-col gap-1 text-[11px] text-muted col-span-2 md:col-span-3">
        Kategorie *
        <select
          name="category"
          required
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Betrag (€) *
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0"
          required
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Datum
        <input
          type="date"
          name="incurred_at"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Stelle
        <select
          name="position_id"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        >
          <option value="">—</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted col-span-2">
        Bewerbung (optional)
        <select
          name="application_id"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        >
          <option value="">—</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.candidate_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted col-span-2 md:col-span-3">
        Beschreibung
        <input
          type="text"
          name="description"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <div className="col-span-2 md:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded bg-accent-red text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Speichere…" : "Kosten erfassen"}
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </form>
  );
}
