// Sync CopeCart → copecart_products + copecart_sales
// Docs: https://dev.copecart.com/
// Auth: COPECART_API_KEY (Bearer)
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("copecart", async (db) => {
    const key = Deno.env.get("COPECART_API_KEY");
    if (!key) throw new Error("COPECART_API_KEY not set");

    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    const base = "https://api.copecart.com/v1";

    // --- Products ---
    const pRes = await fetch(`${base}/products?per_page=100`, { headers });
    if (!pRes.ok) throw new Error(`copecart products: ${pRes.status}`);
    const pJson = (await pRes.json()) as { data?: any[] };
    const products = (pJson.data ?? []) as any[];
    const productsOut = products.map((p) => ({
      id: String(p.id),
      name: p.name ?? p.title,
      price_gross: Number(p.price_gross ?? p.price ?? 0),
      currency: p.currency ?? "EUR",
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "copecart_products", productsOut);

    // --- Sales (last 90 days) ---
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const salesOut: Record<string, unknown>[] = [];
    let page = 1;
    while (true) {
      const r = await fetch(
        `${base}/orders?per_page=100&page=${page}&created_from=${since}`,
        { headers },
      );
      if (!r.ok) break;
      const j = (await r.json()) as { data?: any[]; meta?: { last_page?: number } };
      for (const o of (j.data ?? []) as any[]) {
        salesOut.push({
          id: String(o.id),
          product_id: o.product_id ? String(o.product_id) : null,
          buyer_email: o.buyer?.email ?? o.email ?? null,
          amount: Number(o.amount_gross ?? o.amount ?? 0),
          currency: o.currency ?? "EUR",
          status: o.status ?? "paid",
          source: o.affiliate_id ?? o.source ?? null,
          sold_at: o.created_at,
          synced_at: new Date().toISOString(),
        });
      }
      if (!j.meta?.last_page || page >= j.meta.last_page) break;
      page += 1;
    }
    rows += await upsertBatch(db, "copecart_sales", salesOut);

    return { rows, info: `products=${productsOut.length} sales=${salesOut.length}` };
  });
});
