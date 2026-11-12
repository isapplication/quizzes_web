"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { forgetAiStatus } from "@/components/AiOffNotice";
import { api, ApiError } from "@/lib/api";
import {
  type AiForm, type AiSettings, type AiTestResult, canKeepKey, chosenModel, consentText, formProblem,
  initialForm, LIMIT_MAX, LIMIT_MIN, maskedKey, OTHER_MODEL, priceText, type ProviderId, providerModelText, saveBody,
  testBody,
} from "@/lib/aiSettings";
import { money } from "@/lib/aiStudio";
import { isSchoolAdmin, useMe } from "@/lib/me";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

/** AI settings: the school admin's own AI provider key, model and monthly limit (byok-ai-contract.md, section 2). */
export default function AiSettingsPage() {
  return (
    <AppFrame>
      <AiSettingsView />
    </AppFrame>
  );
}

function AiSettingsView() {
  const me = useMe();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [form, setForm] = useState<AiForm | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [test, setTest] = useState<AiTestResult | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);

  const show = useCallback((s: AiSettings) => {
    setSettings(s);
    setForm(initialForm(s));
    setReplacing(false);
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    api<AiSettings>("/api/v1/admin/ai").then(show)
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e.message : "Quizplayo could not load your AI settings."));
  }, [show]);

  useEffect(() => {
    if (isSchoolAdmin(me)) load();
  }, [me, load]);

  if (!isSchoolAdmin(me)) {
    return <div className="alert alert-danger">AI settings are for your school&apos;s Quizplayo admins.</div>;
  }

  const header = (
    <PageHeader title="AI settings"
                description={<>AI Studio, re-teach and class summaries use your own AI provider&apos;s key, under your
                  account: your provider charges you directly for what your teachers use. Until a key is added, AI is off.</>} />
  );
  if (loadError) return <div className="stack">{header}<ErrorState message={loadError} onRetry={load} /></div>;
  if (!settings || !form) return <div className="stack">{header}<LoadingState rows={5} label="Loading AI settings" /></div>;

  const provider = settings.providers.find((p) => p.id === form.provider);
  const keepKey = canKeepKey(settings, form, provider);
  const showKeyInput = !keepKey || replacing;
  const problem = formProblem(form, provider, keepKey);
  const savedHere = settings.configured && settings.provider === form.provider;
  const canTest = form.apiKey.trim() !== "" || keepKey;
  const selected = provider?.models.find((m) => m.id === chosenModel(form));
  const update = (patch: Partial<AiForm>) => {
    setForm({ ...form, ...patch });
    setNotice(null);
  };

  function pickProvider(pid: ProviderId) {
    if (!settings || !form) return;
    const next = initialForm(settings, pid);
    setForm({ ...next, limitOn: form.limitOn, limit: form.limit });
    setReplacing(false);
    setTest(null);
    setError(null);
    setNotice(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const s = await api<AiSettings>("/api/v1/admin/ai", { method: "PUT", body: saveBody(form, provider) });
      show(s);
      setTest(null);
      forgetAiStatus();
      setNotice("AI settings saved. AI is on for " + me.school.name + ".");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not save your AI settings. Please try again.");
    }
    setBusy(null);
  }

  async function runTest() {
    if (!form) return;
    setBusy("test");
    setError(null);
    setTest(null);
    try {
      setTest(await api<AiTestResult>("/api/v1/admin/ai/test", { method: "POST", body: testBody(form, provider) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not test the key. Please try again.");
    }
    setBusy(null);
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    setNotice(null);
    try {
      await api("/api/v1/admin/ai", { method: "DELETE" });
      forgetAiStatus();
      show(await api<AiSettings>("/api/v1/admin/ai"));
      setTest(null);
      setNotice("Your AI key and settings are removed. AI is off for " + me.school.name + ".");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not remove your AI settings. Please try again.");
    }
    setBusy(null);
  }

  return (
    <div className="stack">
      {header}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card stack" aria-labelledby={id + "-now"}>
        <div className="row">
          <h2 id={id + "-now"} className="brand-h2">Current settings</h2>
          <span className={"chip " + (settings.configured ? "chip-ok" : "chip-warn")}>{settings.configured ? "AI is on" : "AI is off"}</span>
        </div>
        {settings.configured ? (
          <dl className="detail-grid ai-details">
            <dt>Provider · model</dt>
            <dd>{providerModelText(settings.provider, settings.model)}</dd>
            <dt>Key</dt>
            <dd><span className="ai-key-mask">{maskedKey(settings.keyLast4)}</span></dd>
            {settings.baseUrl && <><dt>Base URL</dt><dd className="ai-wrap">{settings.baseUrl}</dd></>}
            <dt>Photos of notes</dt>
            <dd>{settings.vision ? "Allowed: this model reads pictures" : "Not offered: test the key to check whether this model reads pictures"}</dd>
            <dt>PDFs</dt>
            <dd>{settings.pdf ? "Allowed" : "Not offered"}</dd>
            <dt>Spent this month</dt>
            <dd>{money(Number(settings.spentThisMonthUsd ?? 0))} <span className="muted">(an estimate; your provider&apos;s bill is the real figure)</span></dd>
            <dt>Monthly limit</dt>
            <dd>{settings.monthlyLimitUsd != null ? "$" + Number(settings.monthlyLimitUsd).toFixed(2) : "No monthly limit set"}</dd>
            {settings.consentByName && (
              <><dt>Agreed by</dt><dd>{settings.consentByName}{settings.consentAt && ", " + new Date(settings.consentAt).toLocaleString()}</dd></>
            )}
            {settings.updatedByName && (
              <><dt>Last changed by</dt><dd>{settings.updatedByName}{settings.updatedAt && ", " + new Date(settings.updatedAt).toLocaleString()}</dd></>
            )}
          </dl>
        ) : (
          <p style={{ margin: 0 }}>
            No AI provider key yet, so AI Studio, re-teach and class summaries are off for your teachers. Choose a
            provider below and paste your API key to switch them on.
          </p>
        )}
      </section>

      <form className="card stack" onSubmit={save} noValidate aria-labelledby={id + "-form"}>
        <h2 id={id + "-form"} className="brand-h2">{settings.configured ? "Change your AI provider" : "Add your AI provider"}</h2>

        <fieldset className="ai-providers">
          <legend>AI provider</legend>
          <div className="ai-provider-cards">
            {settings.providers.map((p) => (
              <label key={p.id} className="ai-provider-card">
                <input type="radio" name="provider" value={p.id} checked={form.provider === p.id}
                       aria-describedby={id + "-help-" + p.id} onChange={() => pickProvider(p.id)} />
                <span className="ai-provider-text">
                  <strong>{p.name}</strong>
                  <span className="hint" id={id + "-help-" + p.id}>{p.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {provider?.needsBaseUrl && (
          <div className="field">
            <label htmlFor={id + "-base"}>Base URL</label>
            <input id={id + "-base"} type="url" inputMode="url" value={form.baseUrl} maxLength={500} autoComplete="off"
                   spellCheck={false} placeholder="https://api.example.com/v1" aria-describedby={id + "-base-hint"}
                   onChange={(e) => update({ baseUrl: e.target.value })} />
            <p className="hint" id={id + "-base-hint"}>The provider&apos;s OpenAI-compatible address. It must start with https:// and be on the public internet.</p>
          </div>
        )}

        <div className="form-grid">
          {provider && provider.models.length > 0 && (
            <div className="field">
              <label htmlFor={id + "-model"}>Model</label>
              <select id={id + "-model"} value={form.modelChoice} aria-describedby={id + "-price"}
                      onChange={(e) => update({ modelChoice: e.target.value })}>
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.recommended ? " (recommended)" : ""}</option>
                ))}
                <option value={OTHER_MODEL}>Other model ID…</option>
              </select>
              <p className="hint" id={id + "-price"}>
                {selected ? priceText(selected) ?? "No price estimate for this model." : "Type the model ID your provider gives it."}
              </p>
            </div>
          )}
          {(!provider || provider.models.length === 0 || form.modelChoice === OTHER_MODEL) && (
            <div className="field">
              <label htmlFor={id + "-other"}>{provider && provider.models.length > 0 ? "Other model ID" : "Model ID"}</label>
              <input id={id + "-other"} type="text" value={form.otherModel} maxLength={80} autoComplete="off"
                     spellCheck={false} autoCapitalize="off" aria-describedby={id + "-other-hint"}
                     onChange={(e) => update({ otherModel: e.target.value })} />
              <p className="hint" id={id + "-other-hint"}>Exactly as your provider writes it, for example gpt-5-mini. Letters, digits and . _ : / @ - only.</p>
            </div>
          )}
        </div>

        {provider && provider.models.some((m) => priceText(m)) && (
          <details className="ai-prices">
            <summary>Estimated prices per million tokens</summary>
            <ul>
              {provider.models.filter((m) => priceText(m)).map((m) => (
                <li key={m.id}><strong>{m.name}</strong>{m.recommended && " (recommended)"}: {priceText(m)}</li>
              ))}
            </ul>
            <p className="hint">Estimates only: your provider&apos;s own prices and bill are what you pay.</p>
          </details>
        )}

        <div className="field">
          <span className="field-label" id={id + "-key-label"}>API key</span>
          {!showKeyInput ? (
            <div className="row ai-key-saved" aria-labelledby={id + "-key-label"} role="group">
              <span className="ai-key-mask">{maskedKey(settings.keyLast4)}</span>
              <button type="button" className="btn btn-light" onClick={() => setReplacing(true)}>Replace</button>
              <button type="button" className="btn btn-light" disabled={busy !== null}
                      onClick={() => dialog.current?.showModal()}>Remove</button>
            </div>
          ) : (
            <>
              <input id={id + "-key"} type="password" value={form.apiKey} autoComplete="off" spellCheck={false}
                     autoCapitalize="off" maxLength={500} aria-labelledby={id + "-key-label"} aria-describedby={id + "-key-hint"}
                     onChange={(e) => update({ apiKey: e.target.value })} />
              <p className="hint" id={id + "-key-hint"}>
                {provider?.keyHint} Quizplayo stores it encrypted and never shows it again, only its last 4 characters.
              </p>
              {keepKey && replacing && (
                <div>
                  <button type="button" className="btn btn-light" onClick={() => { setReplacing(false); update({ apiKey: "" }); }}>
                    Keep the saved key
                  </button>
                </div>
              )}
            </>
          )}
          {savedHere && !keepKey && settings.keyLast4 && (
            <p className="hint">The base URL changed, so paste the key again.</p>
          )}
        </div>

        <div className="row">
          <button type="button" className="btn btn-light" onClick={runTest} disabled={busy !== null || !canTest}
                  aria-describedby={id + "-test-hint"}>
            {busy === "test" ? "Testing…" : "Test key"}
          </button>
          <span className="hint" id={id + "-test-hint"}>
            {form.apiKey.trim() ? "Tests the key you typed, with this model, without saving it."
              : canTest ? "Tests your saved settings." : "Paste a key to test it."}
          </span>
        </div>
        {test && (
          <div className={"alert " + (test.ok ? "alert-success" : "alert-warning")} role="status">
            {test.ok && <strong>The key works. </strong>}
            {test.message}
            {test.ok && (
              <> {test.vision ? " Photos of notes can be used." : " This model doesn't read pictures, so photos of notes won't be offered."}
                {test.pdf ? "" : " PDFs won't be offered."}</>
            )}
          </div>
        )}

        <fieldset className="ai-limit">
          <legend>Monthly spending limit (optional)</legend>
          <label className="check">
            <input type="checkbox" checked={form.limitOn} onChange={(e) => update({ limitOn: e.target.checked })} />
            <span>Set a monthly limit</span>
          </label>
          {form.limitOn && (
            <div className="field ai-limit-field">
              <label htmlFor={id + "-limit"}>Limit in US dollars</label>
              <div className="ai-money-input">
                <span aria-hidden="true">$</span>
                <input id={id + "-limit"} type="number" inputMode="decimal" min={LIMIT_MIN} max={LIMIT_MAX} step={1}
                       value={form.limit} aria-describedby={id + "-limit-hint"} onChange={(e) => update({ limit: e.target.value })} />
              </div>
            </div>
          )}
          <p className="hint" id={id + "-limit-hint"}>
            {form.limitOn ? "From $1 to $10,000. When it is reached, AI stops until the 1st of next month. " : "Off: AI keeps working whatever it costs. "}
            Spent this month: {money(Number(settings.spentThisMonthUsd ?? 0))} (an estimate).
          </p>
        </fieldset>

        <label className="check ai-consent">
          <input type="checkbox" checked={form.consent} required onChange={(e) => update({ consent: e.target.checked })} />
          <span>{consentText(provider?.name ?? "your AI provider")}</span>
        </label>

        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {settings.configured && (
            <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => dialog.current?.showModal()}>
              Remove AI settings
            </button>
          )}
        </div>
      </form>

      <dialog ref={dialog} className="report-dialog ai-dialog" aria-labelledby={id + "-remove-title"}
              onClose={(e) => {
                const d = e.currentTarget;
                const choice = d.returnValue;
                d.returnValue = "";
                if (choice === "remove") void remove();
              }}>
        <form method="dialog" className="stack">
          <h2 id={id + "-remove-title"}>Remove your AI key?</h2>
          <p>
            Quizplayo deletes the key and these settings. AI Studio, re-teach and class summaries switch off for everyone
            in {me.school.name} until you add a key again. Quizzes already made stay.
          </p>
          <div className="row">
            <button type="submit" value="cancel" className="btn btn-light">Keep it</button>
            <button type="submit" value="remove" className="btn btn-danger">Remove</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
