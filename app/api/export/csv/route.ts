import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const SOURCES: Record<string, { table: string; order?: string }> = {
  sales: { table: "v_won_deals_month", order: "won_at" },
  outreach: { table: "v_outreach_campaigns" },
  recruiting: { table: "v_recruiting_applications_recent", order: "applied_at" },
  fulfillment: { table: "v_fulfillment_by_day" },
  marketing: { table: "v_marketing_overview" },
  finanzen: { table: "invoices", order: "due_date" },
  team: { table: "v_team_boards" },
  coaching: { table: "v_coaching_recent_submissions", order: "week_start" },
  clients: { table: "v_client_profitability" },
  overview: { table: "v_overview_kpis" },
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[,";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "overview";
  const src = SOURCES[tab];
  if (!src) return NextResponse.json({ error: "unknown tab" }, { status: 400 });

  const sb = await supabaseServer();
  const q = sb.from(src.table).select("*");
  if (src.order) q.order(src.order, { ascending: false });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = toCsv((data ?? []) as Record<string, unknown>[]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${tab}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
