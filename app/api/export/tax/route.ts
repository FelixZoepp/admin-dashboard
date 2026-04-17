// Export v_tax_ledger as CSV for tax preparation (Finanzamt / Steuerberater).
// Every income and expense row with date, reference, counterparty,
// category, amount, currency and extra notes.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const sb = await supabaseServer();
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");
  let q = sb.from("v_tax_ledger").select("*");
  if (from) q = q.gte("entry_date", from);
  if (to) q = q.lte("entry_date", to);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) {
    return new NextResponse("Datum,Typ,Quelle,Beleg,Gegenpartei,Kategorie,Betrag,Währung,Notiz\n", {
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  }

  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[,";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = "Datum,Typ,Quelle,Beleg,Gegenpartei,Kategorie,Betrag,Währung,Notiz";
  const lines = rows.map((r) =>
    [
      r.entry_date,
      r.type,
      r.source,
      r.reference,
      r.counterparty,
      r.category,
      r.amount,
      r.currency,
      r.extra,
    ]
      .map(esc)
      .join(","),
  );
  const csv = [header, ...lines].join("\n");

  const filename = `steuer-export-${from ?? "all"}-${to ?? new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
