import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose your password" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
