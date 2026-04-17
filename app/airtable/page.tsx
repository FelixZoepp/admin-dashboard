import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { AirtableConfigRow } from "./ConfigRow";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 30;

export default async function Airtable() {
  const sb = await supabaseServer();
  const [
    { data: status },
    { data: manualKpis },
    { data: byCategory },
    { data: recentExpenses },
    { data: recentIncome },
  ] = await Promise.all([
    sb.from("v_airtable_status").select("*"),
    sb.from("v_manual_finance_kpis").select("*").single(),
    sb.from("v_manual_expenses_by_category").select("*"),
    sb
      .from("manual_expenses")
      .select("*")
      .order("incurred_at", { ascending: false })
      .limit(15),
    sb
      .from("manual_income")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(15),
  ]);

  const pullConfigs = (status ?? []).filter((s: any) => s.direction === "pull");
  const pushConfigs = (status ?? []).filter((s: any) => s.direction === "push");

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="overview" />

        <div className="section-title">
          <span>🗂️</span> Airtable Integration
        </div>
        <div className="card text-xs text-muted">
          Airtable dient als <b className="text-white">manuelle Datenquelle</b> (z.B. für
          Tools ohne API) und als <b className="text-white">Mirror</b> für Close-Leads,
          Deals, Bewerbungen und Coaching-Einreichungen — damit du Daten bequem in
          Airtable sichten und bearbeiten kannst. Einträge werden bidirektional
          synchronisiert; das `SupabaseId`-Feld ist der Schlüssel.
        </div>

        {/* ============ MANUAL FINANCE ============ */}
        <div className="section-title">Manuelle Finanzdaten</div>
        <KpiGrid>
          <KpiCard
            label="Ausgaben Monat"
            value={formatEUR(manualKpis?.expenses_month)}
            sub="aus Airtable / Manual"
            valueClass="text-accent-red"
          />
          <KpiCard
            label="Ausgaben KW"
            value={formatEUR(manualKpis?.expenses_week)}
            sub="diese Woche"
          />
          <KpiCard
            label="Einnahmen Monat"
            value={formatEUR(manualKpis?.income_month)}
            sub="manuell erfasst"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Einnahmen KW"
            value={formatEUR(manualKpis?.income_week)}
            sub="diese Woche"
          />
        </KpiGrid>

        <div className="section-title">Ausgaben nach Kategorie</div>
        <div className="card">
          {(byCategory ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Noch keine Ausgaben synchronisiert
            </div>
          ) : (
            (byCategory ?? []).map((c: any) => (
              <div
                key={c.category}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm capitalize">{c.category}</div>
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

        {/* ============ SYNC STATUS ============ */}
        <div className="section-title">Pull-Quellen (Airtable → Supabase)</div>
        <div className="card">
          {pullConfigs.length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">Keine Pull-Configs angelegt</div>
          ) : (
            pullConfigs.map((c: any) => <AirtableConfigRow key={c.topic} config={c} />)
          )}
        </div>

        <div className="section-title">Push-Mirrors (Supabase → Airtable)</div>
        <div className="card">
          {pushConfigs.length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">Keine Push-Configs angelegt</div>
          ) : (
            pushConfigs.map((c: any) => <AirtableConfigRow key={c.topic} config={c} />)
          )}
        </div>

        {/* ============ RECENT ENTRIES ============ */}
        <div className="section-title">Letzte Ausgaben</div>
        <div className="card">
          {(recentExpenses ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Noch keine Ausgaben
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Datum</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kategorie</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Anbieter</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Beschreibung</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentExpenses ?? []).map((e: any) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="p-2 text-muted whitespace-nowrap">
                        {new Date(e.incurred_at).toLocaleDateString("de-DE")}
                      </td>
                      <td className="p-2 capitalize">{e.category}</td>
                      <td className="p-2">{e.vendor ?? "—"}</td>
                      <td className="p-2 text-muted">{e.description ?? "—"}</td>
                      <td className="p-2 text-right text-accent-red font-semibold">
                        {formatEUR(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-title">Letzte Einnahmen</div>
        <div className="card">
          {(recentIncome ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Noch keine Einnahmen
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Datum</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Quelle</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Beschreibung</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentIncome ?? []).map((e: any) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="p-2 text-muted whitespace-nowrap">
                        {new Date(e.received_at).toLocaleDateString("de-DE")}
                      </td>
                      <td className="p-2">{e.source ?? "—"}</td>
                      <td className="p-2 text-muted">{e.description ?? "—"}</td>
                      <td className="p-2 text-right text-accent-green font-semibold">
                        {formatEUR(e.amount)}
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
