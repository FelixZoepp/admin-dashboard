import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 300;

export default async function Forecast() {
  const sb = await supabaseServer();
  const [{ data: summary }, { data: series }] = await Promise.all([
    sb.from("v_forecast_summary").select("*").single(),
    sb.from("v_forecast_mrr_timeseries").select("*"),
  ]);

  const bars = ((series ?? []) as any[]).map((r, i, arr) => ({
    label: new Date(r.month_start).toLocaleDateString("de-DE", { month: "short" }),
    value: Number(r.mrr ?? 0),
    forecast: r.forecast as boolean,
    isLast: i === arr.length - 1,
  }));
  const maxBar = Math.max(...bars.map((b) => b.value), 1);

  const trendUp = Number(summary?.slope_per_month ?? 0) > 0;
  const trendArrow = trendUp ? "▲" : "▼";

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="overview" />

        <div className="section-title">
          <span>🔮</span> Forecast
        </div>

        <KpiGrid>
          <KpiCard
            label="MRR heute"
            value={formatEUR(summary?.current_mrr)}
            sub={`Trend: ${trendArrow} ${formatEUR(Math.abs(Number(summary?.slope_per_month ?? 0)))}/Mo`}
            subTrend={trendUp ? "up" : "down"}
          />
          <KpiCard
            label="MRR in 1 Monat"
            value={formatEUR(summary?.forecast_mrr_1m)}
            sub="Prognose"
            valueClass="text-accent-blue"
          />
          <KpiCard
            label="MRR in 3 Monaten"
            value={formatEUR(summary?.forecast_mrr_3m)}
            sub="Linear-Trend"
            valueClass="text-accent-blue"
          />
          <KpiCard
            label="MRR in 6 Monaten"
            value={formatEUR(summary?.forecast_mrr_6m)}
            sub="Linear-Trend"
            valueClass="text-accent-blue"
          />
          <KpiCard
            label="Umsatz 30d Forecast"
            value={formatEUR(summary?.forecast_revenue_30d)}
            sub="basierend auf Ø Tagesumsatz"
          />
          <KpiCard
            label="Umsatz 90d Forecast"
            value={formatEUR(summary?.forecast_revenue_90d)}
            sub="3-Monats-Prognose"
          />
          <KpiCard
            label="Pipeline"
            value={formatEUR(summary?.pipeline_value)}
            sub={`${formatNumber(summary?.pipeline_count)} Deals`}
          />
          <KpiCard
            label="Pipeline gewichtet"
            value={formatEUR(summary?.pipeline_weighted)}
            sub="× Stage-Wahrscheinlichkeit"
            valueClass="text-accent-green"
          />
        </KpiGrid>

        <div className="section-title">MRR-Verlauf + 6 Monate Prognose</div>
        <div className="card">
          <div className="flex items-end justify-around gap-1.5 h-48 px-1">
            {bars.map((b, i) => {
              const height = (b.value / maxBar) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center h-full justify-end"
                >
                  <div className="text-[9px] text-white font-semibold mb-0.5">
                    {formatEUR(b.value)}
                  </div>
                  <div
                    className="w-full min-w-[24px] max-w-[50px] rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      background: b.forecast
                        ? "linear-gradient(180deg,#a78bfa66,#a78bfa33)"
                        : "linear-gradient(180deg,#4f8cff,#5a94ff)",
                      border: b.forecast ? "1px dashed #a78bfa" : "none",
                    }}
                  />
                  <div className="text-[9px] text-muted mt-1">{b.label}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-accent-blue inline-block" /> Ist
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-dashed border-accent-purple inline-block" /> Prognose
            </span>
          </div>
        </div>

        <div className="section-title">Methodik</div>
        <div className="card text-xs text-muted">
          <p className="mb-2">
            <b className="text-white">MRR-Forecast:</b> lineare Regression über
            die letzten 6 Monatswerte (aus aktiven Retainer-Verträgen).
          </p>
          <p className="mb-2">
            <b className="text-white">Revenue-Forecast:</b> Durchschnittlicher
            Tagesumsatz der letzten 60 Tage, projiziert auf 30 / 90 Tage.
          </p>
          <p>
            <b className="text-white">Pipeline-Gewichtung:</b> Won = 100 %,
            Angebot = 40 %, Closing = 35 %, Setting = 15 %, sonst 5 %.
            Näherung — ersetzt keine individuelle Opportunity-Bewertung.
          </p>
        </div>
      </main>
    </>
  );
}
