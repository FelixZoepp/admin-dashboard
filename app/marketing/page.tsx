import { Header } from "@/components/Header";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { ExportBar } from "@/components/ExportBar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEUR, formatNumber } from "@/lib/utils";

export const revalidate = 60;

function PlatformCard({
  title,
  icon,
  stats,
}: {
  title: string;
  icon: string;
  stats: { label: string; value: string | number | null | undefined }[];
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-3.5 mb-2.5">
      <div className="flex items-center gap-2 mb-2.5 text-sm font-semibold">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-bg-primary rounded-md px-2.5 py-2"
          >
            <div className="text-[10px] text-muted uppercase">{s.label}</div>
            <div className="text-base font-bold">{s.value ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Marketing() {
  const sb = await supabaseServer();
  const [
    { data: content },
    { data: ads },
    { data: ig },
    { data: li },
    { data: lpKpis },
    { data: lpPages },
    { data: copecart },
    { data: copecartProducts },
  ] = await Promise.all([
    sb.from("v_marketing_overview").select("*").single(),
    sb.from("v_meta_ads_week").select("*").single(),
    sb.from("v_instagram_week").select("*").single(),
    sb.from("v_linkedin_week").select("*").single(),
    sb.from("v_lp_kpis").select("*").single(),
    sb.from("v_lp_pages").select("*"),
    sb.from("v_copecart_kpis").select("*").single(),
    sb.from("v_copecart_products").select("*").limit(10),
  ]);

  const perspectivePages = (lpPages ?? []).filter((p: any) => p.platform === "perspective");
  const onepagePages = (lpPages ?? []).filter((p: any) => p.platform === "onepage");

  return (
    <>
      <Header />
      <main className="p-4">
        <ExportBar tab="marketing" />

        <div className="section-title">Content Performance</div>
        <KpiGrid>
          <KpiCard label="Posts KW" value={formatNumber(content?.posts_week)} sub="Alle Plattformen" />
          <KpiCard label="Impressions" value={formatNumber(content?.impressions_week)} sub="Gesamt KW" />
          <KpiCard label="Engagement" value={formatNumber(content?.engagement_week)} sub="Likes + Kommentare" />
          <KpiCard label="Leads" value={formatNumber(content?.leads_week)} sub="via Content" />
        </KpiGrid>

        <div className="section-title">Meta Ads</div>
        <PlatformCard
          title="Meta (Facebook / Instagram Ads)"
          icon="📊"
          stats={[
            { label: "Spend KW", value: ads ? formatEUR(ads.spend) : null },
            { label: "Impressions", value: ads ? formatNumber(ads.impressions) : null },
            { label: "Clicks", value: ads ? formatNumber(ads.clicks) : null },
            { label: "CPL", value: ads ? formatEUR(ads.cpl) : null },
          ]}
        />

        <div className="section-title">LinkedIn</div>
        <PlatformCard
          title="LinkedIn"
          icon="👤"
          stats={[
            { label: "Impressions", value: li ? formatNumber(li.impressions) : null },
            { label: "Engagement", value: li ? formatNumber(li.engagement) : null },
            { label: "Follower", value: li ? formatNumber(li.followers) : null },
            { label: "Profilbesuche", value: li ? formatNumber(li.profile_views) : null },
          ]}
        />

        <div className="section-title">Instagram</div>
        <PlatformCard
          title="Instagram"
          icon="📷"
          stats={[
            { label: "Reichweite", value: ig ? formatNumber(ig.reach) : null },
            { label: "Engagement", value: ig ? formatNumber(ig.engagement) : null },
            { label: "Follower", value: ig ? formatNumber(ig.followers) : null },
            { label: "Story Views", value: ig ? formatNumber(ig.story_views) : null },
          ]}
        />

        {/* ============ Funnels: Perspective ============ */}
        <div className="section-title">
          <span>🎯</span> Perspective Funnels
        </div>
        <PlatformCard
          title="Perspective (KW)"
          icon="🚀"
          stats={[
            { label: "Views", value: formatNumber(lpKpis?.perspective_views ?? 0) },
            { label: "Visitors", value: formatNumber(lpKpis?.perspective_visitors ?? 0) },
            { label: "Leads", value: formatNumber(lpKpis?.perspective_leads ?? 0) },
            {
              label: "CVR",
              value: `${(lpKpis?.perspective_cvr ?? 0).toFixed(2)}%`,
            },
          ]}
        />
        <PageList pages={perspectivePages} emptyText="PERSPECTIVE_API_KEY in Supabase-Secrets eintragen" />

        {/* ============ Funnels: OnePage ============ */}
        <div className="section-title">
          <span>🌐</span> OnePage Landing Pages
        </div>
        <PlatformCard
          title="OnePage (KW)"
          icon="📄"
          stats={[
            { label: "Views", value: formatNumber(lpKpis?.onepage_views ?? 0) },
            { label: "Visitors", value: formatNumber(lpKpis?.onepage_visitors ?? 0) },
            { label: "Leads", value: formatNumber(lpKpis?.onepage_leads ?? 0) },
            {
              label: "CVR",
              value: `${(lpKpis?.onepage_cvr ?? 0).toFixed(2)}%`,
            },
          ]}
        />
        <PageList pages={onepagePages} emptyText="ONEPAGE_API_KEY + ONEPAGE_API_BASE eintragen" />

        {/* ============ CopeCart ============ */}
        <div className="section-title">
          <span>💳</span> CopeCart
        </div>
        <PlatformCard
          title="CopeCart Sales"
          icon="🛒"
          stats={[
            { label: "Umsatz Monat", value: formatEUR(copecart?.revenue_month ?? 0) },
            { label: "Sales Monat", value: formatNumber(copecart?.sales_month ?? 0) },
            { label: "Umsatz KW", value: formatEUR(copecart?.revenue_week ?? 0) },
            { label: "Refunds Monat", value: formatNumber(copecart?.refunds_month ?? 0) },
          ]}
        />
        <div className="card">
          {(copecartProducts ?? []).length === 0 ? (
            <div className="text-center py-4 text-muted text-sm">
              COPECART_API_KEY in Supabase-Secrets eintragen
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary border-b-2 border-border">
                  <tr>
                    <th className="text-left p-2 font-semibold text-muted uppercase text-[10px]">Produkt</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Preis</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Sales Monat</th>
                    <th className="text-right p-2 font-semibold text-muted uppercase text-[10px]">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {(copecartProducts ?? []).map((p: any) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">{formatEUR(p.price_gross)}</td>
                      <td className="p-2 text-right">{formatNumber(p.sales_month)}</td>
                      <td className="p-2 text-right font-semibold text-accent-green">
                        {formatEUR(p.revenue_month)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function PageList({
  pages,
  emptyText,
}: {
  pages: any[];
  emptyText: string;
}) {
  if (pages.length === 0) {
    return (
      <div className="card text-center py-6 text-muted text-sm">{emptyText}</div>
    );
  }
  return (
    <div className="card">
      {pages.slice(0, 10).map((p) => (
        <div
          key={p.id}
          className="flex justify-between items-center py-2 border-b border-border last:border-0 gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{p.name}</div>
            <div className="text-[10px] text-muted truncate">
              {p.url ?? "—"}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-accent-green">
              {formatNumber(p.leads_week)} Leads
            </div>
            <div className="text-[10px] text-muted">
              {formatNumber(p.views_week)} Views / KW
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
