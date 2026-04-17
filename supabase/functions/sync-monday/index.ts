// Sync Monday.com boards → monday_boards + fulfillment_items
// Docs: https://developer.monday.com/api-reference/docs
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

type MondayItem = {
  id: string;
  name: string;
  column_values: { id: string; text: string | null; value: string | null; type: string }[];
  updated_at: string;
  created_at: string;
};

const STATUS_MAP: Record<string, string> = {
  done: "done",
  erledigt: "done",
  "in progress": "in_progress",
  "in arbeit": "in_progress",
  working: "in_progress",
  open: "open",
  offen: "open",
  stuck: "open",
  overdue: "overdue",
};

function normalizeStatus(text: string | null): string {
  if (!text) return "open";
  return STATUS_MAP[text.toLowerCase()] ?? "open";
}

Deno.serve(async () => {
  return withSyncRun("monday", async (db) => {
    const token = Deno.env.get("MONDAY_API_TOKEN");
    const boardIds = Deno.env.get("MONDAY_BOARD_IDS");
    if (!token) throw new Error("MONDAY_API_TOKEN not set");
    if (!boardIds) throw new Error("MONDAY_BOARD_IDS not set (comma-separated)");

    const ids = boardIds.split(",").map((s) => s.trim()).filter(Boolean);
    let rows = 0;

    const boardsOut: Record<string, unknown>[] = [];
    const itemsOut: Record<string, unknown>[] = [];

    for (const boardId of ids) {
      const query = `
        query ($boardId: [ID!]) {
          boards(ids: $boardId) {
            id
            name
            items_page(limit: 200) {
              items {
                id
                name
                created_at
                updated_at
                column_values { id text value type }
              }
            }
          }
        }`;

      const r = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          "API-Version": "2024-01",
        },
        body: JSON.stringify({ query, variables: { boardId: [boardId] } }),
      });
      if (!r.ok) throw new Error(`monday board ${boardId}: ${r.status}`);
      const json = (await r.json()) as {
        data: { boards: { id: string; name: string; items_page: { items: MondayItem[] } }[] };
      };

      for (const b of json.data.boards) {
        boardsOut.push({
          board_id: b.id,
          name: b.name,
          synced_at: new Date().toISOString(),
        });
        for (const it of b.items_page.items) {
          const statusCol = it.column_values.find((c) => c.type === "status");
          const dateCol = it.column_values.find((c) => c.type === "date" || c.id === "date4");
          const peopleCol = it.column_values.find((c) => c.type === "people");
          const status = normalizeStatus(statusCol?.text ?? null);
          itemsOut.push({
            id: it.id,
            board_id: b.id,
            name: it.name,
            status,
            category: null,
            assignee: peopleCol?.text ?? null,
            due_date: dateCol?.text || null,
            completed_at: status === "done" ? it.updated_at : null,
            created_at: it.created_at,
            synced_at: new Date().toISOString(),
          });
        }
      }
    }

    rows += await upsertBatch(db, "monday_boards", boardsOut, "board_id");
    rows += await upsertBatch(db, "fulfillment_items", itemsOut);

    return { rows, info: `boards=${boardsOut.length} items=${itemsOut.length}` };
  });
});
