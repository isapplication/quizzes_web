"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { LoadingState } from "@/components/ui/States";

interface Settings {
  bypass: boolean;
  countryIso2: string | null;
  country: string | null;
  stateId: number | null;
  state: string | null;
  cityId: number | null;
  city: string | null;
  timezone: string | null;
  currency: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  cachedAddresses: number;
  ipApiKeySet: boolean;
  cacheDays: number;
}

interface Country {
  iso2: string;
  name: string;
  currency: string | null;
  emoji: string | null;
}

interface State {
  id: number;
  name: string;
}

interface City {
  id: number;
  name: string;
}

interface Visitor {
  source: string;
  country: string | null;
  state: string | null;
  city: string | null;
  timezone: string | null;
  currency: string | null;
  phoneCode: string | null;
}

const SOURCES: Record<string, string> = {
  bypass: "Default location (lookup is off)",
  ip: "Looked up from your address",
  default: "Default location (your address could not be looked up)",
};

/** Platform console → Settings: the location lookup switch and the default location. */
export function LocationSettings({ onError, onNotice }: {
  onError: (m: string | null) => void;
  onNotice: (m: string | null) => void;
}) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [bypass, setBypass] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [iso2, setIso2] = useState("");
  const [states, setStates] = useState<State[]>([]);
  const [stateId, setStateId] = useState<number | null>(null);
  const [cityText, setCityText] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<Visitor | null>(null);

  function fill(s: Settings) {
    setSaved(s);
    setBypass(s.bypass);
    setIso2(s.countryIso2 ?? "");
    setStateId(s.stateId);
    setCityText(s.city ?? "");
    setTimezone(s.timezone ?? "");
    setCurrency(s.currency ?? "");
  }

  useEffect(() => {
    Promise.all([api<Settings>("/api/v1/platform/settings/location"), api<Country[]>("/api/v1/geo/countries")])
      .then(([s, c]) => {
        setCountries(c);
        fill(s);
      })
      .catch((e: unknown) => onError(e instanceof ApiError ? e.message : "Quizplayo could not load the settings."));
  }, [onError]);

  useEffect(() => {
    if (!iso2) {
      setStates([]);
      return;
    }
    api<State[]>(`/api/v1/geo/countries/${iso2}/states`)
      .then(setStates)
      .catch(() => setStates([]));
  }, [iso2]);

  useEffect(() => {
    const q = cityText.trim();
    if (!iso2 || q.length < 2) {
      setCities([]);
      return;
    }
    const path = stateId != null ? `/api/v1/geo/states/${stateId}/cities` : `/api/v1/geo/countries/${iso2}/cities`;
    const timer = setTimeout(() => {
      api<City[]>(`${path}?q=${encodeURIComponent(q)}`).then(setCities).catch(() => setCities([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [cityText, stateId, iso2]);

  function chooseCountry(code: string) {
    setIso2(code);
    setStateId(null);
    setCityText("");
    const c = countries.find((x) => x.iso2 === code);
    if (c?.currency) setCurrency(c.currency);
  }

  async function save() {
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const match = cities.find((c) => c.name.toLowerCase() === cityText.trim().toLowerCase());
      const s = await api<Settings>("/api/v1/platform/settings/location", {
        method: "PUT",
        body: { bypass, countryIso2: iso2, stateId, cityId: match?.id ?? null, city: cityText.trim() || null, timezone, currency },
      });
      fill(s);
      setTest(null);
      onNotice("Saved. Every Quizplayo server uses the new settings within 10 seconds.");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not save the settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    onError(null);
    try {
      setTest(await api<Visitor>("/api/v1/platform/settings/location/test"));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not test the location lookup.");
    }
  }

  if (!saved) return <LoadingState rows={3} />;

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="card stack" aria-labelledby="loc-title">
        <div>
          <h2 id="loc-title">Visitor location</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Used to pre-fill country, state and city on forms, and in the activity log and school registrations.
          </p>
        </div>

        <label className="switch-row">
          <input type="checkbox" checked={!bypass} onChange={(e) => setBypass(!e.target.checked)} />
          <span>
            <strong>Look up each visitor&apos;s location</strong>
            <span className="hint" style={{ display: "block" }}>
              {bypass
                ? "Off: everyone gets the default location below, and no lookup is made."
                : `On: each address is looked up once at ip-api and kept for ${saved.cacheDays} days; anything that cannot be looked up gets the default location.`}
            </span>
          </span>
        </label>
        {!bypass && !saved.ipApiKeySet && (
          <div className="alert alert-warning">
            The ip-api key (ISQUIZ_IP_API_KEY) is not set on this server, so every visitor will still get the
            default location. Add it to the server&apos;s settings file and restart the Quiz API.
          </div>
        )}

        <h3>Default location</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="loc-country">Country</label>
            <select id="loc-country" value={iso2} onChange={(e) => chooseCountry(e.target.value)}>
              <option value="">Choose…</option>
              {countries.map((c) => (
                <option key={c.iso2} value={c.iso2}>{(c.emoji ? c.emoji + " " : "") + c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="loc-state">State or region</label>
            <select id="loc-state" value={stateId ?? ""} disabled={!iso2 || states.length === 0}
                    onChange={(e) => { setStateId(e.target.value ? Number(e.target.value) : null); setCityText(""); }}>
              <option value="">{states.length === 0 ? "No states for this country" : "Choose…"}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="loc-city">City</label>
            <input id="loc-city" type="text" list="loc-city-list" maxLength={100} value={cityText} disabled={!iso2}
                   placeholder="Type 2 letters to search" onChange={(e) => setCityText(e.target.value)} />
            <datalist id="loc-city-list">
              {cities.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="loc-tz">Time zone</label>
            <input id="loc-tz" type="text" maxLength={60} value={timezone} placeholder="Asia/Singapore"
                   onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="loc-cur">Currency</label>
            <input id="loc-cur" type="text" maxLength={3} value={currency} placeholder="SGD"
                   onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !iso2}>
            {busy ? "Saving…" : "Save settings"}
          </button>
          <button className="btn btn-light" type="button" onClick={runTest}>Test lookup</button>
          <span className="muted">
            {saved.updatedAt ? `Last changed ${new Date(saved.updatedAt).toLocaleString()} by ${saved.updatedBy ?? "—"}` : ""}
            {" · "}{saved.cachedAddresses} addresses remembered
          </span>
        </div>

        {test && (
          <div className="alert">
            <strong>{SOURCES[test.source] ?? test.source}:</strong>{" "}
            {[test.city, test.state, test.country].filter(Boolean).join(", ") || "—"}
            {test.timezone ? ` · ${test.timezone}` : ""}
            {test.currency ? ` · ${test.currency}` : ""}
            {test.phoneCode ? ` · +${test.phoneCode}` : ""}
          </div>
        )}
      </section>
    </div>
  );
}
