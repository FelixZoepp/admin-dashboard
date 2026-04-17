// Sync Meta (Facebook / Instagram) Ads → ad_campaigns + ad_metrics_daily
// Docs: https://developers.facebook.com/docs/marketing-api/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("meta", async (db) => {
    const token = Deno.env.get("META_ACCESS_TOKEN");
    const accountId = Deno.env.get("META_AD_ACCOUNT_ID");
    if (!token || !accountId) throw new Error("META_ACCESS_TOKEN / META_AD_ACCOUNT_ID not set");

    const base = `https://graph.facebook.com/v21.0/act_${accountId}`;

    // --- Campaigns ---
    const cRes = await fetch(
      `${base}/campaigns?fields=id,name,objective,status,daily_budget&limit=500&access_token=${token}`,
    );
    if (!cRes.ok) throw new Error(`meta campaigns: ${cRes.status}`);
    const cJson = (await cRes.json()) as {
      data: { id: string; name: string; objective: string; status: string; daily_budget: string }[];
    };
    const campaigns = cJson.data.map((c) => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      synced_at: new Date().toISOString(),
    }));
    let rows = await upsertBatch(db, "ad_campaigns", campaigns);

    // --- Insights per campaign, last 30 days daily ---
    const metricsOut: Record<string, unknown>[] = [];
    for (const c of campaigns) {
      const iRes = await fetch(
        `https://graph.facebook.com/v21.0/${c.id}/insights?` +
          `time_increment=1&date_preset=last_30d&` +
          `fields=impressions,clicks,spend,actions,ctr,cpm&` +
          `access_token=${token}`,
      );
      if (!iRes.ok) continue;
      const iJson = (await iRes.json()) as {
        data: {
          date_start: string;
          impressions: string;
          clicks: string;
          spend: string;
          ctr: string;
          cpm: string;
          actions?: { action_type: string; value: string }[];
        }[];
      };
      for (const m of iJson.data) {
        const leads =
          m.actions?.find((a) => a.action_type === "lead")?.value ??
          m.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_lead")?.value ??
          "0";
        const spend = Number(m.spend ?? 0);
        metricsOut.push({
          campaign_id: c.id,
          metric_date: m.date_start,
          impressions: Number(m.impressions ?? 0),
          clicks: Number(m.clicks ?? 0),
          spend,
          leads: Number(leads),
          ctr: Number(m.ctr ?? 0),
          cpm: Number(m.cpm ?? 0),
          cpl: Number(leads) > 0 ? spend / Number(leads) : null,
          synced_at: new Date().toISOString(),
        });
      }
    }
    rows += await upsertBatch(db, "ad_metrics_daily", metricsOut, "campaign_id,metric_date");

    return { rows, info: `campaigns=${campaigns.length} metrics=${metricsOut.length}` };
  });
});
