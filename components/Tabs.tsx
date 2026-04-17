"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "clients", label: "Kunden" },
  { slug: "sales", label: "Sales" },
  { slug: "outreach", label: "Outreach" },
  { slug: "recruiting", label: "Recruiting" },
  { slug: "fulfillment", label: "Fulfillment" },
  { slug: "marketing", label: "Marketing" },
  { slug: "finanzen", label: "Finanzen" },
  { slug: "team", label: "Team" },
  { slug: "coaching", label: "Coaching" },
  { slug: "airtable", label: "Airtable" },
];

export function Tabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-0 overflow-x-auto -mx-5 px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              "px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all",
              active
                ? "text-accent-blue border-accent-blue"
                : "text-muted border-transparent hover:text-white",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
