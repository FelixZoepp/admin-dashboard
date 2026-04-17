// UStVA (Umsatzsteuer-Voranmeldung) XML export
// Officially Elster wants a very specific schema (ELSTER XML). This
// endpoint produces a portable XML with the standard "Kennzahlen",
// which any Steuerberater can drop into DATEV/Elster or process
// by hand in Elster-Online.
//
// Elster field numbers used (2025+):
//   81  Lieferungen / Leistungen zu 19%
//   86  Lieferungen / Leistungen zu 7%
//   66  Vorsteuer aus Rechnungen anderer Unternehmer
//   83  Verbleibende Umsatzsteuer-Vorauszahlung / Überschuss
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function xmlEscape(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month =
    searchParams.get("month") ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [year, mo] = month.split("-");
  const from = `${year}-${mo}-01`;
  const nextMonth = new Date(Number(year), Number(mo), 1); // first of next month
  const to = nextMonth.toISOString().slice(0, 10);

  const sb = await supabaseServer();

  const [{ data: invoices }, { data: expenses }, { data: deliveryCosts }, { data: recruitingCosts }] =
    await Promise.all([
      sb
        .from("invoices")
        .select("total, net, vat")
        .eq("status", "paid")
        .gte("invoice_date", from)
        .lt("invoice_date", to),
      sb
        .from("manual_expenses")
        .select("amount, net_amount, vat_amount, vat_rate")
        .gte("incurred_at", from)
        .lt("incurred_at", to),
      sb
        .from("delivery_costs")
        .select("amount, net_amount, vat_amount, vat_rate")
        .gte("incurred_at", from)
        .lt("incurred_at", to),
      sb
        .from("recruiting_costs")
        .select("amount, net_amount, vat_amount, vat_rate")
        .gte("incurred_at", from)
        .lt("incurred_at", to),
    ]);

  const inv19Net = (invoices ?? [])
    .filter((i: any) => Number(i.vat) > 0 && Number(i.net) > 0 && Math.abs(Number(i.vat) / Number(i.net) - 0.19) < 0.01)
    .reduce((s: number, i: any) => s + Number(i.net), 0);
  const inv7Net = (invoices ?? [])
    .filter((i: any) => Number(i.vat) > 0 && Number(i.net) > 0 && Math.abs(Number(i.vat) / Number(i.net) - 0.07) < 0.01)
    .reduce((s: number, i: any) => s + Number(i.net), 0);
  const ustCollected = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.vat ?? 0), 0);

  const allExpenses = [
    ...(expenses ?? []),
    ...(deliveryCosts ?? []),
    ...(recruitingCosts ?? []),
  ];
  const vorsteuer = allExpenses.reduce((s: number, e: any) => s + Number(e.vat_amount ?? 0), 0);

  const zahllast = ustCollected - vorsteuer;

  const fmt = (n: number) => n.toFixed(2);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UStVA version="1.0" zeitraum="${xmlEscape(month)}" erstellt="${new Date().toISOString()}">
  <Zeitraum>
    <Jahr>${xmlEscape(year)}</Jahr>
    <Monat>${xmlEscape(mo)}</Monat>
    <Von>${xmlEscape(from)}</Von>
    <Bis>${xmlEscape(to)}</Bis>
  </Zeitraum>
  <Kennzahlen>
    <Kennzahl nr="81" label="Lieferungen/Leistungen 19%" typ="netto">${fmt(inv19Net)}</Kennzahl>
    <Kennzahl nr="86" label="Lieferungen/Leistungen 7%"  typ="netto">${fmt(inv7Net)}</Kennzahl>
    <Kennzahl nr="66" label="Vorsteuer aus Rechnungen"   typ="vorsteuer">${fmt(vorsteuer)}</Kennzahl>
    <Kennzahl nr="83" label="Vorauszahlung / Erstattung" typ="zahllast">${fmt(zahllast)}</Kennzahl>
  </Kennzahlen>
  <Summen>
    <UmsatzsteuerGesamt>${fmt(ustCollected)}</UmsatzsteuerGesamt>
    <VorsteuerGesamt>${fmt(vorsteuer)}</VorsteuerGesamt>
    <Zahllast>${fmt(zahllast)}</Zahllast>
  </Summen>
  <Hinweis>Nicht-offizieller Elster-Export. Vom Steuerberater prüfen lassen, bevor sie an das Finanzamt übermittelt wird.</Hinweis>
</UStVA>
`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="ustva-${month}.xml"`,
    },
  });
}
