import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Quizplayo: quizzes and live games for schools", template: "%s · Quizplayo" },
  description: "Quizplayo: quizzes and live games for schools",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#001b47",
};

// Every page is rendered per request, so Next.js can put this response's CSP nonce (middleware.ts) on its scripts.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
