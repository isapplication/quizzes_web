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
  wrong_token_type: {
    title: "Your school's system sent the wrong kind of token",
    body: "This token was made for something other than signing in. Ask whoever runs your school's system to send a sign-in token.",
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
  school_not_active: {
    title: "Quizplayo isn't open for your school right now",
    body: "Your school's Quizplayo is being set up, paused or closed, so nobody can sign in at the moment. Please contact your school.",
  },
  too_many: {
    title: "Too many sign-ins at once",
    body: "Quizplayo had too many sign-ins from your network in the last minute. Wait a minute, then open Quizplayo again.",
  },
  // Opening Quizplayo from an LMS (LTI 1.3).
  lti_bad_request: {
    title: "Your LMS sent an incomplete request",
    body: "Your LMS didn't send everything Quizplayo needs to sign you in. Open Quizplayo from your course again; if it keeps happening, ask your school admin to check the Quizplayo tool in your LMS.",
  },
  lti_unknown_platform: {
    title: "Your school hasn't connected this LMS to Quizplayo",
    body: "Quizplayo doesn't know this LMS, or its client ID differs from the one saved in Quizplayo. Ask your school admin to check Your LMS in Quizplayo.",
  },
  lti_switched_off: {
    title: "Your school has switched off Quizplayo in its LMS",
    body: "Your school admin connected your LMS to Quizplayo but it is switched off. Please ask them to switch it on.",
  },
  lti_expired: {
    title: "The sign-in took too long",
    body: "Opening Quizplayo from your LMS has to finish within a few minutes. Open Quizplayo from your course again.",
  },
  lti_invalid_token: {
    title: "Quizplayo couldn't check this sign-in from your LMS",
    body: "The sign-in from your LMS didn't pass Quizplayo's checks. Open Quizplayo from your course again; if it keeps happening, ask your school admin to check the key set address in Your LMS.",
  },
  lti_wrong_audience: {
    title: "This sign-in wasn't meant for Quizplayo",
    body: "Your LMS sent a sign-in for another tool, or with another client ID. Ask your school admin to check the client ID in Your LMS.",
  },
  lti_expired_token: {
    title: "That sign-in from your LMS has expired",
    body: "Open Quizplayo from your course again. If it keeps happening, the clock on your LMS's server may be wrong: tell your school admin.",
  },
  lti_replayed: {
    title: "That sign-in was already used",
    body: "For your safety each sign-in from your LMS works once. Open Quizplayo from your course again.",
  },
  lti_wrong_deployment: {
    title: "Quizplayo doesn't know this deployment of your LMS",
    body: "Your LMS used a deployment ID your school hasn't saved in Quizplayo. Ask your school admin to add it in Your LMS.",
  },
  lti_unsupported: {
    title: "Quizplayo can't open this kind of link",
    body: "Your LMS asked for something Quizplayo doesn't do (Quizplayo supports LTI 1.3 launches and adding content). Ask your school admin to check the Quizplayo tool in your LMS.",
  },
  lti_role: {
    title: "Your role can't do this",
    body: "Only teachers can add Quizplayo to a course, and Quizplayo needs your LMS to say whether you are a teacher or a student. Ask your school admin if this looks wrong.",
  },
  lti_platform_error: {
    title: "Your LMS stopped the sign-in",
    body: "Your LMS answered with an error instead of signing you in. Open Quizplayo from your course again; if it keeps happening, ask your school admin.",
  },
};

const FALLBACK = {
  title: "Sign-in did not work",
  body: "Quizplayo could not finish signing you in. Please try again; if it keeps happening, tell Quizplayo support.",
};

export default async function SignInError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = (reason && Object.hasOwn(MESSAGES, reason) && MESSAGES[reason]) || FALLBACK;
  // From an LMS, "try again" means opening Quizplayo from the course again (each message says so), not Quizplayo's sign-in.
  const fromLms = !!reason && reason.startsWith("lti_");
  const actions = fromLms ? [] : [{ label: "Try again", href: "/sign-in", primary: true }];
  actions.push({ label: "Get help", href: "/help", primary: fromLms });
  return (
    <PublicShell narrow>
      <StatusCard tone="problem" title={message.title} actions={actions}>
        <p>{message.body}</p>
      </StatusCard>
    </PublicShell>
  );
}
