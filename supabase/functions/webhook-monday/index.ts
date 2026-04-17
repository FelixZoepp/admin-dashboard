// Monday.com webhook receiver
// In Monday: Board → Integrations → Webhook → Custom URL
//   https://<project>.supabase.co/functions/v1/webhook-monday
// Monday sends a challenge on subscription — we echo it back.
import { dbAdmin } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const body = (await req.json().catch(() => ({}))) as any;

  // Subscription verification
  if (body.challenge) {
    return Response.json({ challenge: body.challenge });
  }

  const db = dbAdmin();
  const ev = body.event;
  if (!ev) return Response.json({ ok: true, ignored: true });

  try {
    if (ev.type === "create_pulse" || ev.type === "update_column_value" || ev.type === "update_name") {
      const statusMap: Record<string, string> = {
        done: "done", erledigt: "done",
        "in progress": "in_progress", "in arbeit": "in_progress",
        working: "in_progress",
        open: "open", offen: "open", stuck: "open",
      };
      const statusText = (ev.value?.label?.text ?? ev.value?.text ?? "").toLowerCase();
      const status = statusMap[statusText] ?? "open";

      await db.from("fulfillment_items").upsert({
        id: String(ev.pulseId ?? ev.itemId),
        board_id: String(ev.boardId),
        name: ev.pulseName ?? ev.itemName ?? "",
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
        synced_at: new Date().toISOString(),
      });
    }

    await db.from("sync_runs").insert({
      source: "monday_webhook",
      status: "success",
      rows_processed: 1,
      message: ev.type,
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
