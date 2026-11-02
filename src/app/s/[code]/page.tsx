"use client";

import { use, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { applyIcon, applyTheme, SchoolBrand } from "@/lib/me";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";
import { SchoolSignInForms } from "@/components/SchoolSignInForms";

interface SchoolPage {
  id: string;
  name: string;
  city: string | null;
  status: string;
  theme: Record<string, string>;
  /** The school's own system, when it is connected; null otherwise. */
  signInUrl: string | null;
  brand: SchoolBrand;
}

/** A school's own Quizplayo sign-in page, /s/<school code>, in the school's colours. Public. */
export default function SchoolSignIn({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [school, setSchool] = useState<SchoolPage | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<SchoolPage>("/api/v1/schools/by-code/" + encodeURIComponent(code)),
      api<{ methods: string[] }>("/api/v1/schools/by-code/" + encodeURIComponent(code) + "/sign-in"),
    ])
      .then(([s, m]) => {
        applyTheme(s.theme ?? {});
        applyIcon(s.brand?.iconUrl);
        setMethods(m.methods);
        setSchool(s);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this school."));
  }, [code]);

  return (
    <PublicShell narrow>
        {error && (
          <StatusCard tone="problem" title="School not found"
                      actions={[{ label: "Find your school", href: "/", primary: true }, { label: "Sign up your school", href: "/sign-up/school" }]}>
            <p>{error}</p>
          </StatusCard>
        )}
        {!error && !school && <LoadingState rows={4} label="Loading the school" />}
        {school && (
          <div className="stack">
            <div className="school-hero">
              {school.brand?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="school-hero-logo" src={school.brand.logoUrl} alt={school.name + " logo"} />
              )}
              <h1>{school.name}</h1>
              <p style={{ marginTop: 6, opacity: 0.9 }}>{school.city ? school.city + " · " : ""}Quizplayo</p>
            </div>
            <div className="card stack">
              {school.status === "SUSPENDED" ? (
                <div className="alert alert-warning">Quizplayo is paused for {school.name}. Please contact your school.</div>
              ) : (
                <>
                  <h2 style={{ margin: 0 }}>Sign in</h2>
                  <SchoolSignInForms school={code} methods={methods}
                                     schoolSystemUrl={school.signInUrl} />
                </>
              )}
            </div>
            {school.brand?.termsUrl && (
              <p className="muted" style={{ textAlign: "center" }}>
                <a href={school.brand.termsUrl} target="_blank" rel="noopener">{school.name} terms and conditions</a>
              </p>
            )}
          </div>
        )}
    </PublicShell>
  );
}
