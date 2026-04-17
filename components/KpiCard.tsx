import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

type Trend = "up" | "down" | "neutral";
type Accent =
  | "green" | "cyan" | "purple" | "orange" | "red" | "yellow" | "pink" | "blue";

const ACCENT_TEXT: Record<Accent, string> = {
  green:  "text-neon-green",
  cyan:   "text-neon-cyan",
  purple: "text-neon-purple",
  orange: "text-neon-orange",
  red:    "text-neon-red",
  yellow: "text-neon-yellow",
  pink:   "text-neon-pink",
  blue:   "text-neon-blue",
};

const ACCENT_SHADOW: Record<Accent, string> = {
  green:  "shadow-glow-green",
  cyan:   "shadow-glow-cyan",
  purple: "shadow-glow-purple",
  orange: "shadow-glow-orange",
  red:    "shadow-glow-red",
  yellow: "shadow-glow-yellow",
  pink:   "shadow-glow-pink",
  blue:   "shadow-glow-blue",
};

const ACCENT_GRADIENT: Record<Accent, { from: string; to: string }> = {
  green:  { from: "#3dffb0", to: "#00b5ff" },
  cyan:   { from: "#44e7ff", to: "#5b8cff" },
  purple: { from: "#c77dff", to: "#ff5db1" },
  orange: { from: "#ff9f45", to: "#ff4d6d" },
  red:    { from: "#ff4d6d", to: "#c77dff" },
  yellow: { from: "#ffe94a", to: "#ff9f45" },
  pink:   { from: "#ff5db1", to: "#c77dff" },
  blue:   { from: "#5b8cff", to: "#44e7ff" },
};

export function KpiCard({
  label,
  value,
  sub,
  subTrend,
  valueClass,
  accent,
  spark,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subTrend?: Trend;
  valueClass?: string;
  accent?: Accent;
  spark?: number[];
  icon?: React.ReactNode;
}) {
  const accentColor = accent ?? "cyan";
  const trendClass =
    subTrend === "up"
      ? "text-neon-green font-semibold"
      : subTrend === "down"
        ? "text-neon-red font-semibold"
        : subTrend === "neutral"
          ? "text-neon-yellow font-semibold"
          : "";

  const grad = ACCENT_GRADIENT[accentColor];

  return (
    <div
      className={cn(
        "kpi-card neon-ring group",
        ACCENT_SHADOW[accentColor],
      )}
      style={
        {
          "--neon-from": grad.from,
          "--neon-to": grad.to,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`text-[13px] ${ACCENT_TEXT[accentColor]}`}>{icon}</span>}
      </div>
      <div className={cn("kpi-value", valueClass ?? ACCENT_TEXT[accentColor])}>{value}</div>
      {spark && spark.length > 0 && (
        <div className="h-8 -mx-1">
          <Sparkline data={spark} accent={accentColor} />
        </div>
      )}
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] max-[480px]:grid-cols-2 gap-3 mb-5">
      {children}
    </div>
  );
}
