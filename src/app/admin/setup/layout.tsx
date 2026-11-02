import type { Metadata } from "next";

export const metadata: Metadata = { title: "School setup" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
