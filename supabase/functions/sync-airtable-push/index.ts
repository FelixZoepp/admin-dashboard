// Push from Supabase → Airtable (mirror key tables so you can review/edit).
// Uses Airtable's upsert on a key field (we pass the Supabase id as "SupabaseId").
import { withSyncRun } from "../_shared/db.ts";
import { airtableUpsert } from "../_shared/airtable.ts";

// Projection functions: one per supabase_table, to decide which columns
// become which Airtable fields.
const PROJECTIONS: Record<string, (row: any) => Record<string, unknown>> = {
  leads: (r) => ({
    SupabaseId: r.id,
    Name: r.name,
    Email: r.email,
    Phone: r.phone,
    Status: r.status,
    Owner: r.owner,
    Source: r.source,
    UpdatedAt: r.updated_at,
  }),
  opportunities: (r) => ({
    SupabaseId: r.id,
    LeadName: r.lead_name,
    Stage: r.stage,
    Status: r.status,
    Value: r.value,
    Currency: r.currency,
    Owner: r.owner,
    WonAt: r.won_at,
    LostAt: r.lost_at,
    UpdatedAt: r.updated_at,
  }),
  recruiting_applications: (r) => ({
    SupabaseId: r.id,
    Candidate: r.candidate_name,
    Email: r.email,
    Phone: r.phone,
    Source: r.source,
    Stage: r.stage,
    AppliedAt: r.applied_at,
    InterviewedAt: r.interviewed_at,
    TrialStartedAt: r.trial_started_at,
    HiredAt: r.hired_at,
    Notes: r.notes,
  }),
  client_submissions: (r) => ({
    SupabaseId: r.id,
    WeekStart: r.week_start,
    Revenue: r.revenue,
    NewLeads: r.new_leads,
    BookedCalls: r.booked_calls,
    Closes: r.closes,
    Notes: r.notes,
  }),
  invoices: (r) => ({
    SupabaseId: r.id,
    Number: r.number,
    Customer: r.customer_name,
    Total: r.total,
    Status: r.status,
    DueDate: r.due_date,
    PaidAt: r.paid_at,
  }),
};

Deno.serve(async () => {
  return withSyncRun("airtable_push", async (db) => {
    const token = Deno.env.get("AIRTABLE_API_KEY");
    if (!token) throw new Error("AIRTABLE_API_KEY not set");

    const { data: configs } = await db
      .from("airtable_sync_config")
      .select("*")
      .eq("direction", "push")
      .eq("active", true);

    if (!configs || configs.length === 0) {
      return { rows: 0, info: "no active push configs" };
    }

    let total = 0;
    const summary: string[] = [];

    for (const c of configs) {
      const project = PROJECTIONS[c.supabase_table ?? ""];
      if (!project) {
        summary.push(`${c.topic}: no projection for ${c.supabase_table}`);
        continue;
      }

      // Only push rows updated in last 30 days to keep volumes sane
      let query = db.from(c.supabase_table!).select("*").limit(5000);
      if (["leads", "opportunities", "invoices"].includes(c.supabase_table ?? "")) {
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        query = query.gte("updated_at", since);
      }
      const { data: rows, error } = await query;
      if (error) {
        summary.push(`${c.topic}: select error ${error.message}`);
        continue;
      }
      if (!rows || rows.length === 0) {
        summary.push(`${c.topic}: 0`);
        continue;
      }

      const airtableRecords = rows.map((r: any) => ({ fields: project(r) }));
      const written = await airtableUpsert({
        token,
        baseId: c.base_id,
        table: c.table_name,
        records: airtableRecords,
        keyField: "SupabaseId",
      });

      // Write airtable_record_id back to Supabase so updates stay linked
      const updates: Promise<any>[] = [];
      for (let i = 0; i < written.length; i++) {
        const supId = (written[i].fields as any).SupabaseId;
        if (supId) {
          updates.push(
            db
              .from(c.supabase_table!)
              .update({ airtable_record_id: written[i].id })
              .eq("id", supId),
          );
        }
      }
      await Promise.allSettled(updates);

      await db
        .from("airtable_sync_config")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", c.id);

      total += written.length;
      summary.push(`${c.topic}=${written.length}`);
    }

    return { rows: total, info: summary.join(" ") };
  });
});
