import type { Metadata } from "next";

export const metadata: Metadata = { title: "Class simulator" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
