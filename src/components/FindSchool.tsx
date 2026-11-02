"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface Found {
  name: string;
  city: string | null;
  code: string;
}

/** "Find your school": live schools whose name or code contains what was typed (3 letters or more). */
export function FindSchool() {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setFound(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Found[]>("/api/v1/schools/search?q=" + encodeURIComponent(q))
        .then((list) => {
          setFound(list);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not search right now."));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="stack" style={{ textAlign: "left" }}>
      <div className="field">
        <label htmlFor="find-school">Find your school</label>
        <input
          id="find-school"
          type="text"
          placeholder="Type at least 3 letters of the school's name"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {found && found.length === 0 && (
        <p className="muted">
          No school on Quizplayo matches &quot;{query.trim()}&quot;. Check the spelling, or{" "}
          <Link href="/sign-up/school">sign up your school</Link>.
        </p>
      )}
      {found && found.length > 0 && (
        <ul className="search-results">
          {found.map((s) => (
            <li key={s.code}>
              <Link href={"/s/" + s.code} prefetch={false}>
                <strong>{s.name}</strong>
                <span className="muted">{s.city ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
