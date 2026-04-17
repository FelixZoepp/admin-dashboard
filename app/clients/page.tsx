import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

function marginColor(margin: number) {
  if (margin >= 500) return "text-accent-green";
  if (margin >= 0) return "text-accent-blue";
  return "text-accent-red";
}

function marginBadge(pct: number | null) {
  if (pct === null) return { label: "—", cls: "bg-white/10 text-muted" };
  if (pct >= 50) return { label: "Top", cls: "bg-accent-green/20 text-accent-green" };
  if (pct >= 25) return { label: "OK", cls: "bg-accent-blue/20 text-accent-blue" };
  if (pct >= 0) return { label: "Schwach", cls: "bg-accent-yellow/20 text-accent-yellow" };
  return { label: "Minus", cls: "bg-accent-red/20 text-accent-red" };
}

export default async function Clients() {
  const sb = await supabaseServer();
  const [
    { data: kpis },
    { data: rows },
    { data: teamHours },
    { data: costBreakdown },
    { data: recentCosts },
  ] = await Promise.all([
    sb.from("v_clients_kpis").select("*").single(),
    sb.from("v_client_profitability").select("*"),
    sb.from("v_team_hours_month").select("*"),
    sb.from("v_client_costs_breakdown").select("*"),
    sb
      .from("delivery_costs")
      .select("id, client_id, category, description, amount, incurred_at, invoice_number")
      .order("incurred_at", { ascending: false })
      .limit(20),
  ]);

  const clientRows = (rows ?? []) as any[];
  const top3 = [...clientRows].sort((a, b) => (b.margin_month ?? 0) - (a.margin_month ?? 0)).slice(0, 3);
  const bottom3 = [...clientRows].sort((a, b) => (a.margin_month ?? 0) - (b.margin_month ?? 0)).slice(0, 3);

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="clients" />

        {/* ============ Gesamt-KPIs ============ */}
        <div className="section-title">
          <span>💼</span> Kunden-Rentabilität (Monat)
        </div>
        <KpiGrid>
          <KpiCard
            label="Aktive Kunden"
            value={formatNumber(kpis?.active_clients)}
            sub="im Retainer"
          />
          <KpiCard
            label="MRR gesamt"
            value={formatEUR(kpis?.total_mrr)}
            sub="Retainer Revenue"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Stunden-Kosten"
            value={formatEUR(kpis?.total_labor_cost_month)}
            sub={`${formatNumber(kpis?.total_hours_month, )} h`}
            valueClass="text-accent-red"
          />
          <KpiCard
            label="Delivery-Kosten"
            value={formatEUR(kpis?.total_delivery_cost_month)}
            sub="Filming, Material, Ads"
            valueClass="text-accent-red"
          />
          <KpiCard
            label="Netto-Marge"
            value={formatEUR(kpis?.total_margin_month)}
            sub="MRR − alle Kosten"
            valueClass={
              (kpis?.total_margin_month ?? 0) >= 0
                ? "text-accent-green"
                : "text-accent-red"
            }
          />
          <KpiCard
            label="High-Margin"
            value={formatNumber(kpis?.clients_high_margin)}
            sub="Kunden > 50% Marge"
            valueClass="text-accent-green"
          />
          <KpiCard
            label="Minus-Kunden"
            value={formatNumber(kpis?.clients_unprofitable)}
            sub="aktuell unrentabel"
            valueClass={(kpis?.clients_unprofitable ?? 0) > 0 ? "text-accent-red" : ""}
          />
        </KpiGrid>

        {/* ============ TOP / BOTTOM ============ */}
        {clientRows.length > 0 && (
          <>
            <div className="section-title">Top 3 — beste Marge</div>
            <div className="card">
              {top3.map((c: any) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center py-2 border-b border-border last:border-0"
                >
                  <div>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-[11px] text-muted">
                      {formatEUR(c.mrr)} MRR · {formatNumber(c.hours_month)} h
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent-green">
                      {formatEUR(c.margin_month)}
                    </div>
                    <div className="text-[10px] text-muted">
                      {formatPercent(c.margin_pct, 0)} Marge · ROI {c.roi_multiple ?? "—"}x
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-title">Bottom 3 — Handlungsbedarf</div>
            <div className="card">
              {bottom3.map((c: any) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center py-2 border-b border-border last:border-0"
                >
                  <div>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-[11px] text-muted">
                      {formatEUR(c.mrr)} MRR · {formatNumber(c.hours_month)} h
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${marginColor(c.margin_month ?? 0)}`}
                    >
                      {formatEUR(c.margin_month)}
                    </div>
                    <div className="text-[10px] text-muted">
                      {formatPercent(c.margin_pct, 0)} · Ø {formatEUR(c.effective_hourly_rate)} / h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ FULL TABLE ============ */}
        <div className="section-title">Alle Kunden — Profitability-Breakdown</div>
        <div className="card">
          {clientRows.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              Noch keine Kunden angelegt. Erstelle Einträge in Supabase
              (Tabelle <code>clients</code>) oder via Airtable → Pull.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kunde</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">MRR</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Std.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Lohn</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Delivery</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Marge</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">%</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">ROI</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">€/h</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Posts</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">h/Post</th>
                    <th className="text-center p-2 font-semibold text-muted uppercase text-[10px]">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRows.map((c: any) => {
                    const b = marginBadge(c.margin_pct);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="p-2">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[10px] text-muted">{c.account_manager ?? "—"}</div>
                        </td>
                        <td className="p-2 text-right">{formatEUR(c.mrr)}</td>
                        <td className="p-2 text-right">{formatNumber(c.hours_month)}</td>
                        <td className="p-2 text-right text-accent-red/80">
                          {formatEUR(c.labor_cost_month)}
                        </td>
                        <td className="p-2 text-right text-accent-red/80">
                          {formatEUR(c.delivery_cost_month)}
                        </td>
                        <td
                          className={`p-2 text-right font-semibold ${marginColor(c.margin_month ?? 0)}`}
                        >
                          {formatEUR(c.margin_month)}
                        </td>
                        <td className="p-2 text-right">{formatPercent(c.margin_pct, 0)}</td>
                        <td className="p-2 text-right">{c.roi_multiple ? `${c.roi_multiple}x` : "—"}</td>
                        <td className="p-2 text-right">{formatEUR(c.effective_hourly_rate)}</td>
                        <td className="p-2 text-right">{formatNumber(c.posts_published_month)}</td>
                        <td className="p-2 text-right text-muted">
                          {c.avg_hours_per_post ?? "—"}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${b.cls}`}
                          >
                            {b.label}
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

        {/* ============ TEAM HOURS ============ */}
        <div className="section-title">Team-Stunden (Monat)</div>
        <div className="card">
          {(teamHours ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Keine Stunden synchronisiert. Clockify verbinden oder manuell
              via Supabase / Airtable.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Mitarbeiter</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Rolle</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Std.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Abrechenbar</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Kunden</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {(teamHours ?? []).map((t: any) => (
                    <tr
                      key={t.member_key}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-2 font-medium">{t.member_name}</td>
                      <td className="p-2 text-muted">{t.role ?? "—"}</td>
                      <td className="p-2 text-right">{formatNumber(t.hours_month)}</td>
                      <td className="p-2 text-right text-accent-green">
                        {formatNumber(t.billable_hours_month)}
                      </td>
                      <td className="p-2 text-right">{formatNumber(t.clients_served)}</td>
                      <td className="p-2 text-right text-accent-red">
                        {formatEUR(t.total_cost_month)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============ DELIVERY COSTS ============ */}
        <div className="section-title">Letzte Delivery-Kosten</div>
        <div className="card">
          {(recentCosts ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              Keine Delivery-Kosten. Einträge über Airtable oder Supabase
              hinzufügen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Datum</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kunde</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Kategorie</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Beschreibung</th>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Beleg-Nr.</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentCosts ?? []).map((r: any) => {
                    const client = clientRows.find((c: any) => c.id === r.client_id);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="p-2 text-muted whitespace-nowrap">
                          {new Date(r.incurred_at).toLocaleDateString("de-DE")}
                        </td>
                        <td className="p-2">{client?.name ?? "—"}</td>
                        <td className="p-2 capitalize">{r.category}</td>
                        <td className="p-2 text-muted">{r.description ?? "—"}</td>
                        <td className="p-2 text-[10px] text-muted">{r.invoice_number ?? "—"}</td>
                        <td className="p-2 text-right font-semibold text-accent-red">
                          {formatEUR(r.amount)}
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
