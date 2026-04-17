// Daily digest — posts MRR delta, new Won deals, overdue invoices,
// sync errors, contracts in overage, critical clients to Slack
// (if SLACK_WEBHOOK_URL is set) and to email via Resend (if
// RESEND_API_KEY + DIGEST_EMAIL are set).
//
// Scheduled via pg_cron at 07:00 UTC (see migration ...014_cron_digest.sql)
import { dbAdmin } from "../_shared/db.ts";

function eur(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

Deno.serve(async () => {
  const db = dbAdmin();
  const { data: snap } = await db.from("v_daily_digest").select("*").single();
  if (!snap) return Response.json({ ok: false, error: "no digest data" });

  const lines = [
    `*Content Leads — Daily Digest (${new Date().toLocaleDateString("de-DE")})*`,
    ``,
    `💰  MRR: ${eur(snap.mrr)}`,
    `🏆  Won last 24h: ${snap.deals_won_24h} Deals · ${eur(snap.deals_won_24h_value)}`,
    `📧  Neue Coaching-Einreichungen: ${snap.coaching_submissions_24h}`,
    `👥  Neue Bewerbungen: ${snap.new_applications_24h}`,
    ``,
    `⚠️  Offene Rechnungen überfällig: ${snap.invoices_overdue} · ${eur(snap.invoices_overdue_value)}`,
    `🚨  Kritische Kunden (Health): ${snap.clients_critical}`,
    `⏱  Verträge über Stunden-Budget: ${snap.contracts_overage}`,
    `🔴  Sync-Fehler 24h: ${snap.sync_errors_24h}`,
  ];

  const slack = Deno.env.get("SLACK_WEBHOOK_URL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const emailTo = Deno.env.get("DIGEST_EMAIL");
  const results: Record<string, unknown> = {};

  if (slack) {
    const r = await fetch(slack, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    results.slack = r.status;
  }

  if (resendKey && emailTo) {
    const html = `<pre style="font-family:monospace;font-size:13px;">${lines
      .join("\n")
      .replace(/\*(.+?)\*/g, "<b>$1</b>")}</pre>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Admin Dashboard <digest@content-leads.de>",
        to: emailTo.split(",").map((s) => s.trim()),
        subject: `Daily Digest · MRR ${eur(snap.mrr)}`,
        html,
      }),
    });
    results.email = r.status;
  }

  await db.from("sync_runs").insert({
    source: "daily_digest",
    status: "success",
    rows_processed: 1,
    message: JSON.stringify(results),
    finished_at: new Date().toISOString(),
  });
  return Response.json({ ok: true, results, preview: lines.join("\n") });
});
