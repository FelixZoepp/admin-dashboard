export type FunnelStage = {
  label: string;
  count: number;
  pct: number;
  color?: string;
};

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="card">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-2.5 mb-2 last:mb-0">
          <div className="text-xs text-muted w-20 flex-shrink-0">{s.label}</div>
          <div
            className="h-6 rounded flex items-center justify-end pr-2.5 text-[11px] font-semibold text-white transition-all duration-500"
            style={{
              width: `${Math.max(s.pct, 4)}%`,
              minWidth: s.pct < 8 ? 40 : undefined,
              background:
                s.color ??
                "linear-gradient(90deg,#4f8cff,#6ba3ff)",
            }}
          >
            {s.count}
          </div>
          <div className="text-[11px] text-muted w-12 text-right flex-shrink-0">
            {s.pct.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}
