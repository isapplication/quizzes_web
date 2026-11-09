import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add a quiz to your course", referrer: "no-referrer", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
