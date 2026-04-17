// Close CRM webhook receiver
// Configure in Close: Settings → Webhooks → new subscription for events:
//   lead.created, lead.updated, opportunity.created, opportunity.updated,
//   activity.created
// Set URL to: https://<project>.supabase.co/functions/v1/webhook-close
// Set secret in Close AND in CLOSE_WEBHOOK_SECRET.
import { dbAdmin } from "../_shared/db.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get("CLOSE_WEBHOOK_SECRET");
  if (!secret) return true; // skip verification if not configured
  const sig = req.headers.get("close-sig-hash");
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(sig, hex);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const body = await req.text();
  if (!(await verifySignature(req, body))) {
    return new Response("bad signature", { status: 401 });
  }

  const event = JSON.parse(body) as { event: { action: string; object_type: string; data: any } };
  const { action, object_type, data } = event.event;
  const db = dbAdmin();

  try {
    if (object_type === "lead") {
      await db.from("leads").upsert({
        id: data.id,
        name: data.display_name ?? data.name ?? "—",
        status: data.status_label,
        owner: data.created_by_name,
        custom: data.custom ?? {},
        created_at: data.date_created,
        updated_at: data.date_updated,
        synced_at: new Date().toISOString(),
      });
    } else if (object_type === "opportunity") {
      await db.from("opportunities").upsert({
        id: data.id,
        lead_id: data.lead_id,
        lead_name: data.lead_name,
        stage: data.status_label,
        value: Number(data.value ?? 0) / 100,
        currency: data.value_currency ?? "EUR",
        owner: data.user_name,
        status: data.status_type,
        won_at: data.date_won,
        lost_at: data.date_lost,
        created_at: data.date_created,
        updated_at: data.date_updated,
        synced_at: new Date().toISOString(),
      });
    } else if (object_type === "activity") {
      await db.from("activities").upsert({
        id: data.id,
        lead_id: data.lead_id,
        type: data._type ?? "activity",
        direction: data.direction,
        outcome: data.disposition ?? data.status,
        user_name: data.user_name,
        occurred_at: data.date_created,
        duration_seconds: data.duration,
        synced_at: new Date().toISOString(),
      });
    }

    await db.from("sync_runs").insert({
      source: "close_webhook",
      status: "success",
      rows_processed: 1,
      message: `${object_type}.${action}`,
      finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("sync_runs").insert({
      source: "close_webhook",
      status: "error",
      message,
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
