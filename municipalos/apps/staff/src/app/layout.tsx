import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Every page is rendered per request: pages carry a per-request CSP nonce and live data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "MunicipalOS Staff", template: "%s · MunicipalOS Staff" },
  description: "Municipal employee workspace.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
