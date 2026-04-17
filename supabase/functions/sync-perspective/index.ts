// Sync Perspective funnels → landing_pages + lp_metrics_daily
// Docs: https://docs.perspective.co/api-reference
// Uses PERSPECTIVE_API_KEY (Bearer token from Perspective account settings).
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("perspective", async (db) => {
    const token = Deno.env.get("PERSPECTIVE_API_KEY");
    if (!token) throw new Error("PERSPECTIVE_API_KEY not set");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const base = "https://api.perspective.co/v1";

    // --- Funnels ---
    const fRes = await fetch(`${base}/funnels?limit=100`, { headers });
    if (!fRes.ok) throw new Error(`perspective funnels: ${fRes.status}`);
    const fJson = (await fRes.json()) as { data?: any[] };
    const funnels = (fJson.data ?? []) as any[];

    const pages = funnels.map((f) => ({
      id: String(f.id),
      platform: "perspective",
      name: f.name,
      url: f.url ?? f.published_url ?? null,
      status: f.status ?? (f.published ? "active" : "draft"),
      created_at: f.created_at,
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "landing_pages", pages);

    // --- Daily metrics for last 30 days per funnel ---
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const metrics: Record<string, unknown>[] = [];
    for (const f of funnels) {
      const r = await fetch(
        `${base}/funnels/${f.id}/analytics?start_date=${since}&interval=day`,
        { headers },
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: any[] };
      for (const d of (j.data ?? []) as any[]) {
        const views = Number(d.visits ?? d.views ?? 0);
        const leads = Number(d.leads ?? d.conversions ?? d.opt_ins ?? 0);
        metrics.push({
          page_id: String(f.id),
          metric_date: d.date,
          platform: "perspective",
          views,
          unique_visitors: Number(d.unique_visitors ?? d.visitors ?? views),
          opt_ins: leads,
          conversion_rate: views > 0 ? leads / views : null,
          synced_at: new Date().toISOString(),
        });
      }
    }
    rows += await upsertBatch(db, "lp_metrics_daily", metrics, "page_id,metric_date");
    return { rows, info: `funnels=${funnels.length} metrics=${metrics.length}` };
  });
});
