import { describe, expect, it } from "vitest";
import {
  aiEnabled, aiName, aiOffMessage, type AiProvider, type AiSettings, canKeepKey, chosenModel, consentText, defaultModel,
  formProblem, initialForm, limitText, maskedKey, OTHER_MODEL, priceText, providerModelText, saveBody, sourceAllowed,
  testBody, visibleSources,
} from "../../lib/aiSettings";
import { SOURCES } from "../../lib/aiStudio";

const openai: AiProvider = {
  id: "OPENAI", name: "OpenAI", needsBaseUrl: false, keyHint: "Starts with sk-.",
  help: "ChatGPT models are used with an OpenAI API key.", recommendedModel: "gpt-5",
  models: [
    { id: "gpt-5-mini", name: "GPT-5 mini", recommended: false, vision: true, inputUsdPerMillion: 0.25, outputUsdPerMillion: 2 },
    { id: "gpt-5", name: "GPT-5", recommended: true, vision: true, inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  ],
};
const other: AiProvider = {
  id: "OPENAI_COMPATIBLE", name: "Other (OpenAI-compatible)", needsBaseUrl: true, keyHint: "", help: "",
  recommendedModel: null, models: [],
};

const notSetUp: AiSettings = {
  configured: false, provider: null, model: null, baseUrl: null, keyLast4: null, vision: null, pdf: null,
  monthlyLimitUsd: null, spentThisMonthUsd: 0, consentAt: null, consentByName: null, updatedAt: null, updatedByName: null,
  workspaceKind: "SCHOOL", providers: [openai, other],
};
const saved: AiSettings = { ...notSetUp, configured: true, provider: "OPENAI", model: "gpt-5", keyLast4: "x9Qa",
  vision: true, pdf: true, monthlyLimitUsd: 25, spentThisMonthUsd: 1.23 };

describe("the saved key and the model to start with", () => {
  it("shows only the last 4 characters of a saved key", () => {
    expect(maskedKey("x9Qa")).toBe("•••• x9Qa");
  });

  it("starts with the provider's recommended model, or free text when it has no list", () => {
    expect(defaultModel(openai)).toBe("gpt-5");
    expect(defaultModel({ ...openai, recommendedModel: null })).toBe("gpt-5");
    expect(defaultModel({ ...openai, recommendedModel: "gone", models: [openai.models[0]] })).toBe("gpt-5-mini");
    expect(defaultModel(other)).toBe("");
    expect(defaultModel(undefined)).toBe("");
  });

  it("fills the form from the saved settings, with a model off the list as Other model ID", () => {
    expect(initialForm(notSetUp)).toMatchObject({ provider: "OPENAI", modelChoice: "gpt-5", apiKey: "", limitOn: false, consent: false });
    expect(initialForm(saved)).toMatchObject({ modelChoice: "gpt-5", limitOn: true, limit: "25" });
    const custom = initialForm({ ...saved, model: "gpt-5-2026-01" });
    expect(custom.modelChoice).toBe(OTHER_MODEL);
    expect(chosenModel(custom)).toBe("gpt-5-2026-01");
    expect(initialForm(saved, "OPENAI_COMPATIBLE")).toMatchObject({ modelChoice: OTHER_MODEL, otherModel: "", baseUrl: "" });
  });
});

describe("saving and testing", () => {
  it("leaves a blank key out, so the saved key stays", () => {
    const form = { ...initialForm(saved), consent: true };
    expect(saveBody(form, openai)).toEqual({ provider: "OPENAI", model: "gpt-5", baseUrl: null, monthlyLimitUsd: 25, consent: true });
    expect(saveBody({ ...form, apiKey: "  sk-new  ", limitOn: false }, openai))
      .toEqual({ provider: "OPENAI", model: "gpt-5", apiKey: "sk-new", baseUrl: null, monthlyLimitUsd: null, consent: true });
  });

  it("sends a base URL only for an OpenAI-compatible provider", () => {
    const form = { ...initialForm(notSetUp, "OPENAI_COMPATIBLE"), otherModel: "llama-3.1-70b", apiKey: "k",
      baseUrl: " https://api.example.com/v1 ", consent: true };
    expect(saveBody(form, other)).toMatchObject({ model: "llama-3.1-70b", baseUrl: "https://api.example.com/v1" });
    expect(saveBody({ ...form, provider: "OPENAI" }, openai).baseUrl).toBeNull();
  });

  it("tests the typed values when a new key is typed, else the saved settings", () => {
    expect(testBody(initialForm(saved), openai)).toEqual({});
    expect(testBody({ ...initialForm(saved), apiKey: "sk-x" }, openai))
      .toEqual({ provider: "OPENAI", model: "gpt-5", apiKey: "sk-x", baseUrl: null });
  });

  it("keeps a saved key only for the same provider and base URL", () => {
    expect(canKeepKey(saved, initialForm(saved), openai)).toBe(true);
    expect(canKeepKey(saved, initialForm(saved, "OPENAI_COMPATIBLE"), other)).toBe(false);
    expect(canKeepKey(notSetUp, initialForm(notSetUp), openai)).toBe(false);
    const compat = { ...saved, provider: "OPENAI_COMPATIBLE" as const, baseUrl: "https://a.example/v1" };
    expect(canKeepKey(compat, { ...initialForm(compat), baseUrl: "https://a.example/v1" }, other)).toBe(true);
    expect(canKeepKey(compat, { ...initialForm(compat), baseUrl: "https://b.example/v1" }, other)).toBe(false);
  });

  it("says what is missing before saving", () => {
    const ok = { ...initialForm(saved), consent: true };
    expect(formProblem(ok, openai, true)).toBeNull();
    expect(formProblem(ok, openai, false)).toMatch(/Paste your API key/);
    expect(formProblem({ ...ok, consent: false }, openai, true)).toMatch(/Tick the box/);
    expect(formProblem({ ...ok, modelChoice: OTHER_MODEL, otherModel: "" }, openai, true)).toMatch(/Choose a model/);
    expect(formProblem({ ...ok, modelChoice: OTHER_MODEL, otherModel: "bad model!" }, openai, true)).toMatch(/model ID/);
    expect(formProblem({ ...ok, limit: "0" }, openai, true)).toMatch(/\$1 to \$10,000/);
    expect(formProblem({ ...ok, limit: "10001" }, openai, true)).toMatch(/\$1 to \$10,000/);
    expect(formProblem({ ...ok, limitOn: false, limit: "0" }, openai, true)).toBeNull();
    const compat = { ...ok, provider: "OPENAI_COMPATIBLE" as const, otherModel: "m", modelChoice: OTHER_MODEL, apiKey: "k" };
    expect(formProblem({ ...compat, baseUrl: "http://x.example" }, other, false)).toMatch(/https:\/\//);
    expect(formProblem({ ...compat, baseUrl: "https://x.example/v1" }, other, false)).toBeNull();
  });
});

describe("words the pages show", () => {
  it("names the provider in the consent and never says Quizplayo pays", () => {
    expect(consentText("OpenAI")).toBe("Quiz topics and teaching material are sent to OpenAI under your account; student names are never sent.");
  });

  it("shows estimated prices per million tokens", () => {
    expect(priceText(openai.models[1])).toBe("$1.25 in · $10.00 out per million tokens (estimate)");
    expect(priceText({ inputUsdPerMillion: null, outputUsdPerMillion: null })).toBeNull();
  });

  it("shows the API's message when AI is off, with the right wording for each person", () => {
    expect(aiOffMessage({ message: "From the API.", canManage: false })).toBe("From the API.");
    expect(aiOffMessage({ message: null, canManage: false })).toBe("Your school hasn't set up AI yet. Ask your school admin.");
    expect(aiOffMessage({ message: null, canManage: true })).toMatch(/AI settings/);
    expect(aiEnabled({ enabled: false })).toBe(false);
    expect(aiEnabled({ enabled: true })).toBe(true);
    expect(aiEnabled(null)).toBe(true);
  });

  it("calls the AI by its provider's name, or 'The AI'", () => {
    expect(aiName({ provider: "ANTHROPIC", providerName: "Anthropic Claude" })).toBe("Anthropic Claude");
    expect(aiName({ provider: "SAMPLE", providerName: "Sample" })).toBe("The AI");
    expect(aiName(null)).toBe("The AI");
  });

  it("describes a workspace on the platform console", () => {
    expect(providerModelText("OPENAI", "gpt-5")).toBe("OpenAI · gpt-5");
    expect(providerModelText(null, null)).toBe("Not set up");
    expect(limitText(null)).toBe("No limit");
    expect(limitText(25)).toBe("$25.00");
  });
});

describe("which sources AI Studio offers", () => {
  it("hides photos without a vision model and PDFs without PDF support", () => {
    const kinds = (s: { vision: boolean; pdf: boolean }) => visibleSources(SOURCES, s).map((x) => x.kind);
    expect(kinds({ vision: true, pdf: true })).toEqual(["TOPIC", "TEXT", "WIKIPEDIA", "PDF", "PHOTOS"]);
    expect(kinds({ vision: false, pdf: true })).not.toContain("PHOTOS");
    expect(kinds({ vision: true, pdf: false })).not.toContain("PDF");
    expect(sourceAllowed("TOPIC", { vision: false, pdf: false })).toBe(true);
    expect(sourceAllowed("PHOTOS", null)).toBe(true);
  });
});
