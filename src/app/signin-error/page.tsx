import { PublicShell } from "@/components/ui/SiteChrome";
import { StatusCard } from "@/components/ui/States";

const MESSAGES: Record<string, { title: string; body: string }> = {
  school_not_enabled: {
    title: "Your school is not on Quizplayo yet",
    body: "Your school can sign up for Quizplayo in a minute, or a teacher can sign up on their own.",
  },
  school_suspended: {
    title: "Quizplayo is paused for your school",
    body: "Nobody at your school can sign in to Quizplayo at the moment. Please contact your school.",
  },
  school_closed: {
    title: "Your school no longer uses Quizplayo",
    body: "If you think this is a mistake, please contact your school.",
  },
  school_mismatch: {
    title: "This link is for a different school",
    body: "You are signed in to the school portal with an account from another school. Sign out of the school portal, sign in with your account for this school, and open Quizplayo again.",
  },
  account_disabled: {
    title: "Your Quizplayo account is switched off",
    body: "Ask your school admin to switch it back on.",
  },
  token_replayed: {
    title: "That sign-in link was already used",
    body: "For your safety each sign-in works once. Open Quizplayo again from the school portal.",
  },
  missing_claims: {
    title: "The school portal did not tell us who you are",
    body: "The school portal sign-in did not include your user or school. Please tell Quizplayo support.",
  },
  bad_link: {
    title: "This Quizplayo link is broken",
    body: "The school in the link is not valid. Open Quizplayo again from the school portal.",
  },
};

const FALLBACK = {
  title: "Sign-in did not work",
  body: "Quizplayo could not finish signing you in with your school account. Please try again; if it keeps happening, tell Quizplayo support.",
};

export default async function SignInError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || FALLBACK;
  const actions = [{ label: "Try again", href: "/sign-in", primary: true }];
  if (reason === "school_not_enabled") actions.push({ label: "Sign up your school", href: "/sign-up/school", primary: false });
  actions.push({ label: "Get help", href: "/help", primary: false });
  return (
    <PublicShell narrow>
      <StatusCard tone="problem" title={message.title} actions={actions}>
        <p>{message.body}</p>
      </StatusCard>
    </PublicShell>
  );
}
