import { NextResponse } from "next/server";
import { createShareToken } from "@/lib/share";
import { supabaseServer } from "@/lib/supabase/server";

const ALLOWED_TABS = [
  "overview",
  "sales",
  "outreach",
  "recruiting",
  "fulfillment",
  "marketing",
  "finanzen",
  "team",
  "coaching",
];

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tab, ttlHours = 168 } = (await req.json()) as {
    tab: string;
    ttlHours?: number;
  };
  if (!ALLOWED_TABS.includes(tab)) {
    return NextResponse.json({ error: "invalid tab" }, { status: 400 });
  }
  const token = createShareToken(tab, Math.min(ttlHours, 24 * 30));
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.json({
    url: `${base}/share/${token}`,
    expiresInHours: ttlHours,
  });
}
