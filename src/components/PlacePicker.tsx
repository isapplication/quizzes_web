"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface Place {
  countryCode: string;
  stateId: number | null;
  cityId: number | null;
  city: string;
}

export interface Country {
  iso2: string;
  name: string;
  phoneCode: string | null;
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

/**
 * Country → state → city, from Quizplayo's place lists. The city can be picked from the list (searched as the
 * person types) or typed when it is not listed. Calls {@code onCountry} so the form can use the dial code.
 */
export function PlacePicker({ value, onChange, onCountry, idPrefix = "place" }: {
  value: Place;
  onChange: (p: Place) => void;
  onCountry?: (c: Country | null) => void;
  idPrefix?: string;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[] | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api<Country[]>("/api/v1/geo/countries")
      .then(setCountries)
      .catch(() => setLoadError("The country list did not load. Please refresh the page."));
  }, []);

  useEffect(() => {
    onCountry?.(countries.find((c) => c.iso2 === value.countryCode) ?? null);
  }, [countries, value.countryCode, onCountry]);

  useEffect(() => {
    if (!value.countryCode) {
      setStates(null);
      return;
    }
    setStates(null);
    api<State[]>(`/api/v1/geo/countries/${value.countryCode}/states`).then(setStates).catch(() => setStates([]));
  }, [value.countryCode]);

  useEffect(() => {
    const q = value.city.trim();
    const noStates = states !== null && states.length === 0;
    if (!value.countryCode || (value.stateId == null && !noStates)) {
      setCities([]);
      return;
    }
    const path = value.stateId != null
      ? `/api/v1/geo/states/${value.stateId}/cities`
      : `/api/v1/geo/countries/${value.countryCode}/cities`;
    const timer = setTimeout(() => {
      api<City[]>(`${path}?q=${encodeURIComponent(q)}`).then(setCities).catch(() => setCities([]));
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [value.city, value.stateId, value.countryCode, states]);

  const hasStates = states !== null && states.length > 0;

  function typeCity(text: string) {
    const match = cities.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
    onChange({ ...value, city: text, cityId: match ? match.id : null });
  }

  return (
    <>
      {loadError && <div className="alert alert-danger wide">{loadError}</div>}
      <div className="field">
        <label htmlFor={`${idPrefix}-country`}>Country</label>
        <select id={`${idPrefix}-country`} value={value.countryCode}
                onChange={(e) => onChange({ countryCode: e.target.value, stateId: null, cityId: null, city: "" })}>
          <option value="">Choose…</option>
          {countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>{(c.emoji ? c.emoji + " " : "") + c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-state`}>State or region</label>
        <select id={`${idPrefix}-state`} value={value.stateId ?? ""} disabled={!value.countryCode || !hasStates}
                onChange={(e) => onChange({ ...value, stateId: e.target.value ? Number(e.target.value) : null, cityId: null, city: "" })}>
          <option value="">
            {!value.countryCode ? "Choose a country first" : states === null ? "Loading…" : hasStates ? "Choose…" : "No states — go to city"}
          </option>
          {(states ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-city`}>City</label>
        <input id={`${idPrefix}-city`} type="text" list={`${idPrefix}-cities`} maxLength={100} autoComplete="off"
               value={value.city} disabled={!value.countryCode || (hasStates && value.stateId == null)}
               placeholder={hasStates && value.stateId == null ? "Choose the state first" : "Start typing the city"}
               onChange={(e) => typeCity(e.target.value)} />
        <datalist id={`${idPrefix}-cities`}>
          {cities.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <p className="hint">
          {value.city && value.cityId == null ? "Not in our list — we'll keep it as you typed it." : "Pick from the list, or type it if it isn't there."}
        </p>
      </div>
    </>
  );
}
