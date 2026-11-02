import type { Metadata } from "next";

export const metadata: Metadata = { title: "School sign-in" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
