import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ChartBars } from "@/components/ChartBars";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type Period = "daily" | "weekly" | "monthly";

export default async function Steuer(props: {
  searchParams?: Promise<{ period?: Period }>;
} = {}) {
  const params = props.searchParams ? await props.searchParams : {};
  const period: Period = params.period ?? "monthly";
  const sb = await supabaseServer();

  const view =
    period === "daily"
      ? { vat: "v_vat_daily", out: "v_outflows_daily" }
      : period === "weekly"
        ? { vat: "v_vat_weekly", out: "v_outflows_weekly" }
        : { vat: "v_vat_monthly", out: "v_outflows_monthly" };

  const [{ data: reserves }, { data: vatRows }, { data: outRows }, { data: settings }] =
    await Promise.all([
      sb.from("v_tax_reserves").select("*").single(),
      sb.from(view.vat).select("*"),
      sb.from(view.out).select("*"),
      sb.from("tax_settings").select("*").single(),
    ]);

  const vr = (vatRows ?? []) as any[];
  const or_ = (outRows ?? []) as any[];

  const labelFor = (r: any) =>
    period === "daily"
      ? new Date(r.day).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
      : period === "weekly"
        ? `KW${r.week}`
        : r.label;

  const totalVat = vr.reduce(
    (acc, r) => ({
      ust: acc.ust + Number(r.ust_eingenommen ?? 0),
      vst: acc.vst + Number(r.vorsteuer ?? 0),
      umsatz: acc.umsatz + Number(r.umsatz_brutto ?? 0),
    }),
    { ust: 0, vst: 0, umsatz: 0 },
  );

  const totalOut = or_.reduce((s, r) => {
    const bank = Number(r.bank_out ?? 0);
    const delivery = Number(r.delivery_out ?? 0);
    const manual = Number(r.manual_out ?? 0);
    const recruiting = Number(r.recruiting_out ?? 0);
    return {
      bank: s.bank + bank,
      delivery: s.delivery + delivery,
      manual: s.manual + manual,
      recruiting: s.recruiting + recruiting,
      total: s.total + bank + delivery + manual + recruiting,
    };
  }, { bank: 0, delivery: 0, manual: 0, recruiting: 0, total: 0 });

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="finanzen" />

        <div className="section-title">
          <span>🧮</span> Steuern &amp; Rücklagen
        </div>

        {/* ============ Period toggle ============ */}
        <div className="flex gap-2 mb-4">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <Link
              key={p}
              href={`/steuer?period=${p}`}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                period === p
                  ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                  : "border-border text-muted hover:border-accent-blue hover:text-accent-blue"
              }`}
            >
              {p === "daily" ? "Täglich" : p === "weekly" ? "Wöchentlich" : "Monatlich"}
            </Link>
          ))}
        </div>

        {/* ============ KPIs ============ */}
        <KpiGrid>
          <KpiCard
            label="USt-Zahllast MTD"
            value={formatEUR(reserves?.ust_zahllast_mtd)}
            sub={`USt eingenommen ${formatEUR(reserves?.ust_eingenommen_mtd)} − VSt ${formatEUR(reserves?.vorsteuer_mtd)}`}
            valueClass={(reserves?.ust_zahllast_mtd ?? 0) > 0 ? "text-accent-red" : "text-accent-green"}
          />
          <KpiCard
            label="Ertragsteuer-Rücklage YTD"
            value={formatEUR(reserves?.ertragsteuer_ruecklage_ytd)}
            sub={`${formatPercent(
              (settings?.reserve_pct_income_tax ?? 0) + (settings?.reserve_pct_gewerbesteuer ?? 0),
              0,
            )} vom Gewinn`}
            valueClass="text-accent-yellow"
          />
          <KpiCard
            label="Gewinn YTD"
            value={formatEUR(reserves?.profit_ytd)}
            sub={`Umsatz ${formatEUR(reserves?.net_revenue_ytd)} − Kosten ${formatEUR(reserves?.net_costs_ytd)}`}
            valueClass={(reserves?.profit_ytd ?? 0) >= 0 ? "text-accent-green" : "text-accent-red"}
          />
          <KpiCard
            label="Zurücklegen gesamt"
            value={formatEUR(
              (reserves?.ust_zahllast_mtd ?? 0) + (reserves?.ertragsteuer_ruecklage_ytd ?? 0),
            )}
            sub="USt + Ertragsteuer"
            valueClass="text-accent-red"
          />
        </KpiGrid>

        <div className="card mb-4 text-[11px] text-muted">
          {settings?.gmbh
            ? "Modus: GmbH — Körperschaftsteuer + Soli + Gewerbesteuer ≈ 30% vom Gewinn."
            : `Modus: ${settings?.is_regelbesteuerer ? "Regelbesteuerer" : "Kleinunternehmer"} · Einkommensteuer-Rücklage ${formatPercent(settings?.reserve_pct_income_tax, 0)} · Gewerbesteuer-Rücklage ${formatPercent(settings?.reserve_pct_gewerbesteuer, 0)}.`}
          {" "}Werte anpassen in <code>tax_settings</code> (Supabase).
        </div>

        {/* ============ VAT timeline ============ */}
        <div className="section-title">
          USt-Verlauf —{" "}
          {period === "daily" ? "30 Tage" : period === "weekly" ? "12 Wochen" : "12 Monate"}
        </div>
        <ChartBars
          bars={vr.map((r, i) => ({
            label: labelFor(r),
            value: Math.max(0, Number(r.ust_eingenommen ?? 0) - Number(r.vorsteuer ?? 0)),
            highlight: i === vr.length - 1,
          }))}
          format={(v) => formatEUR(v)}
        />

        {/* ============ VAT table ============ */}
        <div className="section-title">Umsatzsteuer-Details</div>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary border-b-2 border-border">
                <tr>
                  <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">
                    {period === "daily" ? "Tag" : period === "weekly" ? "Woche" : "Monat"}
                  </th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Umsatz brutto</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">USt eingenommen</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Vorsteuer</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Zahllast</th>
                </tr>
              </thead>
              <tbody>
                {vr.map((r, i) => {
                  const zahllast = Number(r.ust_eingenommen ?? 0) - Number(r.vorsteuer ?? 0);
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-2">{labelFor(r)}</td>
                      <td className="p-2 text-right">{formatEUR(r.umsatz_brutto)}</td>
                      <td className="p-2 text-right text-accent-green">{formatEUR(r.ust_eingenommen)}</td>
                      <td className="p-2 text-right text-accent-blue">{formatEUR(r.vorsteuer)}</td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          zahllast >= 0 ? "text-accent-red" : "text-accent-green"
                        }`}
                      >
                        {formatEUR(zahllast)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-bg-tertiary font-semibold">
                  <td className="p-2">Summe</td>
                  <td className="p-2 text-right">{formatEUR(totalVat.umsatz)}</td>
                  <td className="p-2 text-right text-accent-green">{formatEUR(totalVat.ust)}</td>
                  <td className="p-2 text-right text-accent-blue">{formatEUR(totalVat.vst)}</td>
                  <td
                    className={`p-2 text-right ${
                      totalVat.ust - totalVat.vst >= 0 ? "text-accent-red" : "text-accent-green"
                    }`}
                  >
                    {formatEUR(totalVat.ust - totalVat.vst)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ============ Outflows ============ */}
        <div className="section-title">
          Zahlungsausgänge —{" "}
          {period === "daily" ? "30 Tage" : period === "weekly" ? "12 Wochen" : "12 Monate"}
        </div>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary border-b-2 border-border">
                <tr>
                  <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">
                    {period === "daily" ? "Tag" : period === "weekly" ? "Woche" : "Monat"}
                  </th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Bank</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Delivery</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Manuell</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Recruiting</th>
                  <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Summe</th>
                </tr>
              </thead>
              <tbody>
                {or_.map((r, i) => {
                  const sum =
                    Number(r.bank_out ?? 0) +
                    Number(r.delivery_out ?? 0) +
                    Number(r.manual_out ?? 0) +
                    Number(r.recruiting_out ?? 0);
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-2">{labelFor(r)}</td>
                      <td className="p-2 text-right">{formatEUR(r.bank_out)}</td>
                      <td className="p-2 text-right">{formatEUR(r.delivery_out)}</td>
                      <td className="p-2 text-right">{formatEUR(r.manual_out)}</td>
                      <td className="p-2 text-right">{formatEUR(r.recruiting_out)}</td>
                      <td className="p-2 text-right font-semibold text-accent-red">{formatEUR(sum)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-bg-tertiary font-semibold">
                  <td className="p-2">Summe</td>
                  <td className="p-2 text-right">{formatEUR(totalOut.bank)}</td>
                  <td className="p-2 text-right">{formatEUR(totalOut.delivery)}</td>
                  <td className="p-2 text-right">{formatEUR(totalOut.manual)}</td>
                  <td className="p-2 text-right">{formatEUR(totalOut.recruiting)}</td>
                  <td className="p-2 text-right text-accent-red">{formatEUR(totalOut.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-title">Steuer-Export für Steuerberater</div>
        <div className="card flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">CSV mit allen Einnahmen + Ausgaben</div>
            <div className="text-[11px] text-muted">
              Jede Zeile: Datum · Typ · Beleg · Gegenpartei · Kategorie · Betrag ·
              Währung. Bereit für DATEV / Elster / Steuerberater.
            </div>
          </div>
          <a
            href="/api/export/tax"
            className="text-xs px-3 py-1.5 rounded border border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10 whitespace-nowrap"
          >
            Steuer-Export
          </a>
        </div>
      </main>
    </>
  );
}
