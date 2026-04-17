// Sync Instantly → outreach_campaigns, outreach_leads, outreach_metrics_daily
// Docs: https://developer.instantly.ai/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("instantly", async (db) => {
    const apiKey = Deno.env.get("INSTANTLY_API_KEY");
    if (!apiKey) throw new Error("INSTANTLY_API_KEY not set");

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const base = "https://api.instantly.ai/api/v2";

    // --- Campaigns ---
    const campRes = await fetch(`${base}/campaigns?limit=100`, { headers });
    if (!campRes.ok) throw new Error(`instantly campaigns: ${campRes.status}`);
    const campJson = (await campRes.json()) as { items: Record<string, unknown>[] };

    const campaigns = (campJson.items ?? []).map((c: any) => ({
      id: String(c.id),
      name: c.name,
      status:
        c.status === 1 ? "active" : c.status === 2 ? "paused" : c.status === 3 ? "completed" : "draft",
      daily_limit: c.daily_limit ?? null,
      created_at: c.timestamp_created,
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "outreach_campaigns", campaigns);

    // --- Leads (last 30 days updated) ---
    const leadsOut: Record<string, unknown>[] = [];
    for (const c of campaigns) {
      let skip = 0;
      while (true) {
        const r = await fetch(`${base}/leads/list`, {
          method: "POST",
          headers,
          body: JSON.stringify({ campaign_id: c.id, limit: 100, skip }),
        });
        if (!r.ok) break;
        const j = (await r.json()) as { data?: Record<string, unknown>[] };
        const items = j.data ?? [];
        if (items.length === 0) break;
        for (const l of items as any[]) {
          const status =
            l.status_summary?.replied > 0 ? "replied" :
            l.status_summary?.opened > 0 ? "opened" :
            l.status_summary?.bounced > 0 ? "bounced" :
            l.status_summary?.unsubscribed > 0 ? "unsubscribed" :
            l.status_summary?.contacted > 0 ? "contacted" : "pending";
          leadsOut.push({
            id: String(l.id),
            campaign_id: c.id,
            email: l.email,
            first_name: l.first_name,
            last_name: l.last_name,
            company: l.company_name,
            status,
            last_contacted_at: l.timestamp_last_contacted ?? null,
            synced_at: new Date().toISOString(),
          });
        }
        if (items.length < 100) break;
        skip += 100;
        if (skip > 2000) break; // safety
      }
    }
    rows += await upsertBatch(db, "outreach_leads", leadsOut);

    // --- Daily metrics (per campaign, last 30 days) ---
    const metricsOut: Record<string, unknown>[] = [];
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    for (const c of campaigns) {
      const r = await fetch(
        `${base}/campaigns/${c.id}/analytics/daily?start_date=${since}`,
        { headers },
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: Record<string, unknown>[] };
      for (const d of (j.data ?? []) as any[]) {
        metricsOut.push({
          campaign_id: c.id,
          metric_date: d.date,
          sent: d.emails_sent ?? d.sent ?? 0,
          opened: d.emails_opened ?? d.opened ?? 0,
          replied: d.emails_replied ?? d.replied ?? 0,
          bounced: d.emails_bounced ?? d.bounced ?? 0,
          unsubscribed: d.emails_unsubscribed ?? d.unsubscribed ?? 0,
          positive_replies: d.positive_replies ?? 0,
          synced_at: new Date().toISOString(),
        });
      }
    }
    rows += await upsertBatch(db, "outreach_metrics_daily", metricsOut, "campaign_id,metric_date");

    return {
      rows,
      info: `campaigns=${campaigns.length} leads=${leadsOut.length} metrics=${metricsOut.length}`,
    };
  });
});
