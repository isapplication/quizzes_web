import type { Metadata } from "next";

// Pages under /library keep the site-wide " · Quizplayo" suffix.
export const metadata: Metadata = { title: { absolute: "Library · Quizplayo", template: "%s · Quizplayo" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
