import type { Metadata } from "next";

export const metadata: Metadata = { title: "Question bank" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
