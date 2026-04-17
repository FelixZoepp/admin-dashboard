"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "forecast", label: "Forecast" },
  { slug: "clients", label: "Kunden" },
  { slug: "sales", label: "Sales" },
  { slug: "outreach", label: "Outreach" },
  { slug: "recruiting", label: "Recruiting" },
  { slug: "fulfillment", label: "Fulfillment" },
  { slug: "marketing", label: "Marketing" },
  { slug: "finanzen", label: "Finanzen" },
  { slug: "steuer", label: "Steuer" },
  { slug: "team", label: "Team" },
  { slug: "coaching", label: "Coaching" },
  { slug: "airtable", label: "Airtable" },
];

export function Tabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto -mx-5 px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((t) => {
        const href = t.slug ? `/${t.slug}` : "/";
        const active =
          pathname === href || (t.slug && pathname.startsWith(`/${t.slug}`));
        return (
          <Link
            key={t.slug || "overview"}
            href={href}
            className={cn(
              "px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap rounded-t-md border-b-2 transition-all duration-200 font-mono",
              active
                ? "text-neon-cyan border-neon-cyan bg-neon-cyan/5"
                : "text-muted border-transparent hover:text-white hover:bg-white/[0.03]",
            )}
            style={
              active
                ? { textShadow: "0 0 8px rgba(68, 231, 255, 0.6)" }
                : undefined
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
