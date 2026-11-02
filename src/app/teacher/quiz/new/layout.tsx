import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "New quiz · Quizplayo" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
