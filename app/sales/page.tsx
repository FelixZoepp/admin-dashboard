import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { Funnel } from "@/components/Funnel";
import { ChartBars } from "@/components/ChartBars";
import { StatusList } from "@/components/StatusList";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

export default async function Sales() {
  const sb = await supabaseServer();
  const [
    { data: funnel },
    { data: funnelDetailed },
    { data: trend },
    { data: wonDeals },
    { data: pipeline },
    { data: bySource },
    { data: leadStatus },
    { data: roleTotals },
    { data: roleQuotas },
  ] = await Promise.all([
    sb.from("v_sales_funnel_week").select("*"),
    sb.from("v_sales_funnel_detailed").select("*"),
    sb.from("v_sales_weekly_trend").select("*").limit(8),
    sb.from("v_won_deals_month").select("*").limit(10),
    sb.from("v_pipeline_by_stage").select("*"),
    sb.from("v_pipeline_by_source").select("*"),
    sb.from("v_leads_by_status").select("*"),
    sb.from("v_sales_role_totals").select("*"),
    sb.from("v_sales_role_quotas").select("*"),
  ]);

  const f = funnel ?? [];
  const top = f[0]?.count ?? 1;

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="sales" />

        <div className="section-title">Kennzahlen diese Woche</div>
        <KpiGrid>
          <KpiCard label="Anwahlen" value={formatNumber(f[0]?.count ?? 0)} sub="Calls" />
          <KpiCard label="CC-Protokolle" value={formatNumber(f[1]?.count ?? 0)} sub={`CC-Quote: ${formatPercent(f[1]?.pct ?? 0)}`} subTrend="up" />
          <KpiCard label="Settings" value={formatNumber(f[2]?.count ?? 0)} sub={`Quali: ${formatPercent(f[2]?.pct ?? 0)}`} subTrend="up" />
          <KpiCard label="Won Deals" value={formatNumber(f[4]?.count ?? 0)} sub={formatEUR(f[4]?.value ?? 0)} subTrend="up" />
          <KpiCard label="Pipeline" value={formatNumber((pipeline ?? []).reduce((s, r: any) => s + r.count, 0))} sub={formatEUR((pipeline ?? []).reduce((s, r: any) => s + Number(r.value), 0))} subTrend="up" />
          <KpiCard label="Closing Rate" value={formatPercent(f[4]?.pct ?? 0)} sub="Won / Anw." />
        </KpiGrid>

        <div className="section-title">Sales Funnel (detailliert)</div>
        <Funnel
          stages={(funnelDetailed ?? []).map((s: any) => {
            const tt = (funnelDetailed ?? [])[0]?.count ?? 1;
            const COLORS: Record<string, string> = {
              "Won": "linear-gradient(90deg,#fbbf24,#fcd34d)",
              "Angebot": "linear-gradient(90deg,#a78bfa,#c4b5fd)",
              "Closing": "linear-gradient(90deg,#34d399,#51e0b8)",
              "No Show": "linear-gradient(90deg,#f87171,#fca5a5)",
            };
            return {
              label: s.stage,
              count: s.count,
              pct: tt > 0 ? (s.count / tt) * 100 : 0,
              color: COLORS[s.stage],
            };
          })}
        />

        <div className="section-title">Wochentrend — Anwahlen</div>
        <ChartBars
          bars={(trend ?? []).map((t: any, i: number) => ({
            label: `KW${t.week}`,
            value: t.calls,
            highlight: i === (trend ?? []).length - 1,
          }))}
        />

        <div className="section-title">Won Deals (Monat)</div>
        {(wonDeals ?? []).length === 0 ? (
          <div className="card text-center py-8 text-muted text-sm">
            Noch keine Won Deals diesen Monat
          </div>
        ) : (
          (wonDeals ?? []).map((d: any) => (
            <div key={d.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-semibold">{d.lead_name}</div>
                <div className="text-[11px] px-2 py-0.5 rounded font-semibold bg-accent-green/20 text-accent-green">
                  Won
                </div>
              </div>
              <div className="text-xl font-bold text-accent-green mb-1.5">
                {formatEUR(d.value)}
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>{new Date(d.won_at).toLocaleDateString("de-DE")}</span>
                <span>{d.owner}</span>
              </div>
            </div>
          ))
        )}

        <div className="section-title">Active Pipeline — nach Stage</div>
        <div className="card">
          {(pipeline ?? []).map((p: any) => (
            <div
              key={p.stage}
              className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
            >
              <div>
                <div className="text-sm font-semibold">{formatNumber(p.count)} Deals</div>
                <div className="text-[11px] text-muted">{p.stage}</div>
              </div>
              <div className="text-sm font-semibold text-accent-blue">{formatEUR(p.value)}</div>
            </div>
          ))}
        </div>

        <div className="section-title">Pipeline — nach Quelle</div>
        <div className="card">
          {(bySource ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">Keine Daten</div>
          ) : (
            (bySource ?? []).map((r: any) => (
              <div
                key={r.source}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm capitalize">{r.source}</div>
                  <div className="text-[11px] text-muted">{formatNumber(r.deals)} Deals</div>
                </div>
                <div className="text-sm font-semibold text-accent-blue">{formatEUR(r.value)}</div>
              </div>
            ))
          )}
        </div>

        <div className="section-title">Quoten nach Rolle (KW)</div>
        <div className="card">
          {(roleTotals ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Noch keine Rollen-Daten
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Rolle</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Anw.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">CC</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">CC%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Sett.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Quali%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Clos.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Won</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Close%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {(roleTotals ?? []).map((r: any) => (
                    <tr key={r.role} className="border-b border-border last:border-0">
                      <td className="p-2 font-semibold capitalize">{r.role.replace("_", " ")}</td>
                      <td className="p-2 text-right">{formatNumber(r.anwahlen)}</td>
                      <td className="p-2 text-right">{formatNumber(r.cc)}</td>
                      <td className="p-2 text-right text-accent-blue">{formatPercent(r.cc_rate, 1)}</td>
                      <td className="p-2 text-right">{formatNumber(r.settings_count)}</td>
                      <td className="p-2 text-right text-accent-purple">{formatPercent(r.quali_rate, 1)}</td>
                      <td className="p-2 text-right">{formatNumber(r.closings_count)}</td>
                      <td className="p-2 text-right text-accent-green">{formatNumber(r.won_count)}</td>
                      <td className="p-2 text-right text-accent-yellow">{formatPercent(r.closing_rate, 1)}</td>
                      <td className="p-2 text-right font-semibold">{formatEUR(r.won_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-title">Performance pro Person (KW)</div>
        <div className="card">
          {(roleQuotas ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Noch keine Aktivitäten diese Woche
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Name</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Rolle</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Anw.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">CC%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Sett.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Quali%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Won</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Close%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {(roleQuotas ?? []).map((r: any) => (
                    <tr key={r.user_name} className="border-b border-border last:border-0">
                      <td className="p-2">{r.user_name}</td>
                      <td className="p-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 capitalize">
                          {r.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-2 text-right">{formatNumber(r.anwahlen)}</td>
                      <td className="p-2 text-right text-accent-blue">{formatPercent(r.cc_rate, 0)}</td>
                      <td className="p-2 text-right">{formatNumber(r.settings_count)}</td>
                      <td className="p-2 text-right text-accent-purple">{formatPercent(r.quali_rate, 0)}</td>
                      <td className="p-2 text-right text-accent-green">{formatNumber(r.won_count)}</td>
                      <td className="p-2 text-right text-accent-yellow">{formatPercent(r.closing_rate, 0)}</td>
                      <td className="p-2 text-right font-semibold">{formatEUR(r.won_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-title">Leads — nach Status</div>
        <StatusList
          items={(leadStatus ?? []).map((r: any) => ({ label: r.status, count: r.count }))}
          totalLabel="Leads gesamt"
        />
      </main>
    </>
  );
}
