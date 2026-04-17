"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Position = { id: string; title: string };

const STAGES = [
  "new",
  "screening",
  "interview",
  "trial",
  "offer",
  "hired",
  "rejected",
  "withdrew",
];
const SOURCES = ["linkedin", "indeed", "referral", "website", "other"];

export function ApplicationForm({ positions }: { positions: Position[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const sb = supabaseBrowser();
    const payload: Record<string, unknown> = {
      candidate_name: fd.get("candidate_name"),
      email: fd.get("email") || null,
      phone: fd.get("phone") || null,
      source: fd.get("source") || null,
      stage: fd.get("stage") || "new",
      position_id: fd.get("position_id") || null,
      notes: fd.get("notes") || null,
    };
    // Auto-timestamp stage-milestones
    const stage = String(payload.stage);
    if (stage === "screening") payload.screened_at = new Date().toISOString();
    if (stage === "interview") payload.interviewed_at = new Date().toISOString();
    if (stage === "trial") payload.trial_started_at = new Date().toISOString();
    if (stage === "offer") payload.offered_at = new Date().toISOString();
    if (stage === "hired") payload.hired_at = new Date().toISOString();
    if (stage === "rejected") payload.rejected_at = new Date().toISOString();

    const { error } = await sb.from("recruiting_applications").insert(payload);
    setBusy(false);
    if (error) setMsg(`Fehler: ${error.message}`);
    else {
      setMsg("Bewerbung gespeichert.");
      (e.currentTarget as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid grid-cols-2 md:grid-cols-3 gap-3">
      <Input label="Name *" name="candidate_name" required />
      <Input label="Email" name="email" type="email" />
      <Input label="Telefon" name="phone" />
      <Select
        label="Stelle"
        name="position_id"
        options={[{ value: "", label: "— keine —" }, ...positions.map((p) => ({ value: p.id, label: p.title }))]}
      />
      <Select
        label="Quelle"
        name="source"
        options={[{ value: "", label: "—" }, ...SOURCES.map((s) => ({ value: s, label: s }))]}
      />
      <Select
        label="Stage"
        name="stage"
        defaultValue="new"
        options={STAGES.map((s) => ({ value: s, label: s }))}
      />
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
          {busy ? "Speichere…" : "Bewerbung speichern"}
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </form>
  );
}

function Input({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted">
      {label}
      <input
        {...rest}
        className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
      />
    </label>
  );
}

function Select({
  label,
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted">
      {label}
      <select
        {...rest}
        className="bg-bg-primary border border-border rounded px-2 py-1.5 text-sm text-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
