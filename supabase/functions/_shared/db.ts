// Shared helpers for Edge Functions (Deno runtime).
// deno-lint-ignore-file no-explicit-any

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function dbAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function withSyncRun<T>(
  source: string,
  fn: (db: SupabaseClient) => Promise<{ rows: number; info?: string; data?: T }>,
): Promise<Response> {
  const db = dbAdmin();
  const { data: runRows } = await db
    .from("sync_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  const runId = (runRows as any)?.id;

  try {
    const { rows, info } = await fn(db);
    await db
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_processed: rows,
        message: info ?? null,
      })
      .eq("id", runId);
    return Response.json({ ok: true, rows, info });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        message,
      })
      .eq("id", runId);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function upsertBatch(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id",
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  return rows.length;
}
