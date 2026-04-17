import { supabaseServer } from "./supabase/server";

export type IntegrationStatus = {
  name: string;
  status: "ok" | "pending" | "error";
  note: string;
};

export type OverviewKpis = {
  revenueMTD: number;
  revenueTarget: number;
  pipelineValue: number;
  pipelineCount: number;
  bankBalance: number | null;
  unpaidInvoices: number;
  unpaidInvoicesCount: number;
  adSpendToday: number;
  fulfillmentOpen: number;
  coachingActive: number;
  coachingSubmissionsWeek: number;
  socialReachWeek: number;
  lastSync: string | null;
  integrations: IntegrationStatus[];
};

const EMPTY: OverviewKpis = {
  revenueMTD: 0,
  revenueTarget: 15000,
  pipelineValue: 0,
  pipelineCount: 0,
  bankBalance: null,
  unpaidInvoices: 0,
  unpaidInvoicesCount: 0,
  adSpendToday: 0,
  fulfillmentOpen: 0,
  coachingActive: 0,
  coachingSubmissionsWeek: 0,
  socialReachWeek: 0,
  lastSync: null,
  integrations: [
    { name: "Close CRM", status: "pending", note: "API-Key in Supabase Secrets eintragen" },
    { name: "Monday.com", status: "pending", note: "API-Token + Board-IDs eintragen" },
    { name: "Easybill", status: "pending", note: "API-Key eintragen" },
    { name: "Qonto", status: "pending", note: "Login + Secret Key eintragen" },
    { name: "Meta Ads", status: "pending", note: "Access Token + Ad Account ID eintragen" },
    { name: "Instagram", status: "pending", note: "Business Account ID + Token eintragen" },
    { name: "LinkedIn", status: "pending", note: "Access Token + Org URN eintragen" },
    { name: "Coaching", status: "ok", note: "Supabase Form, keine externe API nötig" },
  ],
};

export async function getOverviewKpis(): Promise<OverviewKpis> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.from("v_overview_kpis").select("*").single();
    if (error || !data) return EMPTY;
    return {
      ...EMPTY,
      ...data,
      integrations: await getIntegrationStatus(),
    };
  } catch {
    return EMPTY;
  }
}

async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("sync_runs")
      .select("source, status, finished_at, message")
      .order("finished_at", { ascending: false });
    if (!data) return EMPTY.integrations;

    const latestBySource = new Map<string, (typeof data)[number]>();
    for (const row of data) {
      if (!latestBySource.has(row.source)) latestBySource.set(row.source, row);
    }

    return EMPTY.integrations.map((i) => {
      const key = i.name.toLowerCase().replace(/[^a-z]/g, "");
      const match = Array.from(latestBySource.entries()).find(([s]) =>
        key.includes(s.toLowerCase()),
      );
      if (!match) return i;
      const [, run] = match;
      return {
        name: i.name,
        status: run.status === "success" ? "ok" : run.status === "running" ? "pending" : "error",
        note: run.message ?? `Zuletzt: ${new Date(run.finished_at).toLocaleString("de-DE")}`,
      };
    });
  } catch {
    return EMPTY.integrations;
  }
}
