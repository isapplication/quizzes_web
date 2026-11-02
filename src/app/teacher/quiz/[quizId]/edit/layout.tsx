import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Edit quiz · Quizplayo" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
