// Shared Airtable REST helpers (Deno, for Edge Functions).
// Docs: https://airtable.com/developers/web/api/rest

const API = "https://api.airtable.com/v0";

export type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

export async function airtableList(params: {
  token: string;
  baseId: string;
  table: string;
  view?: string;
  pageSize?: number;
}): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${params.baseId}/${encodeURIComponent(params.table)}`);
    url.searchParams.set("pageSize", String(params.pageSize ?? 100));
    if (params.view) url.searchParams.set("view", params.view);
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${params.token}` },
    });
    if (!r.ok) throw new Error(`airtable list ${params.table}: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { records: AirtableRecord[]; offset?: string };
    out.push(...j.records);
    offset = j.offset;
  } while (offset);
  return out;
}

export async function airtableUpsert(params: {
  token: string;
  baseId: string;
  table: string;
  records: { id?: string; fields: Record<string, unknown> }[];
  keyField: string;                            // Airtable field used as unique key when id is absent
}): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  // Airtable batch limit is 10 records per request
  const out: { id: string; fields: Record<string, unknown> }[] = [];
  for (let i = 0; i < params.records.length; i += 10) {
    const batch = params.records.slice(i, i + 10);
    const url = `${API}/${params.baseId}/${encodeURIComponent(params.table)}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: [params.keyField] },
        records: batch,
        typecast: true,
      }),
    });
    if (!r.ok) {
      throw new Error(`airtable upsert ${params.table}: ${r.status} ${await r.text()}`);
    }
    const j = (await r.json()) as { records: { id: string; fields: Record<string, unknown> }[] };
    out.push(...j.records);
  }
  return out;
}

/**
 * Apply a field_mapping to transform an Airtable record into a Supabase row.
 * Keys of `mapping` are Airtable field names; values are Supabase column names.
 */
export function mapAirtableFields(
  record: AirtableRecord,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { airtable_record_id: record.id };
  for (const [airtableField, supaCol] of Object.entries(mapping)) {
    if (record.fields[airtableField] !== undefined) {
      row[supaCol] = record.fields[airtableField];
    }
  }
  return row;
}
