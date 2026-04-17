import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { Funnel } from "@/components/Funnel";
import { ChartBars } from "@/components/ChartBars";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

export default async function Sales() {
  const sb = await supabaseServer();
  const [{ data: funnel }, { data: trend }, { data: wonDeals }, { data: pipeline }] =
    await Promise.all([
      sb.from("v_sales_funnel_week").select("*"),
      sb.from("v_sales_weekly_trend").select("*").limit(8),
      sb.from("v_won_deals_month").select("*").limit(10),
      sb.from("v_pipeline_by_stage").select("*"),
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

        <div className="section-title">Sales Funnel</div>
        <Funnel
          stages={f.map((s: any, idx: number) => ({
            label: s.stage,
            count: s.count,
            pct: top > 0 ? (s.count / top) * 100 : 0,
            color:
              idx === 4
                ? "linear-gradient(90deg,#fbbf24,#fcd34d)"
                : idx === 3
                  ? "linear-gradient(90deg,#34d399,#51e0b8)"
                  : undefined,
          }))}
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

        <div className="section-title">Active Pipeline</div>
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
      </main>
    </>
  );
}
