import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { Funnel } from "@/components/Funnel";
import { ExportBar } from "@/components/ExportBar";
import { ApplicationForm } from "./ApplicationForm";
import { CostForm } from "./CostForm";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 30;

const STAGE_COLORS: Record<string, string> = {
  new: "bg-white/10 text-muted",
  screening: "bg-accent-blue/20 text-accent-blue",
  interview: "bg-accent-purple/20 text-accent-purple",
  trial: "bg-accent-yellow/20 text-accent-yellow",
  offer: "bg-accent-green/20 text-accent-green",
  hired: "bg-accent-green/30 text-accent-green",
  rejected: "bg-accent-red/20 text-accent-red",
  withdrew: "bg-white/10 text-muted",
};

export default async function Recruiting() {
  const sb = await supabaseServer();
  const [
    { data: kpis },
    { data: funnel },
    { data: positions },
    { data: apps },
    { data: costs },
  ] = await Promise.all([
    sb.from("v_recruiting_kpis").select("*").single(),
    sb.from("v_recruiting_funnel").select("*"),
    sb.from("v_recruiting_positions").select("*"),
    sb.from("v_recruiting_applications_recent").select("*"),
    sb.from("v_recruiting_cost_breakdown").select("*"),
  ]);

  const top = (funnel ?? [])[0]?.count ?? 1;

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="recruiting" />

        {/* ====== KPIs ====== */}
        <div className="section-title">
          <span>👥</span> Recruiting (Monat)
        </div>
        <KpiGrid>
          <KpiCard
            label="Offene Stellen"
            value={formatNumber(kpis?.open_positions)}
            sub="aktuell ausgeschrieben"
          />
          <KpiCard
            label="Bewerbungen"
            value={formatNumber(kpis?.new_apps_month)}
            sub="neu diesen Monat"
          />
          <KpiCard
            label="Interviews"
            value={formatNumber(kpis?.interviews_month)}
            sub={`Ø ${formatEUR(kpis?.interview_cost_month ?? 0)} Kosten`}
          />
          <KpiCard
            label="Probetage"
            value={formatNumber(kpis?.trials_month)}
            sub={`Ø ${formatEUR(kpis?.avg_cost_per_trial ?? 0)} / Probetag`}
            valueClass="text-accent-yellow"
          />
          <KpiCard
            label="Eingestellt"
            value={formatNumber(kpis?.hired_month)}
            sub="diesen Monat"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Im Prozess"
            value={formatNumber(kpis?.in_process)}
            sub="screening → offer"
          />
          <KpiCard
            label="Recruiting-Ausgaben"
            value={formatEUR(kpis?.spend_month)}
            sub="Monat"
            valueClass="text-accent-red"
          />
          <KpiCard
            label="Cost per Hire"
            value={formatEUR(kpis?.cost_per_hire ?? 0)}
            sub="Monatsdurchschnitt"
          />
        </KpiGrid>

        {/* ====== FUNNEL ====== */}
        <div className="section-title">Recruiting Funnel (Monat)</div>
        <Funnel
          stages={(funnel ?? []).map((s: any, idx: number) => ({
            label: s.stage,
            count: s.count,
            pct: top > 0 ? (s.count / top) * 100 : 0,
            color:
              idx === 5
                ? "linear-gradient(90deg,#34d399,#10b981)"
                : idx === 4
                  ? "linear-gradient(90deg,#34d399,#51e0b8)"
                  : idx === 3
                    ? "linear-gradient(90deg,#fbbf24,#fcd34d)"
                    : undefined,
          }))}
        />

        {/* ====== POSITIONS ====== */}
        <div className="section-title">Offene Stellen</div>
        <div className="card">
          {(positions ?? []).filter((p: any) => p.status === "open").length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Keine offenen Stellen
            </div>
          ) : (
            (positions ?? [])
              .filter((p: any) => p.status === "open")
              .map((p: any) => (
                <div
                  key={p.id}
                  className="py-3 border-b border-border last:border-0"
                >
                  <div className="flex justify-between items-start gap-3 mb-1.5">
                    <div>
                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-[11px] text-muted">
                        {p.department ?? "—"} · offen seit{" "}
                        {new Date(p.opened_at).toLocaleDateString("de-DE")}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted text-right">
                      <div>{formatEUR(p.spent)} ausgegeben</div>
                      {p.budget_gross && (
                        <div className="opacity-70">
                          von {formatEUR(p.budget_gross)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted">
                    <span>
                      <b className="text-white">{formatNumber(p.applications)}</b> Bew.
                    </span>
                    <span>
                      <b className="text-accent-purple">{formatNumber(p.in_interview)}</b> Interview
                    </span>
                    <span>
                      <b className="text-accent-yellow">{formatNumber(p.in_trial)}</b> Probetag
                    </span>
                    <span>
                      <b className="text-accent-green">{formatNumber(p.hired)}</b> Eingestellt
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* ====== COST BREAKDOWN ====== */}
        <div className="section-title">Kostenstruktur (Monat)</div>
        <div className="card">
          {(costs ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Noch keine Kosten erfasst
            </div>
          ) : (
            (costs ?? []).map((c: any) => (
              <div
                key={c.category}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm capitalize">{c.category.replace("_", " ")}</div>
                  <div className="text-[10px] text-muted">
                    {formatNumber(c.entries)} Einträge
                  </div>
                </div>
                <div className="text-sm font-bold text-accent-red">
                  {formatEUR(c.total)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ====== RECENT APPLICATIONS ====== */}
        <div className="section-title">Letzte Bewerbungen</div>
        <div className="card">
          {(apps ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Noch keine Bewerbungen — unten Formular nutzen
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Name</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Stelle</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Quelle</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Stage</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Kosten</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {(apps ?? []).map((a: any) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="p-2 font-medium">{a.candidate_name}</td>
                      <td className="p-2 text-muted">{a.position_title ?? "—"}</td>
                      <td className="p-2 text-muted">{a.source ?? "—"}</td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                            STAGE_COLORS[a.stage] ?? "bg-white/10 text-muted"
                          }`}
                        >
                          {a.stage}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {a.cost_so_far > 0 ? formatEUR(a.cost_so_far) : "—"}
                      </td>
                      <td className="p-2 text-right text-muted">
                        {new Date(a.applied_at).toLocaleDateString("de-DE")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ====== FORMS ====== */}
        <div className="section-title">Bewerbung erfassen</div>
        <ApplicationForm positions={(positions ?? []) as any[]} />

        <div className="section-title">Kosten erfassen</div>
        <CostForm
          positions={(positions ?? []) as any[]}
          applications={(apps ?? []) as any[]}
        />
      </main>
    </>
  );
}
