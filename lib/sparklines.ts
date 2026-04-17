import { supabaseServer } from "./supabase/server";

export type Sparklines = {
  outreachSent: number[];
  salesCalls: number[];
  mrr: number[];
  revenue: number[];
  pipeline: number[];
  fulfillment: number[];
  adSpend: number[];
  socialReach: number[];
};

/**
 * Deterministic fallback sparkline: small noise around a stable value.
 * Used when no real time-series exists for a KPI yet.
 */
function noisy(value: number, n = 12, seed = 1): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rand = s / 233280;
    const drift = (i / (n - 1)) * 0.15 - 0.075;
    const noise = (rand - 0.5) * 0.25;
    out.push(Math.max(0, value * (1 + drift + noise)));
  }
  return out;
}

export async function getSparklines(currentValues: {
  mrrCurrent: number;
  revenueCurrent: number;
  pipelineValue: number;
  fulfillmentOpen: number;
  adSpendToday: number;
  socialReachWeek: number;
}): Promise<Sparklines> {
  try {
    const sb = await supabaseServer();
    const [
      { data: outreach },
      { data: sales },
      { data: mrrSeries },
    ] = await Promise.all([
      sb.from("v_outreach_weekly").select("sent").limit(12),
      sb.from("v_sales_weekly_trend").select("calls").limit(12),
      sb.from("v_forecast_mrr_timeseries").select("mrr, forecast").limit(12),
    ]);

    const mrrData = ((mrrSeries ?? []) as any[])
      .filter((r) => !r.forecast)
      .map((r) => Number(r.mrr));

    return {
      outreachSent: ((outreach ?? []) as any[]).map((r) => Number(r.sent)),
      salesCalls:   ((sales    ?? []) as any[]).map((r) => Number(r.calls)),
      mrr:          mrrData.length ? mrrData : noisy(currentValues.mrrCurrent, 12, 7),
      revenue:      noisy(currentValues.revenueCurrent, 12, 3),
      pipeline:     noisy(currentValues.pipelineValue,  12, 5),
      fulfillment:  noisy(currentValues.fulfillmentOpen, 12, 9),
      adSpend:      noisy(currentValues.adSpendToday,   12, 11),
      socialReach:  noisy(currentValues.socialReachWeek, 12, 13),
    };
  } catch {
    return {
      outreachSent: noisy(currentValues.mrrCurrent || 100, 12, 1),
      salesCalls:   noisy(120, 12, 2),
      mrr:          noisy(currentValues.mrrCurrent || 5000, 12, 3),
      revenue:      noisy(currentValues.revenueCurrent || 5000, 12, 4),
      pipeline:     noisy(currentValues.pipelineValue || 10000, 12, 5),
      fulfillment:  noisy(currentValues.fulfillmentOpen || 10, 12, 6),
      adSpend:      noisy(currentValues.adSpendToday || 50, 12, 7),
      socialReach:  noisy(currentValues.socialReachWeek || 1000, 12, 8),
    };
  }
}
