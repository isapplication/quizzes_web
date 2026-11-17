import { describe, expect, it } from "vitest";
import {
  accountStatus, actionLabel, changeLines, newEmailProblem, reasonCategoryLabel, reasonProblem, roleLabel,
} from "../../lib/platformPeople";

describe("People: why a change is made", () => {
  it("needs a category and at least 10 characters", () => {
    expect(reasonProblem("", "The teacher asked by phone")).toContain("Choose why");
    expect(reasonProblem("WHIM", "The teacher asked by phone")).toContain("Choose why");
    expect(reasonProblem("PERSON_ASKED", "  short   ")).toContain("at least 10");
    expect(reasonProblem("PERSON_ASKED", "x".repeat(501))).toContain("500");
    expect(reasonProblem("SECURITY", "Ticket 4411, asked by phone")).toBeNull();
  });

  it("names each category in plain words", () => {
    expect(reasonCategoryLabel("SCHOOL_ASKED")).toBe("Their school asked");
    expect(reasonCategoryLabel(null)).toBe("");
  });
});

describe("People: a new sign-in email", () => {
  it("must be a full address, new, and typed the same twice (case and spaces don't matter)", () => {
    expect(newEmailProblem("sam@example.org", "sam", "sam")).toContain("in full");
    expect(newEmailProblem("sam@example.org", "SAM@example.org", "sam@example.org")).toContain("already");
    expect(newEmailProblem("sam@example.org", "sam.new@example.org", "sam.nwe@example.org")).toContain("different");
    expect(newEmailProblem("sam@example.org", " Sam.New@Example.org ", "sam.new@example.org")).toBeNull();
  });
});

describe("People: words, never only colours", () => {
  it("names statuses, roles and audit actions", () => {
    expect(accountStatus("DISABLED")).toEqual({ label: "Switched off", tone: "danger" });
    expect(accountStatus("ARCHIVED").label).toBe("Archived");
    expect(roleLabel("SCHOOL_ADMIN")).toBe("School admin");
    expect(actionLabel("PERSON_EMAIL_CHANGED")).toBe("Sign-in email changed");
    expect(actionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("writes a change as before → after, one line per field", () => {
    expect(changeLines({ email: "a@x.org", emailConfirmed: true }, { email: "b@x.org", emailConfirmed: false }))
      .toEqual(["Sign-in email: a@x.org → b@x.org", "Email confirmed: Yes → No"]);
    expect(changeLines({ status: "ACTIVE" }, { status: "ARCHIVED" })).toEqual(["Status: Active → Archived"]);
    expect(changeLines({ hasPassword: true }, { hasPassword: false })).toEqual(["Password: Set → None"]);
    expect(changeLines(null, null)).toEqual([]);
  });
});
