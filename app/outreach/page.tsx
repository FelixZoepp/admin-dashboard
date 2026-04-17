import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ChartBars } from "@/components/ChartBars";
import { StatusList } from "@/components/StatusList";
import { TxList } from "@/components/TxList";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

export default async function Outreach() {
  const sb = await supabaseServer();
  const [
    { data: kpis },
    { data: campaigns },
    { data: weekly },
    { data: cashflow },
    { data: inflows },
    { data: outflows },
    { data: leadsByStatus },
    { data: invoices },
  ] = await Promise.all([
    sb.from("v_outreach_kpis").select("*").single(),
    sb.from("v_outreach_campaigns").select("*"),
    sb.from("v_outreach_weekly").select("*").limit(8),
    sb.from("v_cashflow_kpis").select("*").single(),
    sb.from("v_inflows_recent").select("*").limit(10),
    sb.from("v_outflows_recent").select("*").limit(10),
    sb.from("v_leads_by_status").select("*"),
    sb
      .from("invoices")
      .select("*")
      .in("status", ["open", "overdue"])
      .order("due_date", { ascending: true })
      .limit(10),
  ]);

  const byBank = (cashflow?.by_bank ?? {}) as Record<
    string,
    { in: number; out: number }
  >;

  const STATUS_COLORS: Record<string, string> = {
    "Potential New Lead": "linear-gradient(90deg,#4f8cff,#6ba3ff)",
    "Interested": "linear-gradient(90deg,#34d399,#51e0b8)",
    "Qualified": "linear-gradient(90deg,#34d399,#10b981)",
    "Bad Fit": "linear-gradient(90deg,#f87171,#fca5a5)",
    "Unqualified": "linear-gradient(90deg,#f87171,#fca5a5)",
    "Unbekannt": "linear-gradient(90deg,#6b7280,#9ca3af)",
  };

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="outreach" />

        {/* ====== INSTANTLY ====== */}
        <div className="section-title">
          <span>📧</span> E-Mail Outreach (Instantly)
        </div>
        <KpiGrid>
          <KpiCard
            label="Versandt KW"
            value={formatNumber(kpis?.sent_week)}
            sub="E-Mails verschickt"
          />
          <KpiCard
            label="Opens KW"
            value={formatNumber(kpis?.opened_week)}
            sub={`Open Rate: ${formatPercent(kpis?.open_rate, 1)}`}
            subTrend="up"
          />
          <KpiCard
            label="Replies KW"
            value={formatNumber(kpis?.replied_week)}
            sub={`Reply Rate: ${formatPercent(kpis?.reply_rate, 1)}`}
            subTrend="up"
          />
          <KpiCard
            label="Positive Replies"
            value={formatNumber(kpis?.positive_week)}
            sub="echtes Interesse"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Bounces"
            value={formatNumber(kpis?.bounced_week)}
            sub="KW"
            valueClass={(kpis?.bounced_week ?? 0) > 20 ? "text-accent-red" : ""}
          />
          <KpiCard
            label="Kampagnen"
            value={formatNumber((campaigns ?? []).filter((c: any) => c.status === "active").length)}
            sub={`von ${formatNumber((campaigns ?? []).length)} gesamt`}
          />
        </KpiGrid>

        <div className="section-title">Wochentrend — Versendet</div>
        <ChartBars
          bars={(weekly ?? []).map((w: any, i: number) => ({
            label: `KW${w.week}`,
            value: w.sent,
            highlight: i === (weekly ?? []).length - 1,
          }))}
        />

        <div className="section-title">Aktive Kampagnen</div>
        <div className="card">
          {(campaigns ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Noch keine Kampagnen synchronisiert. `INSTANTLY_API_KEY` in Supabase-Secrets eintragen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kampagne</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Status</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Leads</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Sent KW</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Replies KW</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Positive</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns ?? []).map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                            c.status === "active"
                              ? "bg-accent-green/20 text-accent-green"
                              : "bg-white/10 text-muted"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">{formatNumber(c.leads_total)}</td>
                      <td className="p-2 text-right">{formatNumber(c.sent_week)}</td>
                      <td className="p-2 text-right">{formatNumber(c.replied_week)}</td>
                      <td className="p-2 text-right text-accent-green">
                        {formatNumber(c.positive_week)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ====== CLOSE STATUS DRILL-DOWN ====== */}
        <div className="section-title">
          <span>🎯</span> Close CRM — Lead-Status
        </div>
        <StatusList
          items={(leadsByStatus ?? []).map((r: any) => ({
            label: r.status,
            count: r.count,
            color: STATUS_COLORS[r.status],
          }))}
          totalLabel="Leads gesamt"
        />

        {/* ====== CASHFLOW ====== */}
        <div className="section-title">
          <span>💸</span> Cashflow MTD
        </div>
        <KpiGrid>
          <KpiCard
            label="Eingänge"
            value={formatEUR(cashflow?.inflow_month)}
            sub="Monat"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Ausgänge"
            value={formatEUR(cashflow?.outflow_month)}
            sub="Monat"
            valueClass="text-accent-red"
          />
          <KpiCard
            label="Netto"
            value={formatEUR(cashflow?.net_month)}
            sub="Saldo MTD"
            valueClass={(cashflow?.net_month ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"}
          />
          <KpiCard
            label="Qonto"
            value={formatEUR(byBank.qonto?.in ?? 0)}
            sub={`Ausgang ${formatEUR(byBank.qonto?.out ?? 0)}`}
          />
          <KpiCard
            label="Commerzbank"
            value={formatEUR(byBank.commerzbank?.in ?? 0)}
            sub={`Ausgang ${formatEUR(byBank.commerzbank?.out ?? 0)}`}
          />
        </KpiGrid>

        <div className="section-title">
          <span>⬇</span> Eingänge (Qonto + Commerzbank)
        </div>
        <TxList
          items={(inflows ?? []) as any[]}
          direction="in"
          emptyText="Noch keine Eingänge geladen"
        />

        <div className="section-title">
          <span>⬆</span> Ausgänge (Qonto + Commerzbank)
        </div>
        <TxList
          items={(outflows ?? []) as any[]}
          direction="out"
          emptyText="Noch keine Ausgänge geladen"
        />

        {/* ====== EASYBILL OFFENE RECHNUNGEN ====== */}
        <div className="section-title">
          <span>🧾</span> Offene Rechnungen (Easybill)
        </div>
        <div className="card">
          {(invoices ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Keine offenen Rechnungen
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">
                      Nr.
                    </th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">
                      Kunde
                    </th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">
                      Betrag
                    </th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">
                      Fällig
                    </th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map((inv: any) => {
                    const isOverdue = inv.status === "overdue";
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="p-2">{inv.number}</td>
                        <td className="p-2">{inv.customer_name}</td>
                        <td className="p-2 text-right">{formatEUR(inv.total)}</td>
                        <td className="p-2 text-right text-muted">
                          {inv.due_date
                            ? new Date(inv.due_date).toLocaleDateString("de-DE")
                            : "—"}
                        </td>
                        <td className="p-2 text-right">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                              isOverdue
                                ? "bg-accent-red/20 text-accent-red"
                                : "bg-accent-yellow/20 text-accent-yellow"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
