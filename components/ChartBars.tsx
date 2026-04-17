export type ChartBar = { label: string; value: number; highlight?: boolean };

export function ChartBars({
  bars,
  format = (v) => String(v),
}: {
  bars: ChartBar[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="card">
      <div className="flex items-end justify-around gap-1.5 h-40 px-1">
        {bars.map((b) => {
          const height = (b.value / max) * 100;
          const color = b.highlight
            ? "linear-gradient(180deg,#34d399,#51e0b8)"
            : "linear-gradient(180deg,#4f8cff,#5a94ff)";
          return (
            <div
              key={b.label}
              className="flex-1 flex flex-col items-center h-full justify-end"
            >
              <div className="text-[9px] text-white font-semibold mb-0.5">
                {format(b.value)}
              </div>
              <div
                className="w-full min-w-[24px] max-w-[50px] rounded-t transition-all duration-500"
                style={{ height: `${Math.max(height, 2)}%`, background: color }}
              />
              <div className="text-[9px] text-muted mt-1">{b.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
