// Instantly webhook receiver (reply/open/bounce events).
// In Instantly: Settings → Webhooks → add endpoint
//   https://<project>.supabase.co/functions/v1/webhook-instantly
import { dbAdmin } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const secret = Deno.env.get("INSTANTLY_WEBHOOK_SECRET");
  if (secret) {
    const provided = req.headers.get("x-instantly-signature") ?? "";
    if (provided !== secret) return new Response("bad secret", { status: 401 });
  }

  const payload = (await req.json()) as any;
  const { event_type, campaign_id, lead_email, lead_id, timestamp } = payload;
  const db = dbAdmin();

  const today = (timestamp ?? new Date().toISOString()).slice(0, 10);

  try {
    // Increment today's metric for the campaign based on event_type
    const increments: Record<string, Record<string, number>> = {
      email_sent:     { sent: 1 },
      email_opened:   { opened: 1 },
      email_replied:  { replied: 1 },
      email_bounced:  { bounced: 1 },
      email_unsubscribed: { unsubscribed: 1 },
      reply_positive: { positive_replies: 1 },
    };
    const inc = increments[event_type];
    if (inc && campaign_id) {
      // Fetch existing row
      const { data: existing } = await db
        .from("outreach_metrics_daily")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("metric_date", today)
        .maybeSingle();

      const merged = {
        campaign_id,
        metric_date: today,
        sent:              (existing?.sent              ?? 0) + (inc.sent              ?? 0),
        opened:            (existing?.opened            ?? 0) + (inc.opened            ?? 0),
        replied:           (existing?.replied           ?? 0) + (inc.replied           ?? 0),
        bounced:           (existing?.bounced           ?? 0) + (inc.bounced           ?? 0),
        unsubscribed:      (existing?.unsubscribed      ?? 0) + (inc.unsubscribed      ?? 0),
        positive_replies:  (existing?.positive_replies  ?? 0) + (inc.positive_replies  ?? 0),
        synced_at: new Date().toISOString(),
      };
      await db
        .from("outreach_metrics_daily")
        .upsert(merged, { onConflict: "campaign_id,metric_date" });
    }

    // Update lead status if we have one
    if (lead_id) {
      const statusMap: Record<string, string> = {
        email_replied: "replied",
        email_opened: "opened",
        email_bounced: "bounced",
        email_unsubscribed: "unsubscribed",
        email_sent: "contacted",
      };
      const status = statusMap[event_type];
      if (status) {
        await db.from("outreach_leads").update({
          status,
          last_contacted_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        }).eq("id", lead_id);
      }
    }

    await db.from("sync_runs").insert({
      source: "instantly_webhook",
      status: "success",
      rows_processed: 1,
      message: event_type,
      finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
