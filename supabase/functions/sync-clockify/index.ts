// Sync Clockify → time_entries + team_members
// Docs: https://docs.clockify.me/
//
// Mapping strategy:
// - Clockify "Project" → clients.name (by exact name match)
// - Clockify "User"    → team_members.name (by exact name match)
// - Clockify "Task"    → deliverables.title (optional)
// Unknown projects/users are stored with `member_name` / no client_id
// so nothing gets lost; you can map them later in Supabase.
import { withSyncRun, upsertBatch } from "../_shared/db.ts";

Deno.serve(async () => {
  return withSyncRun("clockify", async (db) => {
    const key = Deno.env.get("CLOCKIFY_API_KEY");
    const workspaceId = Deno.env.get("CLOCKIFY_WORKSPACE_ID");
    if (!key || !workspaceId) {
      throw new Error("CLOCKIFY_API_KEY / CLOCKIFY_WORKSPACE_ID not set");
    }
    const headers = { "X-Api-Key": key, "Content-Type": "application/json" };
    const base = `https://api.clockify.me/api/v1/workspaces/${workspaceId}`;

    // --- Users ---
    const uRes = await fetch(`${base}/users?page-size=200`, { headers });
    if (!uRes.ok) throw new Error(`clockify users: ${uRes.status}`);
    const users = (await uRes.json()) as { id: string; name: string; email: string }[];
    const userById = new Map(users.map((u) => [u.id, u]));

    // Ensure every Clockify user exists as team_member (by name); if a row
    // already exists it keeps its existing hourly_cost.
    const memberRows = users.map((u) => ({
      name: u.name,
      email: u.email,
      active: true,
    }));
    // Upsert by name
    for (const row of memberRows) {
      await db
        .from("team_members")
        .upsert(row, { onConflict: "name", ignoreDuplicates: false })
        .select();
    }
    // Build name → team_members.id map for linking
    const { data: tm } = await db.from("team_members").select("id, name, hourly_cost");
    const memberByName = new Map(
      ((tm ?? []) as { id: string; name: string; hourly_cost: number }[]).map((r) => [r.name, r]),
    );

    // --- Projects → clients ---
    const pRes = await fetch(`${base}/projects?page-size=200`, { headers });
    if (!pRes.ok) throw new Error(`clockify projects: ${pRes.status}`);
    const projects = (await pRes.json()) as { id: string; name: string }[];

    // Lookup existing clients by name
    const { data: clientsRows } = await db.from("clients").select("id, name");
    const clientByName = new Map(
      ((clientsRows ?? []) as { id: string; name: string }[]).map((c) => [c.name, c.id]),
    );

    // --- Time entries per user (last 30 days) ---
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const entries: Record<string, unknown>[] = [];
    for (const u of users) {
      let page = 1;
      while (true) {
        const url = new URL(`${base}/user/${u.id}/time-entries`);
        url.searchParams.set("start", since);
        url.searchParams.set("page-size", "200");
        url.searchParams.set("page", String(page));
        const r = await fetch(url, { headers });
        if (!r.ok) break;
        const items = (await r.json()) as any[];
        if (!items.length) break;
        for (const e of items) {
          const project = projects.find((p) => p.id === e.projectId);
          const clientId = project ? clientByName.get(project.name) : undefined;
          const member = memberByName.get(u.name);
          const started = e.timeInterval?.start;
          const ended = e.timeInterval?.end;
          const duration =
            ended && started
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(ended).getTime() - new Date(started).getTime()) / 1000,
                  ),
                )
              : 0;
          entries.push({
            id: e.id,
            client_id: clientId ?? null,
            member_id: member?.id ?? null,
            member_name: u.name,
            description: e.description ?? project?.name ?? null,
            started_at: started,
            ended_at: ended,
            duration_seconds: duration,
            billable: Boolean(e.billable),
            hourly_rate: e.hourlyRate?.amount
              ? Number(e.hourlyRate.amount) / 100
              : null,
            hourly_cost: member?.hourly_cost ?? null,
            source: "clockify",
            synced_at: new Date().toISOString(),
          });
        }
        if (items.length < 200) break;
        page += 1;
        if (page > 40) break; // safety
      }
    }

    const rows = await upsertBatch(db, "time_entries", entries);
    return {
      rows,
      info: `users=${users.length} projects=${projects.length} entries=${entries.length}`,
    };
  });
});
