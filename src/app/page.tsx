import Link from "next/link";
import { AnswerShape } from "@/components/AnswerShape";
import { FindSchool } from "@/components/FindSchool";
import { JoinWithPin } from "@/components/JoinWithPin";
import { SiteFooter, SiteHeader } from "@/components/ui/SiteChrome";
import { BRAND } from "@/lib/brand";

const DEMO_ANSWERS = ["Evaporation", "Condensation", "Precipitation", "Collection"];

const FEATURES = [
  { title: "Live games with a PIN", text: "Show a PIN, the class joins on any device with a nickname, and the scores appear as answers arrive. Players need no account." },
  { title: "AI Studio", text: "Type a topic and a grade: AI drafts the questions, checks every answer, and you approve them." },
  { title: "Ready on day one", text: "A library of quizzes for every grade from Kindergarten to Grade 12: pick your grades and host one straight away, or edit your own copy." },
  { title: "Made for schools too", text: "A school gets its own page and colours, accounts for teachers and students, and every result in one place." },
];

const STEPS = [
  { title: "Sign up", text: "Free, in a minute. No approval to wait for." },
  { title: "Create", text: "Write your own quiz, draft one with AI, or pick a ready one." },
  { title: "Host", text: "Put the PIN on the board." },
  { title: "Play", text: "Students join on any device and race to the podium." },
];

/** Public landing page: two equal ways in (a teacher on their own, or a whole school), and joining a game. */
export default function Landing() {
  return (
    <div className="landing">
      <SiteHeader />

      <section className="landing-hero">
        <div className="landing-hero-text">
          <p className="landing-kicker">Quizzes and live games for the classroom</p>
          <h1>{BRAND.tagline}</h1>
          <p className="landing-lead">
            Turn any topic into a quiz the whole class plays together: a PIN on the board, a question on every
            screen, and a podium at the end.
          </p>
          <div className="landing-choices">
            <Link className="landing-choice" href="/sign-up/teacher">
              <AnswerShape index={0} size={28} />
              <strong>I&apos;m a teacher</strong>
              <span>Host a game in a minute. Free, just for you and your class.</span>
              <span className="btn btn-primary">Sign up as a teacher</span>
            </Link>
            <Link className="landing-choice" href="/sign-up/school">
              <AnswerShape index={1} size={28} />
              <strong>I&apos;m a school</strong>
              <span>Bring {BRAND.name} to every class, with your own page, colours and accounts.</span>
              <span className="btn btn-primary">Sign up your school</span>
            </Link>
          </div>
          <p className="landing-note">
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </p>
        </div>

        <div className="landing-demo" aria-hidden="true">
          <div className="demo-pin">
            <span>Game PIN</span>
            <strong>623 625</strong>
          </div>
          <div className="demo-question">What turns water vapour into clouds?</div>
          <div className="demo-timer">
            <div />
          </div>
          <div className="demo-answers">
            {DEMO_ANSWERS.map((a, i) => (
              <div key={a} className={"demo-answer demo-a" + (i + 1) + (i === 1 ? " demo-correct" : "")}>
                <AnswerShape index={i} size={22} color="currentColor" />
                <span>{a}</span>
              </div>
            ))}
          </div>
          <div className="demo-podium">
            <span className="demo-p2">2</span>
            <span className="demo-p1">1</span>
            <span className="demo-p3">3</span>
          </div>
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-find card" aria-labelledby="join-game-title">
          <div>
            <h2 id="join-game-title">Joining a game?</h2>
            <p className="muted">Enter the PIN on your teacher&apos;s screen. No account needed.</p>
          </div>
          <JoinWithPin />
        </section>

        <section className="landing-find card" aria-labelledby="find-title">
          <div>
            <h2 id="find-title">Student at a school on {BRAND.name}?</h2>
            <p className="muted">Find your school to open its own sign-in page.</p>
          </div>
          <FindSchool />
        </section>

        <section id="features" aria-labelledby="features-title">
          <h2 id="features-title" className="landing-h2">
            Everything a class needs to play and learn
          </h2>
          <div className="landing-features">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="card landing-feature">
                <AnswerShape index={i} size={30} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-join card" aria-labelledby="how-title">
          <h2 id="how-title">From sign-up to podium in four steps</h2>
          <ol className="landing-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="landing-step-no">{i + 1}</span>
                <strong>{s.title}</strong>
                <span className="muted">{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="row" style={{ flexWrap: "wrap", gap: 12 }}>
            <Link className="btn btn-primary btn-big" href="/sign-up/teacher">Sign up as a teacher</Link>
            <Link className="btn btn-secondary btn-big" href="/sign-up/school">Sign up your school</Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
