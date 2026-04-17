import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;

export default async function Team() {
  const sb = await supabaseServer();
  const [{ data: kpis }, { data: boards }, { data: workload }] = await Promise.all([
    sb.from("v_team_kpis").select("*").single(),
    sb.from("v_team_boards").select("*"),
    sb.from("v_team_workload").select("*"),
  ]);

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="team" />

        <div className="section-title">Team-Übersicht</div>
        <KpiGrid>
          <KpiCard label="Offene Tasks" value={formatNumber(kpis?.open_tasks)} sub="Monday" />
          <KpiCard label="Erledigt KW" value={formatNumber(kpis?.done_week)} sub="Diese Woche" />
          <KpiCard
            label="Überfällig"
            value={formatNumber(kpis?.overdue)}
            sub="Past Due"
            valueClass={kpis?.overdue > 0 ? "text-accent-red" : ""}
          />
          <KpiCard label="Boards" value={formatNumber(kpis?.boards_count)} sub="aktive Boards" />
        </KpiGrid>

        <div className="section-title">Boards &amp; Projekte</div>
        <div className="card">
          {(boards ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">Keine Boards geladen</div>
          ) : (
            (boards ?? []).map((b: any) => (
              <div
                key={b.board_id}
                className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm font-semibold">{b.name}</div>
                  <div className="text-[11px] text-muted">
                    {formatNumber(b.items_open)} offen · {formatNumber(b.items_done)} done
                  </div>
                </div>
                <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-blue to-accent-green"
                    style={{
                      width: `${
                        b.items_total > 0 ? (b.items_done / b.items_total) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="section-title">Team-Auslastung</div>
        <div className="card">
          {(workload ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">Keine Team-Daten</div>
          ) : (
            (workload ?? []).map((w: any) => (
              <div
                key={w.person}
                className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
              >
                <div className="text-sm">{w.person}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted">
                    {formatNumber(w.tasks_open)} offen
                  </div>
                  <div className="text-sm font-bold text-accent-blue">
                    {formatNumber(w.tasks_done_week)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
