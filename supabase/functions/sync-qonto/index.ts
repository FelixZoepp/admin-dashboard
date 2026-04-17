// Sync Qonto → bank_accounts + bank_transactions
// Docs: https://api-doc.qonto.com/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("qonto", async (db) => {
    const login = Deno.env.get("QONTO_LOGIN");
    const secret = Deno.env.get("QONTO_SECRET_KEY");
    if (!login || !secret) throw new Error("QONTO_LOGIN / QONTO_SECRET_KEY not set");

    const headers = {
      Authorization: `${login}:${secret}`,
      "Content-Type": "application/json",
    };

    // --- Organization / accounts ---
    const orgRes = await fetch("https://thirdparty.qonto.com/v2/organization", { headers });
    if (!orgRes.ok) throw new Error(`qonto org: ${orgRes.status}`);
    const { organization } = (await orgRes.json()) as {
      organization: { bank_accounts: { id: string; slug: string; name: string; iban: string; balance: number; currency: string }[] };
    };

    const accounts = organization.bank_accounts.map((a) => ({
      id: a.id,
      name: a.name ?? a.slug,
      iban: a.iban,
      balance: a.balance,
      currency: a.currency ?? "EUR",
      institution: "qonto",
      source: "api",
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "bank_accounts", accounts);

    // --- Transactions (last 60 days per account) ---
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();
    const txOut: Record<string, unknown>[] = [];
    for (const a of organization.bank_accounts) {
      let next: string | null = `https://thirdparty.qonto.com/v2/transactions?slug=${a.slug}&settled_at_from=${since}&per_page=100`;
      while (next) {
        const r: Response = await fetch(next, { headers });
        if (!r.ok) break;
        const json = (await r.json()) as {
          transactions: {
            id: string;
            amount: number;
            currency: string;
            label: string;
            counterparty_name?: string;
            category?: string;
            emitted_at: string;
            settled_at: string;
          }[];
          meta?: { next_page?: string | null };
        };
        for (const t of json.transactions) {
          txOut.push({
            id: t.id,
            account_id: a.id,
            institution: "qonto",
            amount: t.amount,
            currency: t.currency,
            label: t.label,
            counterparty: t.counterparty_name ?? null,
            category: t.category ?? null,
            tx_date: t.emitted_at?.slice(0, 10),
            settled_at: t.settled_at,
            direction: t.amount >= 0 ? "in" : "out",
            synced_at: new Date().toISOString(),
          });
        }
        next = json.meta?.next_page ?? null;
      }
    }
    rows += await upsertBatch(db, "bank_transactions", txOut);

    return { rows, info: `accounts=${accounts.length} tx=${txOut.length}` };
  });
});
