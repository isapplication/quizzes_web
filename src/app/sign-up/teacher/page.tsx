import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";
import { PublicShell } from "@/components/ui/SiteChrome";

/** A teacher signs up on their own and starts at once in a personal workspace. */
export default function TeacherSignUp() {
  return (
    <PublicShell narrow>
      <div className="card stack auth-card">
        <div>
          <h1 style={{ margin: 0 }}>Sign up as a teacher</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Free. Create quizzes, host live games, and your students join with a PIN, no accounts needed.
          </p>
        </div>
        <SignUpForm kind="teacher" />
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        Signing up for a whole school? <Link href="/sign-up/school">Sign up your school</Link>
      </p>
    </PublicShell>
  );
}
