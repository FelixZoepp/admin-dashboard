import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Leads — Admin Dashboard",
  description: "Realtime CRM, Fulfillment, Marketing, Finanzen & Coaching Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="overflow-x-hidden">{children}</body>
    </html>
  );
}
