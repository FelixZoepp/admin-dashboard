// Sync LinkedIn Organization metrics + posts
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("linkedin", async (db) => {
    const token = Deno.env.get("LINKEDIN_ACCESS_TOKEN");
    const orgUrn = Deno.env.get("LINKEDIN_ORG_URN"); // e.g. urn:li:organization:12345
    if (!token || !orgUrn) throw new Error("LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORG_URN not set");

    const today = new Date().toISOString().slice(0, 10);
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202411",
    };

    // --- Follower count ---
    const encOrg = encodeURIComponent(orgUrn);
    const followerRes = await fetch(
      `https://api.linkedin.com/rest/networkSizes/${encOrg}?edgeType=CompanyFollowedByMember`,
      { headers },
    );
    const followers = followerRes.ok
      ? ((await followerRes.json()) as { firstDegreeSize: number }).firstDegreeSize
      : 0;

    // --- Organization page statistics (last day) ---
    const statsRes = await fetch(
      `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encOrg}`,
      { headers },
    );
    const statsJson = statsRes.ok ? ((await statsRes.json()) as any) : null;
    const totalPageViews =
      statsJson?.elements?.[0]?.totalPageStatistics?.views?.allPageViews?.pageViews ?? 0;

    // --- Share statistics aggregated (last 7 days) ---
    const since = Date.now() - 7 * 86400_000;
    const shareStatsRes = await fetch(
      `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encOrg}&timeIntervals=(timeRange:(start:${since},end:${Date.now()}),timeGranularityType:DAY)`,
      { headers },
    );
    const shareJson = shareStatsRes.ok ? ((await shareStatsRes.json()) as any) : null;
    const totalImpressions = (shareJson?.elements ?? []).reduce(
      (s: number, e: any) => s + (e.totalShareStatistics?.impressionCount ?? 0),
      0,
    );
    const totalEngagement = (shareJson?.elements ?? []).reduce(
      (s: number, e: any) =>
        s +
        (e.totalShareStatistics?.likeCount ?? 0) +
        (e.totalShareStatistics?.commentCount ?? 0) +
        (e.totalShareStatistics?.shareCount ?? 0),
      0,
    );

    const rows = await upsertBatch(
      db,
      "social_account_metrics_daily",
      [
        {
          platform: "linkedin",
          metric_date: today,
          followers,
          profile_views: totalPageViews,
          impressions: totalImpressions,
          reach: null,
          synced_at: new Date().toISOString(),
        },
      ],
      "platform,metric_date",
    );

    // Aggregated social_metrics_daily row (no post_id) — optional: per-post requires share IDs
    await db
      .from("social_metrics_daily")
      .upsert(
        [
          {
            post_id: `linkedin-agg-${today}`,
            platform: "linkedin",
            metric_date: today,
            impressions: totalImpressions,
            engagement: totalEngagement,
            synced_at: new Date().toISOString(),
          },
        ],
        { onConflict: "post_id,metric_date" },
      );
    await db
      .from("social_posts")
      .upsert(
        [
          {
            id: `linkedin-agg-${today}`,
            platform: "linkedin",
            post_type: "aggregate",
            permalink: null,
            caption: "Aggregated daily LinkedIn totals",
            published_at: new Date().toISOString(),
            synced_at: new Date().toISOString(),
          },
        ],
        { onConflict: "id" },
      );

    return {
      rows,
      info: `followers=${followers} imp=${totalImpressions} eng=${totalEngagement}`,
    };
  });
});
