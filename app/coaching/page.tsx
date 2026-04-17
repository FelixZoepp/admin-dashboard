import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { CoachingSubmissionForm } from "./SubmissionForm";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 30;

export default async function Coaching() {
  const sb = await supabaseServer();
  const [{ data: kpis }, { data: clients }, { data: submissions }] = await Promise.all([
    sb.from("v_coaching_kpis").select("*").single(),
    sb.from("coaching_clients").select("*").order("name"),
    sb.from("v_coaching_recent_submissions").select("*").limit(20),
  ]);

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="coaching" />

        <div className="section-title">Coaching KPIs</div>
        <KpiGrid>
          <KpiCard label="Aktive Kunden" value={formatNumber(kpis?.active_clients)} sub="im Programm" />
          <KpiCard label="Einreichungen KW" value={formatNumber(kpis?.submissions_week)} sub="diese Woche" />
          <KpiCard
            label="Gesamt-Umsatz KW"
            value={formatEUR(kpis?.total_revenue_week)}
            sub="aller Kunden"
            valueClass="text-accent-green"
          />
          <KpiCard label="Neue Leads KW" value={formatNumber(kpis?.total_leads_week)} sub="aller Kunden" />
        </KpiGrid>

        <div className="section-title">Einreichung erstellen</div>
        <CoachingSubmissionForm clients={clients ?? []} />

        <div className="section-title">Letzte Einreichungen</div>
        <div className="card">
          {(submissions ?? []).length === 0 ? (
            <div className="text-center py-6 text-muted text-sm">
              Noch keine Einreichungen
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kunde</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Umsatz</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Leads</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Calls</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Abschlüsse</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {(submissions ?? []).map((s: any) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="p-2">{s.client_name}</td>
                      <td className="p-2 text-right">{formatEUR(s.revenue)}</td>
                      <td className="p-2 text-right">{formatNumber(s.new_leads)}</td>
                      <td className="p-2 text-right">{formatNumber(s.booked_calls)}</td>
                      <td className="p-2 text-right">{formatNumber(s.closes)}</td>
                      <td className="p-2 text-right text-muted">
                        {new Date(s.week_start).toLocaleDateString("de-DE")}
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
