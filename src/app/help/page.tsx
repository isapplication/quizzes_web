import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/ui/SiteChrome";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Help & contact" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "How do I start?", a: <>A teacher can <Link href="/sign-up/teacher">sign up on their own</Link> and host a game straight away. A school can <Link href="/sign-up/school">sign up as a school</Link> to give its teachers and students their own accounts. Both are free and need no approval.</> },
  { q: "How do teachers and admins sign in?", a: <>On the <Link href="/sign-in">sign-in page</Link>, with their email and password, or with a 6-digit code we email them. One account works for every school they belong to.</> },
  { q: "How do I join my school?", a: <>Your school admin invites you by email: open the link in it to join, with your existing account or a new password. If your school uses your email&apos;s domain on {BRAND.name}, you can also ask to join under <Link href="/workspaces">Your workspaces</Link>.</> },
  { q: "How do students sign in?", a: <>On their school&apos;s own {BRAND.name} page, with the username and password their school gave them. Find the school from the home page.</> },
  { q: "How do students join a game?", a: <>The teacher shows a game PIN on the board; students type it on the <Link href="/play">join page</Link>.</> },
  { q: "Can we use our own logo and colours?", a: <>Yes. Your school admin sets the logo, browser icon, colours and terms in Brand settings.</> },
  { q: "I can't sign in.", a: <>Choose &quot;Email me a code&quot; on the sign-in page. Students: ask your teacher to reset your password. If it keeps failing, write to us.</> },
];

export default function HelpPage() {
  return (
    <PublicShell narrow>
      <article className="legal card">
        <h1>Help &amp; contact</h1>
        <p>Answers to common questions. Can&apos;t find yours? Write to <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> and we&apos;ll reply within one working day.</p>
        {FAQ.map((f) => (
          <section key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
