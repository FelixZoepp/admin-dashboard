import { formatEUR } from "@/lib/utils";

export type Tx = {
  id: string;
  tx_date: string;
  label: string | null;
  amount: number;
  counterparty?: string | null;
  institution?: string | null;
  category?: string | null;
};

const BANK_COLORS: Record<string, string> = {
  qonto: "bg-accent-purple/20 text-accent-purple",
  commerzbank: "bg-accent-yellow/20 text-accent-yellow",
};

export function TxList({
  items,
  emptyText = "Keine Transaktionen",
  direction,
}: {
  items: Tx[];
  emptyText?: string;
  direction: "in" | "out";
}) {
  if (items.length === 0) {
    return (
      <div className="card text-center text-muted text-sm py-6">{emptyText}</div>
    );
  }
  return (
    <div className="card">
      {items.map((t) => (
        <div
          key={t.id}
          className="flex justify-between items-start py-2.5 border-b border-border last:border-0 gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate">
              {t.counterparty || t.label || "—"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted">
              <span>{new Date(t.tx_date).toLocaleDateString("de-DE")}</span>
              {t.institution && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                    BANK_COLORS[t.institution] ?? "bg-white/10"
                  }`}
                >
                  {t.institution}
                </span>
              )}
              {t.category && <span className="truncate">· {t.category}</span>}
            </div>
          </div>
          <div
            className={`text-sm font-bold whitespace-nowrap ${
              direction === "in" ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {direction === "out" ? "-" : "+"}
            {formatEUR(Math.abs(Number(t.amount)))}
          </div>
        </div>
      ))}
    </div>
  );
}
