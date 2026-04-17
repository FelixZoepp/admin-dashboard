// Sync OnePage landing pages → landing_pages + lp_metrics_daily
// Note: multiple tools are branded "OnePage". This expects a REST API at
// ONEPAGE_API_BASE with a Bearer-Token in ONEPAGE_API_KEY.
// If your provider uses different auth, adjust headers below.
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("onepage", async (db) => {
    const token = Deno.env.get("ONEPAGE_API_KEY");
    const base = Deno.env.get("ONEPAGE_API_BASE") ?? "https://api.onepage.io/v1";
    if (!token) throw new Error("ONEPAGE_API_KEY not set");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // --- Pages ---
    const pRes = await fetch(`${base}/pages?limit=100`, { headers });
    if (!pRes.ok) throw new Error(`onepage pages: ${pRes.status}`);
    const pJson = (await pRes.json()) as { data?: any[] };
    const onepagePages = (pJson.data ?? []) as any[];

    const pages = onepagePages.map((p) => ({
      id: String(p.id),
      platform: "onepage",
      name: p.name ?? p.title,
      url: p.url ?? p.published_url ?? null,
      status: p.status ?? (p.published ? "active" : "draft"),
      created_at: p.created_at,
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "landing_pages", pages);

    // --- Daily analytics ---
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const metrics: Record<string, unknown>[] = [];
    for (const p of onepagePages) {
      const r = await fetch(
        `${base}/pages/${p.id}/analytics?start_date=${since}&interval=day`,
        { headers },
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: any[] };
      for (const d of (j.data ?? []) as any[]) {
        const views = Number(d.views ?? d.pageviews ?? 0);
        const leads = Number(d.leads ?? d.submissions ?? d.conversions ?? 0);
        metrics.push({
          page_id: String(p.id),
          metric_date: d.date,
          platform: "onepage",
          views,
          unique_visitors: Number(d.unique_visitors ?? views),
          opt_ins: leads,
          conversion_rate: views > 0 ? leads / views : null,
          synced_at: new Date().toISOString(),
        });
      }
    }
    rows += await upsertBatch(db, "lp_metrics_daily", metrics, "page_id,metric_date");
    return { rows, info: `pages=${onepagePages.length} metrics=${metrics.length}` };
  });
});
