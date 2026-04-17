import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ChartBars } from "@/components/ChartBars";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 60;

export default async function Finanzen() {
  const sb = await supabaseServer();
  const [{ data: kpis }, { data: months }, { data: invoices }, { data: qonto }] =
    await Promise.all([
      sb.from("v_finance_kpis").select("*").single(),
      sb.from("v_revenue_monthly").select("*").limit(6),
      sb.from("invoices")
        .select("*")
        .order("due_date", { ascending: true })
        .limit(10),
      sb.from("v_qonto_summary").select("*").single(),
    ]);

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
          <KpiCard label="Kontostand" value={formatEUR(qonto?.balance)} sub="Qonto" />
          <KpiCard label="MRR" value={formatEUR(kpis?.mrr)} sub="Recurring" />
        </KpiGrid>

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

        <div className="section-title">Qonto — Letzte Transaktionen</div>
        <div className="card">
          {(qonto?.recent_tx ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">Noch keine Transaktionen synchronisiert</div>
          ) : (
            (qonto?.recent_tx ?? []).slice(0, 8).map((t: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-xs">{t.label}</div>
                  <div className="text-[10px] text-muted">
                    {new Date(t.date).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <div
                  className={
                    Number(t.amount) >= 0
                      ? "text-accent-green font-semibold text-sm"
                      : "text-accent-red font-semibold text-sm"
                  }
                >
                  {formatEUR(Number(t.amount))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
