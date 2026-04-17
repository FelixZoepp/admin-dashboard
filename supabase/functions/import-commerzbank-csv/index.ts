// Import Commerzbank CSV export → bank_accounts + bank_transactions
// Commerzbank has no public REST API — German banking works via HBCI/FinTS or
// account aggregators (FinAPI, Tink). For MVP we accept a CSV export the user
// downloads from the Commerzbank online banking portal.
//
// Expected CSV format (Commerzbank "Umsätze" export, semicolon-separated):
//   Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;Auftraggeberkonto;IBAN Auftraggeberkonto;Saldo nach Buchung
//
// POST this Edge Function a JSON body { csv: "<raw csv content>" }.
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

function parseGermanNumber(s: string): number {
  return Number((s ?? "").replace(/\./g, "").replace(",", ".")) || 0;
}

function parseDate(s: string): string | null {
  // Format DD.MM.YYYY
  const m = s?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(";").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }
  const body = (await req.json().catch(() => ({}))) as { csv?: string; iban?: string };
  if (!body.csv) {
    return Response.json({ error: "missing csv field" }, { status: 400 });
  }

  return withSyncRun("commerzbank", async (db) => {
    const rows = parseCsv(body.csv!);

    // Derive/ensure account
    const firstIban = body.iban ?? rows[0]?.["IBAN Auftraggeberkonto"] ?? "commerzbank-main";
    const accountId = `commerzbank-${firstIban.replace(/\s+/g, "")}`;

    // Compute latest saldo (last row's "Saldo nach Buchung")
    const latestSaldo = rows
      .map((r) => parseGermanNumber(r["Saldo nach Buchung"] ?? ""))
      .filter((n) => !Number.isNaN(n))
      .pop() ?? 0;

    await upsertBatch(
      db,
      "bank_accounts",
      [
        {
          id: accountId,
          name: "Commerzbank",
          iban: firstIban,
          balance: latestSaldo,
          currency: "EUR",
          institution: "commerzbank",
          source: "csv",
          synced_at: new Date().toISOString(),
        },
      ],
    );

    const txOut: Record<string, unknown>[] = [];
    for (const r of rows) {
      const date = parseDate(r["Buchungstag"] ?? "");
      const amount = parseGermanNumber(r["Betrag"] ?? "");
      if (!date) continue;
      const hash = `cb-${accountId}-${date}-${amount.toFixed(2)}-${(r["Buchungstext"] ?? "").slice(0, 32)}`;
      txOut.push({
        id: hash,
        account_id: accountId,
        institution: "commerzbank",
        amount,
        currency: r["Währung"] || "EUR",
        label: r["Buchungstext"] ?? null,
        counterparty: null,
        category: r["Umsatzart"] ?? null,
        tx_date: date,
        settled_at: date,
        direction: amount >= 0 ? "in" : "out",
        synced_at: new Date().toISOString(),
      });
    }
    const inserted = await upsertBatch(db, "bank_transactions", txOut);
    return { rows: inserted, info: `tx=${inserted} saldo=${latestSaldo}` };
  });
});
