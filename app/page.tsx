import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { getOverviewKpis } from "@/lib/queries";
import { formatEUR, formatNumber, formatPercent } from "@/lib/utils";

export const revalidate = 60;

export default async function Overview() {
  const kpis = await getOverviewKpis();

  return (
    <>
      <Header lastSync={kpis.lastSync} />
      <main className="p-4">
        <ExportBar tab="overview" />
        <div className="section-title">💰 Umsatz &amp; Cash</div>
        <KpiGrid>
          <KpiCard
            label="Umsatz MTD"
            value={formatEUR(kpis.revenueMTD)}
            valueClass="text-accent-green"
            sub={`Target ${formatEUR(kpis.revenueTarget)}`}
          />
          <KpiCard
            label="Pipeline"
            value={formatEUR(kpis.pipelineValue)}
            sub={`${formatNumber(kpis.pipelineCount)} offene Deals`}
          />
          <KpiCard
            label="Kontostand"
            value={formatEUR(kpis.bankBalance)}
            sub="Qonto + Commerzbank"
          />
          <KpiCard
            label="Offene RG"
            value={formatEUR(kpis.unpaidInvoices)}
            sub={`${formatNumber(kpis.unpaidInvoicesCount)} Rechnungen`}
          />
        </KpiGrid>

        <div className="section-title">📧 Outreach &amp; Marketing</div>
        <KpiGrid>
          <KpiCard
            label="E-Mails versandt KW"
            value={formatNumber(kpis.outreachSentWeek)}
            sub={`Reply Rate: ${formatPercent(kpis.outreachReplyRate, 1)}`}
            subTrend="up"
          />
          <KpiCard
            label="Ad Spend heute"
            value={formatEUR(kpis.adSpendToday)}
            sub="Meta Ads"
          />
          <KpiCard
            label="Reichweite KW"
            value={formatNumber(kpis.socialReachWeek)}
            sub="IG + LinkedIn"
          />
        </KpiGrid>

        <div className="section-title">👥 Team &amp; Operations</div>
        <KpiGrid>
          <KpiCard
            label="Fulfillment offen"
            value={formatNumber(kpis.fulfillmentOpen)}
            sub="Monday Tasks"
          />
          <KpiCard
            label="Recruiting im Prozess"
            value={formatNumber(kpis.recruitingInProcess)}
            sub={`${formatNumber(kpis.recruitingHiredMonth)} eingestellt im Monat`}
          />
          <KpiCard
            label="Coaching Clients"
            value={formatNumber(kpis.coachingActive)}
            sub={`${formatNumber(kpis.coachingSubmissionsWeek)} Einreichungen KW`}
          />
        </KpiGrid>

        <div className="section-title">Integrationen Status</div>
        <div className="card">
          {kpis.integrations.map((i) => (
            <div
              key={i.name}
              className="flex justify-between items-center py-2.5 border-b border-border last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{i.name}</div>
                <div className="text-[11px] text-muted">{i.note}</div>
              </div>
              <div
                className={
                  i.status === "ok"
                    ? "text-accent-green text-xs font-semibold"
                    : i.status === "pending"
                      ? "text-accent-yellow text-xs font-semibold"
                      : "text-accent-red text-xs font-semibold"
                }
              >
                {i.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
