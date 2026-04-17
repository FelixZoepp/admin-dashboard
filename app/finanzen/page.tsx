import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ChartBars } from "@/components/ChartBars";
import { TxList } from "@/components/TxList";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 60;

export default async function Finanzen() {
  const sb = await supabaseServer();
  const [
    { data: kpis },
    { data: months },
    { data: invoices },
    { data: qonto },
    { data: cashflow },
    { data: inflows },
    { data: outflows },
    { data: accounts },
  ] = await Promise.all([
    sb.from("v_finance_kpis").select("*").single(),
    sb.from("v_revenue_monthly").select("*").limit(6),
    sb
      .from("invoices")
      .select("*")
      .order("due_date", { ascending: true })
      .limit(10),
    sb.from("v_qonto_summary").select("*").single(),
    sb.from("v_cashflow_kpis").select("*").single(),
    sb.from("v_inflows_recent").select("*").limit(15),
    sb.from("v_outflows_recent").select("*").limit(15),
    sb.from("bank_accounts").select("id, name, institution, balance, iban"),
  ]);

  const byBank = (cashflow?.by_bank ?? {}) as Record<
    string,
    { in: number; out: number }
  >;

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="finanzen" />

        <div className="section-title">Umsatzübersicht</div>
        <KpiGrid>
          <KpiCard
            label="Umsatz MTD"
            value={formatEUR(kpis?.revenue_mtd)}
            valueClass="text-accent-green"
            sub="laufender Monat"
          />
          <KpiCard
            label="Offene RG"
            value={formatEUR(kpis?.unpaid_total)}
            sub={`${formatNumber(kpis?.unpaid_count)} Rechnungen`}
          />
          <KpiCard
            label="Kontostand gesamt"
            value={formatEUR((accounts ?? []).reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0))}
            sub={`${(accounts ?? []).length} Konten`}
          />
          <KpiCard label="MRR" value={formatEUR(kpis?.mrr)} sub="Recurring" />
        </KpiGrid>

        <div className="section-title">Cashflow MTD</div>
        <div className="card">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <div>
              <div className="text-xs text-muted">Eingänge</div>
              <div className="text-lg font-bold text-accent-green">
                {formatEUR(cashflow?.inflow_month)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Ausgänge</div>
              <div className="text-lg font-bold text-accent-red">
                {formatEUR(cashflow?.outflow_month)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Netto</div>
              <div
                className={`text-lg font-bold ${
                  (cashflow?.net_month ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {formatEUR(cashflow?.net_month)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-3">
            {Object.entries(byBank).map(([bank, v]) => (
              <div key={bank} className="flex items-center gap-2">
                <span className="text-xs capitalize w-24">{bank}</span>
                <div className="flex-1 flex h-5 rounded overflow-hidden border border-border">
                  {v.in > 0 && (
                    <div
                      className="bg-accent-green/60 text-[10px] font-semibold text-white flex items-center justify-end px-1.5"
                      style={{
                        width: `${Math.max(20, (v.in / Math.max(v.in + v.out, 1)) * 100)}%`,
                      }}
                    >
                      +{formatEUR(v.in)}
                    </div>
                  )}
                  {v.out > 0 && (
                    <div
                      className="bg-accent-red/60 text-[10px] font-semibold text-white flex items-center justify-start px-1.5"
                      style={{
                        width: `${Math.max(20, (v.out / Math.max(v.in + v.out, 1)) * 100)}%`,
                      }}
                    >
                      -{formatEUR(v.out)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-title">Bankkonten</div>
        <div className="card">
          {(accounts ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">Keine Konten geladen</div>
          ) : (
            (accounts ?? []).map((a: any) => (
              <div
                key={a.id}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-[11px] text-muted">
                    {a.institution ?? "—"} · {a.iban ?? "—"}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold ${
                    Number(a.balance) >= 0 ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {formatEUR(a.balance)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="section-title">Eingänge (alle Banken)</div>
        <TxList items={(inflows ?? []) as any[]} direction="in" />

        <div className="section-title">Ausgänge (alle Banken)</div>
        <TxList items={(outflows ?? []) as any[]} direction="out" />

        <div className="section-title">Monatsverlauf</div>
        <ChartBars
          bars={(months ?? []).map((m: any, i: number) => ({
            label: m.label,
            value: Number(m.revenue),
            highlight: i === (months ?? []).length - 1,
          }))}
          format={(v) => formatEUR(v)}
        />

        <div className="section-title">Offene Rechnungen (Easybill)</div>
        <div className="card">
          {(invoices ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">Keine offenen Rechnungen</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Nr.</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kunde</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Betrag</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Fällig</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map((inv: any) => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="p-2">{inv.number}</td>
                      <td className="p-2">{inv.customer_name}</td>
                      <td className="p-2 text-right">{formatEUR(inv.total)}</td>
                      <td className="p-2 text-right text-muted">
                        {inv.due_date
                          ? new Date(inv.due_date).toLocaleDateString("de-DE")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </>
  );
}
