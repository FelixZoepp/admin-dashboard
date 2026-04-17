import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { getOverviewKpis } from "@/lib/queries";
import { getSparklines } from "@/lib/sparklines";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

export default async function Overview() {
  const kpis = await getOverviewKpis();
  const sparks = await getSparklines({
    mrrCurrent: kpis.revenueMTD,
    revenueCurrent: kpis.revenueMTD,
    pipelineValue: kpis.pipelineValue,
    fulfillmentOpen: kpis.fulfillmentOpen,
    adSpendToday: kpis.adSpendToday,
    socialReachWeek: kpis.socialReachWeek,
  });

  return (
    <>
      <Header lastSync={kpis.lastSync} />
      <main className="p-4">
        <ExportBar tab="overview" />

        <div className="section-title">// Umsatz &amp; Cash</div>
        <KpiGrid>
          <KpiCard
            label="Umsatz MTD"
            value={formatEUR(kpis.revenueMTD)}
            accent="green"
            icon="▲"
            spark={sparks.revenue}
            sub={`Target ${formatEUR(kpis.revenueTarget)}`}
          />
          <KpiCard
            label="Pipeline"
            value={formatEUR(kpis.pipelineValue)}
            accent="cyan"
            icon="◆"
            spark={sparks.pipeline}
            sub={`${formatNumber(kpis.pipelineCount)} offene Deals`}
          />
          <KpiCard
            label="Kontostand"
            value={formatEUR(kpis.bankBalance)}
            accent="blue"
            icon="$"
            sub="Qonto + Commerzbank"
          />
          <KpiCard
            label="Offene RG"
            value={formatEUR(kpis.unpaidInvoices)}
            accent="orange"
            icon="!"
            sub={`${formatNumber(kpis.unpaidInvoicesCount)} Rechnungen`}
          />
        </KpiGrid>

        <div className="section-title">// Outreach &amp; Marketing</div>
        <KpiGrid>
          <KpiCard
            label="E-Mails KW"
            value={formatNumber(kpis.outreachSentWeek)}
            accent="purple"
            icon="@"
            spark={sparks.outreachSent}
            sub={`Reply Rate ${formatPercent(kpis.outreachReplyRate, 1)}`}
            subTrend="up"
          />
          <KpiCard
            label="Ad Spend heute"
            value={formatEUR(kpis.adSpendToday)}
            accent="red"
            icon="◉"
            spark={sparks.adSpend}
            sub="Meta Ads"
          />
          <KpiCard
            label="Reichweite KW"
            value={formatNumber(kpis.socialReachWeek)}
            accent="pink"
            icon="◎"
            spark={sparks.socialReach}
            sub="IG + LinkedIn"
          />
          <KpiCard
            label="Calls KW"
            value={formatNumber(sparks.salesCalls.reduce((a, b) => a + b, 0))}
            accent="yellow"
            icon="☎"
            spark={sparks.salesCalls}
            sub="Close Activities"
          />
        </KpiGrid>

        <div className="section-title">// Team &amp; Operations</div>
        <KpiGrid>
          <KpiCard
            label="Fulfillment offen"
            value={formatNumber(kpis.fulfillmentOpen)}
            accent="cyan"
            icon="☰"
            spark={sparks.fulfillment}
            sub="Monday Tasks"
          />
          <KpiCard
            label="Recruiting Prozess"
            value={formatNumber(kpis.recruitingInProcess)}
            accent="orange"
            icon="♦"
            sub={`${formatNumber(kpis.recruitingHiredMonth)} eingestellt (Monat)`}
          />
          <KpiCard
            label="Coaching Clients"
            value={formatNumber(kpis.coachingActive)}
            accent="green"
            icon="◈"
            sub={`${formatNumber(kpis.coachingSubmissionsWeek)} Einreichungen KW`}
          />
        </KpiGrid>

        <div className="section-title">// Integrations</div>
        <div className="card">
          {kpis.integrations.map((i) => {
            const dot =
              i.status === "ok"
                ? "bg-neon-green"
                : i.status === "pending"
                  ? "bg-neon-yellow"
                  : "bg-neon-red";
            const txt =
              i.status === "ok"
                ? "text-neon-green"
                : i.status === "pending"
                  ? "text-neon-yellow"
                  : "text-neon-red";
            return (
              <div
                key={i.name}
                className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${dot} animate-pulseNeon`}
                    style={{ boxShadow: "0 0 6px currentColor" }}
                  />
                  <div>
                    <div className="text-sm font-semibold font-mono">{i.name}</div>
                    <div className="text-[11px] text-muted">{i.note}</div>
                  </div>
                </div>
                <div className={`${txt} text-[10px] font-bold tracking-[0.15em] uppercase`}>
                  {i.status}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
