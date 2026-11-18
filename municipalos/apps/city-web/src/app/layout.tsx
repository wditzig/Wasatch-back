import type { Metadata, Viewport } from "next";
import "./globals.css";

// Every page is rendered per request: pages carry a per-request CSP nonce and live data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "MunicipalOS", template: "%s" },
  description: "Find your city, report a problem and track city services.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
