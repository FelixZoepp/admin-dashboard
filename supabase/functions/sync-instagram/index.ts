// Sync Instagram Business Account via Meta Graph API
// Docs: https://developers.facebook.com/docs/instagram-api/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("instagram", async (db) => {
    const token = Deno.env.get("IG_ACCESS_TOKEN") ?? Deno.env.get("META_ACCESS_TOKEN");
    const igId = Deno.env.get("IG_BUSINESS_ACCOUNT_ID");
    if (!token || !igId) throw new Error("IG_ACCESS_TOKEN / IG_BUSINESS_ACCOUNT_ID not set");

    const today = new Date().toISOString().slice(0, 10);

    // --- Account metrics (followers, reach) ---
    const accRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}?fields=followers_count,media_count&access_token=${token}`,
    );
    if (!accRes.ok) throw new Error(`ig account: ${accRes.status}`);
    const acc = (await accRes.json()) as { followers_count: number; media_count: number };

    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}/insights?metric=reach,impressions,profile_views&period=day&access_token=${token}`,
    );
    const insJson = insightsRes.ok
      ? ((await insightsRes.json()) as { data: { name: string; values: { value: number }[] }[] })
      : { data: [] };
    const getMetric = (name: string) =>
      insJson.data.find((d) => d.name === name)?.values?.[0]?.value ?? 0;

    let rows = await upsertBatch(
      db,
      "social_account_metrics_daily",
      [
        {
          platform: "instagram",
          metric_date: today,
          followers: acc.followers_count,
          profile_views: getMetric("profile_views"),
          reach: getMetric("reach"),
          impressions: getMetric("impressions"),
          synced_at: new Date().toISOString(),
        },
      ],
      "platform,metric_date",
    );

    // --- Recent media + per-post metrics ---
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,permalink,timestamp&limit=50&access_token=${token}`,
    );
    if (!mediaRes.ok) return { rows, info: "no media" };
    const mediaJson = (await mediaRes.json()) as {
      data: { id: string; caption?: string; media_type: string; permalink: string; timestamp: string }[];
    };

    const posts = mediaJson.data.map((m) => ({
      id: m.id,
      platform: "instagram",
      post_type: m.media_type?.toLowerCase(),
      permalink: m.permalink,
      caption: m.caption?.slice(0, 2000) ?? null,
      published_at: m.timestamp,
      synced_at: new Date().toISOString(),
    }));
    rows += await upsertBatch(db, "social_posts", posts);

    const metrics: Record<string, unknown>[] = [];
    for (const m of mediaJson.data.slice(0, 25)) {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${m.id}/insights?metric=reach,impressions,likes,comments,saved,shares&access_token=${token}`,
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { data: { name: string; values: { value: number }[] }[] };
      const val = (n: string) => j.data.find((x) => x.name === n)?.values?.[0]?.value ?? 0;
      metrics.push({
        post_id: m.id,
        metric_date: today,
        platform: "instagram",
        impressions: val("impressions"),
        reach: val("reach"),
        likes: val("likes"),
        comments: val("comments"),
        saves: val("saved"),
        shares: val("shares"),
        engagement: val("likes") + val("comments") + val("saved") + val("shares"),
        synced_at: new Date().toISOString(),
      });
    }
    rows += await upsertBatch(db, "social_metrics_daily", metrics, "post_id,metric_date");

    return { rows, info: `posts=${posts.length} metrics=${metrics.length}` };
  });
});
