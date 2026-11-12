/**
 * Bring your own AI key (byok-ai-contract.md): every AI feature in a workspace runs on the workspace's own provider
 * key, which its school admin sets in AI settings. The shapes the Quiz API sends, and small pure helpers for the
 * AI settings page, AI Studio and every AI button.
 */
import type { SourceKind } from "./aiStudio";

export type ProviderId = "OPENAI" | "ANTHROPIC" | "OPENAI_COMPATIBLE";

/** A suggested model for a provider, with its estimated price (US dollars per million tokens). */
export interface AiModel {
  id: string;
  name: string;
  recommended: boolean;
  vision: boolean;
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
}

export interface AiProvider {
  id: ProviderId;
  name: string;
  needsBaseUrl: boolean;
  keyHint: string;
  help: string;
  recommendedModel: string | null;
  models: AiModel[];
}

/** GET/PUT /api/v1/admin/ai: the workspace's AI settings, never the key itself. */
export interface AiSettings {
  configured: boolean;
  provider: ProviderId | null;
  model: string | null;
  baseUrl: string | null;
  keyLast4: string | null;
  vision: boolean | null;
  pdf: boolean | null;
  monthlyLimitUsd: number | null;
  spentThisMonthUsd: number | null;
  consentAt: string | null;
  consentByName: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  workspaceKind: "SCHOOL" | "INDEPENDENT";
  providers: AiProvider[];
}

/** POST /api/v1/admin/ai/test: an answer, not an error, even when the provider refused the key. */
export interface AiTestResult {
  ok: boolean;
  vision: boolean;
  pdf: boolean;
  message: string;
}

/** GET /api/v1/ai/status, for anyone who uses AI (the older fields are kept). */
export interface AiStatus {
  mode: "LIVE" | "SAMPLE" | "OFF";
  model: string | null;
  promptVersion: string;
  notice: string | null;
  enabled: boolean;
  provider: ProviderId | "SAMPLE" | null;
  providerName: string | null;
  vision: boolean;
  pdf: boolean;
  canManage: boolean;
  message: string | null;
}

/** The model select's choice for a model id that isn't on the provider's list. */
export const OTHER_MODEL = "__other__";

/** The monthly limit's range, as the API checks it. */
export const LIMIT_MIN = 1;
export const LIMIT_MAX = 10_000;

/** What the admin has filled in on the AI settings form. */
export interface AiForm {
  provider: ProviderId;
  /** A model id from the list, or OTHER_MODEL. */
  modelChoice: string;
  /** The free-text model id, used when modelChoice is OTHER_MODEL (always, for a provider without a list). */
  otherModel: string;
  /** A newly typed key; blank keeps the saved one. */
  apiKey: string;
  baseUrl: string;
  limitOn: boolean;
  limit: string;
  consent: boolean;
}

/** "•••• x9Qa": all that is ever shown of a saved key. */
export function maskedKey(last4: string | null | undefined): string {
  return "•••• " + (last4 ?? "");
}

/** The model to start with: the provider's recommended one, else its first, else none (free text). */
export function defaultModel(provider: AiProvider | undefined): string {
  if (!provider || provider.models.length === 0) return "";
  if (provider.recommendedModel && provider.models.some((m) => m.id === provider.recommendedModel)) {
    return provider.recommendedModel;
  }
  return (provider.models.find((m) => m.recommended) ?? provider.models[0]).id;
}

/** The form for a provider: its saved values when it is the saved provider, otherwise its defaults. */
export function initialForm(settings: AiSettings, providerId?: ProviderId): AiForm {
  const id = providerId ?? settings.provider ?? settings.providers[0]?.id ?? "OPENAI";
  const provider = settings.providers.find((p) => p.id === id);
  const saved = settings.configured && settings.provider === id;
  const model = saved && settings.model ? settings.model : defaultModel(provider);
  const listed = !!provider && provider.models.some((m) => m.id === model);
  return {
    provider: id,
    modelChoice: listed ? model : OTHER_MODEL,
    otherModel: listed ? "" : model,
    apiKey: "",
    baseUrl: saved ? settings.baseUrl ?? "" : "",
    limitOn: settings.monthlyLimitUsd !== null && settings.monthlyLimitUsd !== undefined,
    limit: settings.monthlyLimitUsd != null ? String(settings.monthlyLimitUsd) : "",
    consent: false,
  };
}

/** The model id the form will save. */
export function chosenModel(form: AiForm): string {
  return (form.modelChoice === OTHER_MODEL ? form.otherModel : form.modelChoice).trim();
}

/** True when a key is saved that this provider and base URL can keep using without typing it again. */
export function canKeepKey(settings: AiSettings | null, form: AiForm, provider: AiProvider | undefined): boolean {
  if (!settings?.configured || !settings.keyLast4 || settings.provider !== form.provider) return false;
  if (!provider?.needsBaseUrl) return true;
  return (settings.baseUrl ?? "").trim() === form.baseUrl.trim();
}

/** The PUT /api/v1/admin/ai body. A blank key is left out, so the saved key stays. */
export function saveBody(form: AiForm, provider: AiProvider | undefined) {
  const key = form.apiKey.trim();
  const limit = Number(form.limit);
  return {
    provider: form.provider,
    model: chosenModel(form),
    ...(key ? { apiKey: key } : {}),
    baseUrl: provider?.needsBaseUrl ? form.baseUrl.trim() : null,
    monthlyLimitUsd: form.limitOn && form.limit.trim() !== "" && Number.isFinite(limit) ? limit : null,
    consent: form.consent,
  };
}

/** The POST /api/v1/admin/ai/test body: the typed values when a new key is typed, otherwise {} (the saved settings). */
export function testBody(form: AiForm, provider: AiProvider | undefined) {
  const key = form.apiKey.trim();
  if (!key) return {};
  return {
    provider: form.provider,
    model: chosenModel(form),
    apiKey: key,
    baseUrl: provider?.needsBaseUrl ? form.baseUrl.trim() : null,
  };
}

/** What stops the form being saved, in words; null when it can be sent (the API checks it all again). */
export function formProblem(form: AiForm, provider: AiProvider | undefined, keepKey: boolean): string | null {
  const model = chosenModel(form);
  if (!model) return "Choose a model, or type its model ID.";
  if (model.length > 80 || !/^[A-Za-z0-9._:/@-]+$/.test(model)) {
    return "A model ID uses letters, digits and . _ : / @ - only, up to 80 characters.";
  }
  if (!form.apiKey.trim() && !keepKey) return "Paste your API key.";
  if (provider?.needsBaseUrl && !/^https:\/\/\S+$/i.test(form.baseUrl.trim())) {
    return "Type the provider's base URL. It starts with https://.";
  }
  if (form.limitOn) {
    const n = Number(form.limit);
    if (form.limit.trim() === "" || !Number.isFinite(n) || n < LIMIT_MIN || n > LIMIT_MAX) {
      return "Set a monthly limit from $1 to $10,000, or untick \"Set a monthly limit\".";
    }
  }
  if (!form.consent) return "Tick the box to agree that quiz topics and teaching material are sent to your AI provider.";
  return null;
}

/** The consent the admin gives before saving. */
export function consentText(providerName: string): string {
  return "Quiz topics and teaching material are sent to " + providerName
    + " under your account; student names are never sent.";
}

/** "$1.25 in · $10.00 out per million tokens (estimate)", or null when the price isn't known. */
export function priceText(m: Pick<AiModel, "inputUsdPerMillion" | "outputUsdPerMillion">): string | null {
  if (m.inputUsdPerMillion == null || m.outputUsdPerMillion == null) return null;
  return "$" + m.inputUsdPerMillion.toFixed(2) + " in · $" + m.outputUsdPerMillion.toFixed(2)
    + " out per million tokens (estimate)";
}

/** Why AI is off, for the person looking: the API's own message, or its wording when there is none. */
export function aiOffMessage(status: Pick<AiStatus, "message" | "canManage">): string {
  if (status.message) return status.message;
  return status.canManage ? "AI is off until you add your AI provider's key in AI settings."
    : "Your school hasn't set up AI yet. Ask your school admin.";
}

/** False only when the status says AI is off; an unknown status leaves the buttons on (the API still answers). */
export function aiEnabled(status: Pick<AiStatus, "enabled"> | null | undefined): boolean {
  return status?.enabled !== false;
}

/** Photos need a model that reads pictures; PDFs need the provider's PDF support. Everything else is always offered. */
export function sourceAllowed(kind: SourceKind, status: Pick<AiStatus, "vision" | "pdf"> | null | undefined): boolean {
  if (kind === "PHOTOS") return status?.vision !== false;
  if (kind === "PDF") return status?.pdf !== false;
  return true;
}

export function visibleSources<T extends { kind: SourceKind }>(sources: T[], status: Pick<AiStatus, "vision" | "pdf"> | null | undefined): T[] {
  return sources.filter((s) => sourceAllowed(s.kind, status));
}

/** Who does the AI work, in words: the provider's name, or "The AI". */
export function aiName(status: Pick<AiStatus, "providerName" | "provider"> | null | undefined): string {
  if (!status?.providerName || status.provider === "SAMPLE") return "The AI";
  return status.providerName;
}

/** The platform console's read-only row for one workspace (GET /api/v1/platform/ai/ceilings). Never a key. */
export interface AiUsageRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  provider: ProviderId | null;
  model: string | null;
  keySet: boolean;
  /** The workspace's own monthly limit; null = no limit. */
  limitUsd: number | null;
  spentUsd: number;
  runs: number;
  /** No longer applies (Quizplayo doesn't pay for school AI); kept in the row by the API. */
  ceilingUsd?: number;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic Claude",
  OPENAI_COMPATIBLE: "Other (OpenAI-compatible)",
};

/** "OpenAI · gpt-5"; "Not set up" when there is no provider. */
export function providerModelText(provider: ProviderId | null | undefined, model: string | null | undefined): string {
  if (!provider) return "Not set up";
  const name = PROVIDER_NAMES[provider] ?? provider;
  return model ? name + " · " + model : name;
}

/** "$25.00", or "No limit". */
export function limitText(limitUsd: number | null | undefined): string {
  return limitUsd === null || limitUsd === undefined ? "No limit" : "$" + Number(limitUsd).toFixed(2);
}
