// Orchestrator: triggers all integrations in parallel.
// Called by pg_cron daily at 06:00 UTC (see migration 20260417000004_cron.sql).

const FUNCTIONS = [
  "sync-close",
  "sync-monday",
  "sync-easybill",
  "sync-qonto",
  "sync-meta",
  "sync-instagram",
  "sync-linkedin",
];

Deno.serve(async () => {
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const results = await Promise.allSettled(
    FUNCTIONS.map(async (fn) => {
      const r = await fetch(`${base}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });
      const body = await r.text();
      return { fn, status: r.status, body };
    }),
  );

  return Response.json({
    ok: results.every((r) => r.status === "fulfilled"),
    results,
  });
});
