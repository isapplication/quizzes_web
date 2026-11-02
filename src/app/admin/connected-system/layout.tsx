import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your school's system" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
