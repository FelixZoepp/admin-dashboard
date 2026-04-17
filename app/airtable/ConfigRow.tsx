"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Config = {
  topic: string;
  direction: string;
  base_id: string;
  table_name: string;
  supabase_table: string | null;
  active: boolean;
  last_synced_at: string | null;
  records_count: number | null;
};

export function AirtableConfigRow({ config }: { config: Config }) {
  const [active, setActive] = useState(config.active);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const sb = supabaseBrowser();
    await sb
      .from("airtable_sync_config")
      .update({ active: !active })
      .eq("topic", config.topic);
    setActive(!active);
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{config.topic}</div>
        <div className="text-[11px] text-muted truncate">
          {config.base_id}/{config.table_name}
          {config.supabase_table && ` → ${config.supabase_table}`}
        </div>
        <div className="text-[10px] text-muted opacity-70">
          {config.records_count ?? 0} records ·{" "}
          {config.last_synced_at
            ? `Sync ${new Date(config.last_synced_at).toLocaleString("de-DE")}`
            : "Nie synchronisiert"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`text-[10px] font-semibold uppercase px-2 py-1 rounded transition-colors ${
          active
            ? "bg-accent-green/20 text-accent-green hover:bg-accent-green/30"
            : "bg-white/10 text-muted hover:bg-white/15"
        }`}
      >
        {busy ? "…" : active ? "aktiv" : "inaktiv"}
      </button>
    </div>
  );
}
