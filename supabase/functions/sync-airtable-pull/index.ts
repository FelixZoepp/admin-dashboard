// Pull from Airtable → airtable_records (staging) + typed tables
// Reads active pull-configs from airtable_sync_config and iterates.
import { withSyncRun, upsertBatch } from "../_shared/db.ts";
import { airtableList, mapAirtableFields } from "../_shared/airtable.ts";

Deno.serve(async () => {
  return withSyncRun("airtable_pull", async (db) => {
    const token = Deno.env.get("AIRTABLE_API_KEY");
    if (!token) throw new Error("AIRTABLE_API_KEY not set");

    const { data: configs } = await db
      .from("airtable_sync_config")
      .select("*")
      .eq("direction", "pull")
      .eq("active", true);

    if (!configs || configs.length === 0) {
      return { rows: 0, info: "no active pull configs" };
    }

    let total = 0;
    const summary: string[] = [];

    for (const c of configs) {
      const records = await airtableList({
        token,
        baseId: c.base_id,
        table: c.table_name,
        view: c.view_name ?? undefined,
      });

      // Always mirror into generic staging
      const stagingRows = records.map((r) => ({
        id: r.id,
        base_id: c.base_id,
        table_name: c.table_name,
        topic: c.topic,
        fields: r.fields,
        created_time: r.createdTime,
        synced_at: new Date().toISOString(),
      }));
      await upsertBatch(db, "airtable_records", stagingRows);

      // If a typed target + field_mapping exist, also upsert into typed table
      if (c.supabase_table && c.field_mapping && Object.keys(c.field_mapping).length > 0) {
        const typedRows = records.map((r) =>
          mapAirtableFields(r, c.field_mapping as Record<string, string>),
        );
        const { error } = await db
          .from(c.supabase_table)
          .upsert(typedRows, { onConflict: "airtable_record_id" });
        if (error) {
          summary.push(`${c.topic}: upsert error ${error.message}`);
          continue;
        }
      }

      await db
        .from("airtable_sync_config")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", c.id);

      total += records.length;
      summary.push(`${c.topic}=${records.length}`);
    }

    return { rows: total, info: summary.join(" ") };
  });
});
