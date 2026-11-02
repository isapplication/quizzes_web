import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";
import { PublicShell } from "@/components/ui/SiteChrome";

/** A school signs up and is live at once; the person signing up is its first admin. */
export default function SchoolSignUp() {
  return (
    <PublicShell narrow>
      <div className="card stack auth-card">
        <div>
          <h1 style={{ margin: 0 }}>Sign up your school</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Free. Your school gets its own sign-in page, its own colours, and accounts for your teachers and students.
            You can start straight away; adding people is optional.
          </p>
        </div>
        <SignUpForm kind="school" />
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        Just you and your class? <Link href="/sign-up/teacher">Sign up as a teacher</Link>
      </p>
    </PublicShell>
  );
}
