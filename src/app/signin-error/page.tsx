import { PublicShell } from "@/components/ui/SiteChrome";
import { StatusCard } from "@/components/ui/States";

const MESSAGES: Record<string, { title: string; body: string }> = {
  school_suspended: {
    title: "Quizplayo is paused for your school",
    body: "Nobody at your school can sign in to Quizplayo at the moment. Please contact your school.",
  },
  school_closed: {
    title: "Your school no longer uses Quizplayo",
    body: "If you think this is a mistake, please contact your school.",
  },
  school_system_off: {
    title: "Your school hasn't switched on this sign-in yet",
    body: "Your school's admin connected its system to Quizplayo but hasn't switched it on. Please ask them, or sign in on your school's Quizplayo page.",
  },
  account_disabled: {
    title: "Your Quizplayo account is switched off",
    body: "Ask your school admin to switch it back on.",
  },
  token_replayed: {
    title: "That sign-in link was already used",
    body: "For your safety each sign-in works once. Open Quizplayo again from your school's system.",
  },
  token_expired: {
    title: "That sign-in link has expired",
    body: "Sign-in links from your school's system work for one minute. Open Quizplayo again from your school's system.",
  },
  unknown_school_system: {
    title: "Quizplayo doesn't know this school system",
    body: "Your school's system isn't connected to Quizplayo yet. Ask your school admin to connect it in Get started, then try again.",
  },
  bad_signature: {
    title: "Quizplayo couldn't check this sign-in",
    body: "The sign-in from your school's system didn't match the key your school saved in Quizplayo. Ask your school admin to check the key.",
  },
  wrong_audience: {
    title: "This sign-in wasn't meant for Quizplayo",
    body: "Your school's system sent a sign-in for another service. Ask your school admin to check its Quizplayo settings.",
  },
  missing_claims: {
    title: "Your school's system didn't say who you are",
    body: "The sign-in was missing your ID, name or role. Ask your school admin to check its Quizplayo settings.",
  },
  bad_token: {
    title: "Quizplayo couldn't read this sign-in",
    body: "Open Quizplayo again from your school's system. If it keeps happening, tell your school admin.",
  },
};

const FALLBACK = {
  title: "Sign-in did not work",
  body: "Quizplayo could not finish signing you in. Please try again; if it keeps happening, tell Quizplayo support.",
};

export default async function SignInError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || FALLBACK;
  const actions = [{ label: "Try again", href: "/sign-in", primary: true }];
  actions.push({ label: "Get help", href: "/help", primary: false });
  return (
    <PublicShell narrow>
      <StatusCard tone="problem" title={message.title} actions={actions}>
        <p>{message.body}</p>
      </StatusCard>
    </PublicShell>
  );
}
