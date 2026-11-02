import type { Metadata } from "next";
import { PublicShell } from "@/components/ui/SiteChrome";
import { StatusCard } from "@/components/ui/States";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PublicShell narrow>
      <StatusCard tone="info" title="Page not found"
                  actions={[{ label: "Go to the home page", href: "/", primary: true }, { label: "Get help", href: "/help" }]}>
        <p>The page you opened does not exist or has moved. Check the address, or start again from the home page.</p>
      </StatusCard>
    </PublicShell>
  );
}
