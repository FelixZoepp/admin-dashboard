import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

export function KpiCard({
  label,
  value,
  sub,
  subTrend,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subTrend?: Trend;
  valueClass?: string;
}) {
  const trendClass =
    subTrend === "up"
      ? "text-accent-green font-semibold"
      : subTrend === "down"
        ? "text-accent-red font-semibold"
        : subTrend === "neutral"
          ? "text-accent-yellow font-semibold"
          : "";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={cn("kpi-value", valueClass)}>{value}</div>
      {sub && (
        <div className="kpi-sub">
          {subTrend ? <span className={trendClass}>{sub}</span> : sub}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] max-[480px]:grid-cols-2 gap-2.5 mb-5">
      {children}
    </div>
  );
}
