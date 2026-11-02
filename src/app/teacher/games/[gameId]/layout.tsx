import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Game report · Quizplayo" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
