// Qonto webhook receiver (transactions)
// In Qonto: Settings → Integrations → Webhooks → POST to
//   https://<project>.supabase.co/functions/v1/webhook-qonto
// Trigger: transaction.created or transaction.updated
import { dbAdmin } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const secret = Deno.env.get("QONTO_WEBHOOK_SECRET");
  if (secret) {
    if ((req.headers.get("x-qonto-signature") ?? "") !== secret) {
      return new Response("bad secret", { status: 401 });
    }
  }

  const body = (await req.json()) as any;
  const t = body.transaction ?? body;
  if (!t?.id) return Response.json({ ok: true, ignored: true });

  const db = dbAdmin();
  try {
    await db.from("bank_transactions").upsert({
      id: t.id,
      account_id: t.bank_account_id ?? t.account_id,
      institution: "qonto",
      amount: t.amount,
      currency: t.currency ?? "EUR",
      label: t.label,
      counterparty: t.counterparty_name ?? null,
      category: t.category ?? null,
      tx_date: (t.emitted_at ?? new Date().toISOString()).slice(0, 10),
      settled_at: t.settled_at,
      direction: Number(t.amount) >= 0 ? "in" : "out",
      synced_at: new Date().toISOString(),
    });

    // auto_match_bank_to_invoice trigger handles the reconciliation.

    await db.from("sync_runs").insert({
      source: "qonto_webhook",
      status: "success",
      rows_processed: 1,
      message: `tx ${t.id}`,
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
