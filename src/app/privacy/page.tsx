import type { Metadata } from "next";
import { PublicShell } from "@/components/ui/SiteChrome";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy" };

/** Placeholder privacy notice until the legal text is provided. */
export default function PrivacyPage() {
  return (
    <PublicShell narrow>
      <article className="legal card">
        <h1>Privacy</h1>
        <div className="alert alert-warning draft-note">
          Draft: this page is a placeholder. The final privacy notice will replace this text before {BRAND.name} opens to schools.
        </div>
        <h2>What we keep</h2>
        <p>For each person: their name, school, role, classes and grade, as their school or their school&apos;s own system shares them. {BRAND.name} stores no passwords: everyone signs in with the account their school already gives them.</p>
        <h2>Students</h2>
        <p>Students are children. We keep only what a lesson needs, and each school&apos;s data is kept apart from every other school&apos;s.</p>
        <h2>Activity</h2>
        <p>Game joins, answers and results are recorded with the time, device and approximate city, so teachers can see progress and we can keep the service safe.</p>
        <h2>Contact</h2>
        <p>Privacy questions: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
      </article>
    </PublicShell>
  );
}
