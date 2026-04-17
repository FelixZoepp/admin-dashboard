import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "overview";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const target = tab === "overview" ? `${base}/` : `${base}/${tab}`;

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Print: ${tab}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#0f1117;}</style></head>
    <body>
      <h1>Content Leads — ${tab}</h1>
      <p>Um diesen Tab als PDF zu speichern, öffne die Seite im Browser (<a href="${target}">${target}</a>)
         und nutze <b>Drucken → Als PDF speichern</b>.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        Für automatisch generierte PDFs kann später <code>@react-pdf/renderer</code>
        oder ein Headless-Chrome-Service (z.B. Browserless) eingebunden werden.
      </p>
    </body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
