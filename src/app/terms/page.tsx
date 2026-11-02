import type { Metadata } from "next";
import { PublicShell } from "@/components/ui/SiteChrome";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms" };

/** Placeholder terms until the legal text is provided. */
export default function TermsPage() {
  return (
    <PublicShell narrow>
      <article className="legal card">
        <h1>Terms of use</h1>
        <div className="alert alert-warning draft-note">
          Draft: this page is a placeholder. The final terms will replace this text before {BRAND.name} opens to schools.
        </div>
        <h2>Who these terms are for</h2>
        <p>These terms cover schools that register for {BRAND.name}, and the teachers, students and staff who use it through their school.</p>
        <h2>Your school&apos;s account</h2>
        <p>The person who registers a school confirms they may do so for that school. The school&apos;s admins decide who can use {BRAND.name} and keep their sign-in details safe.</p>
        <h2>Content</h2>
        <p>Schools keep the rights to the quizzes they create. Questions drafted with AI Studio are reviewed by a teacher before students see them.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
      </article>
    </PublicShell>
  );
}
