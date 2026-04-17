import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ChartBars } from "@/components/ChartBars";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;

export default async function Fulfillment() {
  const sb = await supabaseServer();
  const [{ data: kpis }, { data: days }, { data: trend }, { data: categories }] =
    await Promise.all([
      sb.from("v_fulfillment_kpis").select("*").single(),
      sb.from("v_fulfillment_by_day").select("*"),
      sb.from("v_fulfillment_weekly").select("*").limit(5),
      sb.from("v_fulfillment_by_category").select("*"),
    ]);

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="fulfillment" />

        <div className="section-title">Produktivität</div>
        <KpiGrid>
          <KpiCard label="Heute erledigt" value={formatNumber(kpis?.done_today)} sub="Aufgaben" />
          <KpiCard label="Woche gesamt" value={formatNumber(kpis?.done_week)} sub="KW-Total" />
          <KpiCard label="Ø pro Tag" value={formatNumber(kpis?.avg_per_day)} sub="Durchschnitt" />
          <KpiCard
            label="Offen"
            value={formatNumber(kpis?.open_count)}
            sub="Noch zu erledigen"
            valueClass={kpis?.open_count > 20 ? "text-accent-red" : ""}
          />
        </KpiGrid>

        <div className="section-title">Tagesaufschlüsselung</div>
        <div className="card">
          {(days ?? []).map((d: any) => {
            const max = Math.max(...(days ?? []).map((x: any) => x.count), 1);
            return (
              <div
                key={d.weekday}
                className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
              >
                <div className="text-sm font-medium">{d.weekday}</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-accent-green min-w-[30px] text-right">
                    {formatNumber(d.count)}
                  </div>
                  <div className="w-20 h-1.5 bg-white/10 rounded overflow-hidden">
                    <div
                      className="h-full bg-accent-green"
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-title">Wochentrend</div>
        <ChartBars
          bars={(trend ?? []).map((t: any, i: number) => ({
            label: `KW${t.week}`,
            value: t.count,
            highlight: i === (trend ?? []).length - 1,
          }))}
        />

        <div className="section-title">Kategorien</div>
        <div className="card">
          {(categories ?? []).map((c: any) => (
            <div
              key={c.category}
              className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
            >
              <div className="text-sm">{c.category}</div>
              <div className="text-sm font-bold">{formatNumber(c.count)}</div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
