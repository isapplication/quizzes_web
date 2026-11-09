import type { Metadata } from "next";

export const metadata: Metadata = { title: "Signing you in", referrer: "no-referrer", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
