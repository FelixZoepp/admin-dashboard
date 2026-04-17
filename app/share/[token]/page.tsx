// NOTE: Share pages currently render the same components as the authenticated
// tabs, so they rely on the viewer being logged in OR on the dashboard views
// being granted to the anon role. Middleware lets /share/* through without
// auth — the token's HMAC signature + expiry acts as the access gate.
// For MVP we grant SELECT on public views to anon in a follow-up migration
// if public sharing is needed. For now share-URLs work best for logged-in
// viewers who want a stable link to a tab.
import { notFound } from "next/navigation";
import { verifyShareToken } from "@/lib/share";
import Sales from "@/app/sales/page";
import Outreach from "@/app/outreach/page";
import Recruiting from "@/app/recruiting/page";
import Fulfillment from "@/app/fulfillment/page";
import Marketing from "@/app/marketing/page";
import Finanzen from "@/app/finanzen/page";
import Team from "@/app/team/page";
import Coaching from "@/app/coaching/page";
import Clients from "@/app/clients/page";
import Airtable from "@/app/airtable/page";
import Overview from "@/app/page";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyShareToken(token);
  if (!payload) notFound();

  const PAGES: Record<string, () => Promise<React.JSX.Element>> = {
    overview: Overview,
    clients: Clients,
    sales: Sales,
    outreach: Outreach,
    recruiting: Recruiting,
    fulfillment: Fulfillment,
    marketing: Marketing,
    finanzen: Finanzen,
    team: Team,
    coaching: Coaching,
    airtable: Airtable,
  };
  const Page = PAGES[payload.tab];
  if (!Page) notFound();
  return (
    <>
      <div className="bg-accent-yellow/20 border-b border-accent-yellow text-accent-yellow text-[11px] text-center py-1.5">
        Read-only Share-Ansicht · Ablauf {new Date(payload.expiresAt).toLocaleString("de-DE")}
      </div>
      {await Page()}
    </>
  );
}
