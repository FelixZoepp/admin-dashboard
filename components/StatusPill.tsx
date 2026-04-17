type Accent =
  | "green" | "cyan" | "purple" | "orange" | "red" | "yellow" | "pink" | "blue";

const COLORS: Record<Accent, { text: string; bg: string; border: string }> = {
  green:  { text: "text-neon-green",  bg: "bg-neon-green/10",  border: "border-neon-green/40"  },
  cyan:   { text: "text-neon-cyan",   bg: "bg-neon-cyan/10",   border: "border-neon-cyan/40"   },
  purple: { text: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/40" },
  orange: { text: "text-neon-orange", bg: "bg-neon-orange/10", border: "border-neon-orange/40" },
  red:    { text: "text-neon-red",    bg: "bg-neon-red/10",    border: "border-neon-red/40"    },
  yellow: { text: "text-neon-yellow", bg: "bg-neon-yellow/10", border: "border-neon-yellow/40" },
  pink:   { text: "text-neon-pink",   bg: "bg-neon-pink/10",   border: "border-neon-pink/40"   },
  blue:   { text: "text-neon-blue",   bg: "bg-neon-blue/10",   border: "border-neon-blue/40"   },
};

export function StatusPill({
  label,
  accent = "cyan",
  dot = true,
}: {
  label: string;
  accent?: Accent;
  dot?: boolean;
}) {
  const c = COLORS[accent];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] border ${c.text} ${c.bg} ${c.border}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${c.text.replace("text-", "bg-")} animate-pulseNeon`}
          style={{ boxShadow: `0 0 6px currentColor` }}
        />
      )}
      {label}
    </span>
  );
}

export function OperationalBadge({ online = true }: { online?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border ${
        online
          ? "bg-neon-green/10 text-neon-green border-neon-green/40"
          : "bg-neon-red/10 text-neon-red border-neon-red/40"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          online ? "bg-neon-green" : "bg-neon-red"
        } animate-pulseNeon`}
        style={{ boxShadow: `0 0 8px currentColor` }}
      />
      {online ? "Operational" : "Offline"}
    </span>
  );
}
