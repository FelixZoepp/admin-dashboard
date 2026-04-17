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
  const [{ data: content }, { data: ads }, { data: ig }, { data: li }] = await Promise.all([
    sb.from("v_marketing_overview").select("*").single(),
    sb.from("v_meta_ads_week").select("*").single(),
    sb.from("v_instagram_week").select("*").single(),
    sb.from("v_linkedin_week").select("*").single(),
  ]);

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
      </main>
    </>
  );
}
