// Sync Easybill invoices → invoices
// Docs: https://www.easybill.de/api/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

type EBDocument = {
  id: number | string;
  number: string;
  document_date: string;
  due_date: string | null;
  paid_date: string | null;
  grand_total_gross: number;
  grand_total_net: number;
  grand_total_vat: number;
  customer_name: string;
  customer_id: string | number | null;
  status: string;
  is_draft: boolean;
};

const STATUS_MAP: Record<string, string> = {
  paid: "paid",
  open: "open",
  overdue: "overdue",
  draft: "draft",
  cancelled: "cancelled",
};

Deno.serve(async () => {
  return withSyncRun("easybill", async (db) => {
    const key = Deno.env.get("EASYBILL_API_KEY");
    if (!key) throw new Error("EASYBILL_API_KEY not set");

    const headers = {
      Authorization: `Bearer ${key}`,
      Accept: "application/vnd.easybill.v1+json",
    };

    const out: Record<string, unknown>[] = [];
    let page = 1;
    while (true) {
      const url = new URL("https://api.easybill.de/rest/v1/documents");
      url.searchParams.set("limit", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("type", "INVOICE");
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`easybill ${r.status}`);
      const json = (await r.json()) as { items: EBDocument[]; pages: number };
      for (const d of json.items) {
        out.push({
          id: String(d.id),
          number: d.number,
          customer_name: d.customer_name,
          customer_id: d.customer_id ? String(d.customer_id) : null,
          total: d.grand_total_gross,
          net: d.grand_total_net,
          vat: d.grand_total_vat,
          status:
            STATUS_MAP[(d.status ?? "").toLowerCase()] ??
            (d.is_draft ? "draft" : "open"),
          invoice_date: d.document_date,
          due_date: d.due_date,
          paid_at: d.paid_date,
          currency: "EUR",
          synced_at: new Date().toISOString(),
        });
      }
      if (page >= (json.pages ?? 1)) break;
      page += 1;
    }

    const rows = await upsertBatch(db, "invoices", out);
    return { rows, info: `invoices=${out.length}` };
  });
});
