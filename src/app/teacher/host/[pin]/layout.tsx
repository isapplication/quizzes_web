import type { Metadata } from "next";

export const metadata: Metadata = { title: "Host a live game" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
