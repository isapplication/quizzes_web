import { describe, expect, it } from "vitest";
import { formatPin, normalizePin } from "./pin";

describe("game PIN", () => {
  it("accepts six digits with or without spaces", () => {
    expect(normalizePin("482915")).toBe("482915");
    expect(normalizePin(" 482 915 ")).toBe("482915");
  });

  it("rejects anything else", () => {
    expect(normalizePin("48291")).toBeNull();
    expect(normalizePin("48291a")).toBeNull();
    expect(normalizePin("")).toBeNull();
  });

  it("formats as two groups of three", () => {
    expect(formatPin("482915")).toBe("482 915");
  });
});
