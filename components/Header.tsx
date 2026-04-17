import { isoWeek, formatDate } from "@/lib/utils";
import { Tabs } from "./Tabs";

export function Header({ lastSync }: { lastSync?: string | null }) {
  const now = new Date();
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-br from-bg-secondary to-bg-tertiary border-b border-border px-5 pt-4 shadow-card">
      <div className="flex justify-between items-center mb-3">
        <div className="text-xl font-bold bg-gradient-to-br from-accent-blue to-[#7ba3ff] bg-clip-text text-transparent">
          Content Leads — Admin
        </div>
        <div className="text-[11px] text-muted text-right">
          <div>KW {isoWeek(now)}</div>
          <div>{formatDate(now)}</div>
          {lastSync && <div className="mt-0.5 opacity-70">Sync: {lastSync}</div>}
        </div>
      </div>
      <Tabs />
    </header>
  );
}
