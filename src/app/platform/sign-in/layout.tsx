import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Platform team sign-in · Quizplayo" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
