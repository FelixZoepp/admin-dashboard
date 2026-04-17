"use client";

import { useEffect, useState } from "react";

const TV_PAGES = [
  { path: "/", label: "Overview" },
  { path: "/forecast", label: "Forecast" },
  { path: "/clients", label: "Kunden" },
  { path: "/sales", label: "Sales" },
  { path: "/outreach", label: "Outreach" },
  { path: "/finanzen", label: "Finanzen" },
  { path: "/steuer", label: "Steuer" },
  { path: "/marketing", label: "Marketing" },
];

export default function TvMode() {
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(20);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setIdx((i) => (i + 1) % TV_PAGES.length);
          return 20;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const page = TV_PAGES[idx];

  return (
    <div className="min-h-screen bg-bg-primary text-white">
      <div className="sticky top-0 z-50 bg-gradient-to-br from-bg-secondary to-bg-tertiary border-b border-border px-6 py-4 flex justify-between items-center">
        <div>
          <div className="text-3xl font-bold bg-gradient-to-br from-accent-blue to-[#7ba3ff] bg-clip-text text-transparent">
            Content Leads — TV
          </div>
          <div className="text-sm text-muted mt-1">
            {page.label} · nächster Tab in {secondsLeft}s
          </div>
        </div>
        <div className="flex gap-1.5">
          {TV_PAGES.map((p, i) => (
            <div
              key={p.path}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-8 bg-accent-blue" : "w-3 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="text-lg">
        <iframe
          src={page.path}
          className="w-full border-0"
          style={{ height: "calc(100vh - 90px)" }}
          title={page.label}
        />
      </div>
    </div>
  );
}
