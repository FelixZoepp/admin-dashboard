import { formatNumber } from "@/lib/utils";

export function StatusList({
  items,
  totalLabel = "Gesamt",
}: {
  items: { label: string; count: number; color?: string }[];
  totalLabel?: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="card">
      {items.map((i) => {
        const pct = total > 0 ? (i.count / total) * 100 : 0;
        return (
          <div
            key={i.label}
            className="flex justify-between items-center py-2 border-b border-border last:border-0"
          >
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span>{i.label}</span>
                <span className="text-muted">{formatNumber(i.count)}</span>
              </div>
              <div className="h-1 bg-white/10 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    background: i.color ?? "linear-gradient(90deg,#4f8cff,#6ba3ff)",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[11px] text-muted pt-2 mt-1 border-t border-border">
        <span>{totalLabel}</span>
        <span className="font-semibold text-white">{formatNumber(total)}</span>
      </div>
    </div>
  );
}
