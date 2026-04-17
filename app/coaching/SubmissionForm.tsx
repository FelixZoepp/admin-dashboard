"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Client = { id: string; name: string };

export function CoachingSubmissionForm({ clients }: { clients: Client[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const sb = supabaseBrowser();
    const { error } = await sb.from("client_submissions").insert({
      client_id: fd.get("client_id"),
      week_start: fd.get("week_start"),
      revenue: Number(fd.get("revenue") || 0),
      new_leads: Number(fd.get("new_leads") || 0),
      booked_calls: Number(fd.get("booked_calls") || 0),
      closes: Number(fd.get("closes") || 0),
      notes: fd.get("notes"),
    });
    setBusy(false);
    if (error) setMsg(`Fehler: ${error.message}`);
    else {
      setMsg("Gespeichert.");
      (e.currentTarget as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid grid-cols-2 md:grid-cols-3 gap-3">
      <label className="flex flex-col gap-1 text-[11px] text-muted col-span-2 md:col-span-3">
        Kunde
        <select
          name="client_id"
          required
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        >
          <option value="">— auswählen —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Woche (Montag)
        <input
          type="date"
          name="week_start"
          required
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Umsatz (€)
        <input
          type="number"
          name="revenue"
          step="0.01"
          min="0"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Neue Leads
        <input
          type="number"
          name="new_leads"
          min="0"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Gebuchte Calls
        <input
          type="number"
          name="booked_calls"
          min="0"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Abschlüsse
        <input
          type="number"
          name="closes"
          min="0"
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted col-span-2 md:col-span-3">
        Notizen
        <textarea
          name="notes"
          rows={2}
          className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
        />
      </label>
      <div className="col-span-2 md:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded bg-accent-blue text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Speichere…" : "Einreichung speichern"}
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </form>
  );
}
