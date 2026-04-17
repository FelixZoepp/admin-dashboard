import { isoWeek, formatDate } from "@/lib/utils";
import { Tabs } from "./Tabs";
import { OperationalBadge, StatusPill } from "./StatusPill";

const INTEGRATIONS: { label: string; accent: any }[] = [
  { label: "Close",       accent: "cyan" },
  { label: "Instantly",   accent: "purple" },
  { label: "Monday",      accent: "pink" },
  { label: "Supabase",    accent: "green" },
  { label: "Qonto",       accent: "orange" },
  { label: "Meta",        accent: "blue" },
  { label: "Clockify",    accent: "yellow" },
  { label: "Airtable",    accent: "red" },
];

export function Header({ lastSync }: { lastSync?: string | null }) {
  const now = new Date();
  return (
    <header className="sticky top-0 z-50 bg-bg-primary/85 backdrop-blur-md border-b border-border px-5 pt-4 pb-1">
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-black tracking-[0.22em] text-white uppercase leading-tight">
            Content Leads{" "}
            <span className="bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink bg-clip-text text-transparent">
              Command Center
            </span>
          </div>
          <OperationalBadge />
        </div>
        <div className="text-[10px] text-muted text-right uppercase tracking-[0.1em] font-mono">
          <div>KW {isoWeek(now)} · {formatDate(now)}</div>
          {lastSync && <div className="mt-0.5 opacity-70">Sync {lastSync}</div>}
        </div>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {INTEGRATIONS.map((i) => (
          <StatusPill key={i.label} label={i.label} accent={i.accent} />
        ))}
      </div>

      <Tabs />
    </header>
  );
}
