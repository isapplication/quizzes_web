"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { nextFromUrl, Started, startTab } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";

interface Country {
  iso2: string;
  name: string;
}

/**
 * Sign-up as a teacher (a personal workspace) or as a school. Both start at once, with no review: the answer signs
 * this tab in. A school also gives its name and country; its admin is the person signing up.
 */
export function SignUpForm({ kind }: { kind: "teacher" | "school" }) {
  const school = kind === "school";
  const [schoolName, setSchoolName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!school) return;
    api<Country[]>("/api/v1/geo/countries").then(setCountries).catch(() => setCountries([]));
    api<{ countryIso2: string | null }>("/api/v1/geo/location")
      .then((l) => setCountryCode((c) => c || l.countryIso2 || ""))
      .catch(() => undefined);
  }, [school]);

  const passwordShort = password.length > 0 && password.length < 8;
  const ready = name.trim() && email.trim() && password.length >= 8 && acceptTerms
      && (!school || (schoolName.trim().length >= 2 && countryCode));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = school
          ? { schoolName, countryCode, name, email, password, acceptTerms, website, next: nextFromUrl() }
          : { name, email, password, acceptTerms, website, next: nextFromUrl() };
      startTab(await api<Started>("/api/v1/auth/login/sign-up/" + kind, { method: "POST", body }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not create your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      {school && (
        <>
          <div className="field">
            <label htmlFor="su-school">School name</label>
            <input id="su-school" type="text" autoComplete="organization" required maxLength={200} value={schoolName}
                   onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Al Noor International School" />
          </div>
          <div className="field">
            <label htmlFor="su-country">Country</label>
            <select id="su-country" required value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              <option value="" disabled>{countries.length ? "Choose a country" : "Loading countries…"}</option>
              {countries.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
            </select>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor="su-name">{school ? "Your name" : "Your name"}</label>
        <input id="su-name" type="text" autoComplete="name" required maxLength={120} value={name}
               onChange={(e) => setName(e.target.value)} placeholder="e.g. Huda Al-Harbi" />
        {school && <p className="hint">You&apos;ll be the school&apos;s first Quizplayo admin.</p>}
      </div>
      <div className="field">
        <label htmlFor="su-email">{school ? "Your work email" : "Email"}</label>
        <input id="su-email" type="email" autoComplete="email" required maxLength={254} value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder={school ? "name@school.org" : "name@example.com"} />
      </div>
      <div className="field">
        <label htmlFor="su-pass">Password</label>
        <PasswordInput id="su-pass" value={password} onChange={setPassword} autoComplete="new-password" describedBy="su-pass-hint" />
        <p className={passwordShort ? "hint hint-danger" : "hint"} id="su-pass-hint">At least 8 characters.</p>
      </div>
      {/* Left empty by people; bots fill it in. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="su-website">Website</label>
        <input id="su-website" type="text" tabIndex={-1} autoComplete="off" value={website}
               onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>I agree to the <Link href="/terms" target="_blank">terms of use</Link> and the{" "}
          <Link href="/privacy" target="_blank">privacy policy</Link>.</span>
      </label>
      <button className="btn btn-primary btn-big" type="submit" disabled={busy || !ready}>
        {busy ? "Creating your account…" : school ? "Create our school's account" : "Create my account"}
      </button>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <p className="muted" style={{ margin: 0 }}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
