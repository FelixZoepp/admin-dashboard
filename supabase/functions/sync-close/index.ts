// Sync Close CRM → leads, opportunities, activities
// Docs: https://developer.close.com/
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("close", async (db) => {
    const apiKey = Deno.env.get("CLOSE_API_KEY");
    if (!apiKey) throw new Error("CLOSE_API_KEY not set");

    const auth = `Basic ${btoa(`${apiKey}:`)}`;
    const headers = { Authorization: auth, "Content-Type": "application/json" };
    let rows = 0;

    // --- Leads (paginated) ---
    const leads: Record<string, unknown>[] = [];
    let nextCursor: string | null = null;
    do {
      const url = new URL("https://api.close.com/api/v1/lead/");
      url.searchParams.set("_limit", "100");
      if (nextCursor) url.searchParams.set("_cursor", nextCursor);
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`close leads: ${r.status}`);
      const json = (await r.json()) as {
        data: Record<string, unknown>[];
        cursor_next?: string | null;
      };
      for (const lead of json.data) {
        leads.push({
          id: lead.id,
          name: lead.display_name ?? lead.name ?? "—",
          email: (lead.contacts as any)?.[0]?.emails?.[0]?.email ?? null,
          phone: (lead.contacts as any)?.[0]?.phones?.[0]?.phone ?? null,
          status: (lead.status_label as string) ?? null,
          owner: (lead.created_by_name as string) ?? null,
          custom: lead.custom ?? {},
          created_at: lead.date_created,
          updated_at: lead.date_updated,
          synced_at: new Date().toISOString(),
        });
      }
      nextCursor = json.cursor_next ?? null;
    } while (nextCursor);
    rows += await upsertBatch(db, "leads", leads);

    // --- Opportunities ---
    const opps: Record<string, unknown>[] = [];
    nextCursor = null;
    do {
      const url = new URL("https://api.close.com/api/v1/opportunity/");
      url.searchParams.set("_limit", "100");
      if (nextCursor) url.searchParams.set("_cursor", nextCursor);
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`close opps: ${r.status}`);
      const json = (await r.json()) as {
        data: Record<string, unknown>[];
        cursor_next?: string | null;
      };
      for (const o of json.data) {
        opps.push({
          id: o.id,
          lead_id: o.lead_id,
          lead_name: o.lead_name,
          pipeline: o.pipeline_name,
          stage: o.status_label,
          value: Number(o.value ?? 0) / 100, // Close stores in cents
          currency: o.value_currency ?? "EUR",
          owner: o.user_name,
          status: o.status_type, // 'active','won','lost'
          won_at: o.date_won,
          lost_at: o.date_lost,
          created_at: o.date_created,
          updated_at: o.date_updated,
          synced_at: new Date().toISOString(),
        });
      }
      nextCursor = json.cursor_next ?? null;
    } while (nextCursor);
    rows += await upsertBatch(db, "opportunities", opps);

    // --- Activities (last 60 days only) ---
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();
    const activities: Record<string, unknown>[] = [];
    for (const type of ["call", "email", "meeting", "note"]) {
      nextCursor = null;
      do {
        const url = new URL(`https://api.close.com/api/v1/activity/${type}/`);
        url.searchParams.set("_limit", "100");
        url.searchParams.set("date_created__gte", since);
        if (nextCursor) url.searchParams.set("_cursor", nextCursor);
        const r = await fetch(url, { headers });
        if (!r.ok) break;
        const json = (await r.json()) as {
          data: Record<string, unknown>[];
          cursor_next?: string | null;
        };
        for (const a of json.data) {
          activities.push({
            id: a.id,
            lead_id: a.lead_id,
            type,
            direction: a.direction,
            outcome: a.disposition ?? a.status,
            user_name: a.user_name,
            occurred_at: a.date_created,
            duration_seconds: a.duration,
            synced_at: new Date().toISOString(),
          });
        }
        nextCursor = json.cursor_next ?? null;
      } while (nextCursor);
    }
    rows += await upsertBatch(db, "activities", activities);

    return { rows, info: `leads=${leads.length} opps=${opps.length} acts=${activities.length}` };
  });
});
