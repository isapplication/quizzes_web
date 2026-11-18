import { describe, expect, it } from "vitest";
import {
  accountStatus, actionLabel, changeLines, gradeLabel, guardText, newEmailProblem, reasonCategoryLabel, reasonProblem,
  peoplePlace, peopleSearch, roleLabel, usernameProblem,
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

describe("People in one workspace (step 2)", () => {
  it("checks a student's username as the Quiz API does", () => {
    expect(usernameProblem("Lena.K")).toBeNull();
    expect(usernameProblem("le")).toContain("3 to 40");
    expect(usernameProblem(".lena")).toContain("starting with");
    expect(usernameProblem("lena k")).not.toBeNull();
  });

  it("names grades, with kindergarten as 0", () => {
    expect(gradeLabel(0)).toBe("Kindergarten");
    expect(gradeLabel(7)).toBe("Grade 7");
    expect(gradeLabel(null)).toBe("—");
  });

  it("says why an admin can't be taken out", () => {
    expect(guardText("LAST_ADMIN")).toContain("only active school admin");
    expect(guardText("OWNER")).toContain("own workspace");
    expect(guardText(null)).toBeNull();
  });

  it("writes role, grade, class and invitation changes in plain words", () => {
    expect(changeLines({ role: "SCHOOL_ADMIN" }, { role: "TEACHER" })).toEqual(["Role: School admin → Teacher"]);
    expect(changeLines({ grade: 0 }, { grade: 8 })).toEqual(["Grade: Kindergarten → Grade 8"]);
    expect(changeLines({ classesRemoved: ["7A"] }, { classesAdded: [] }))
      .toEqual(["Classes removed: 7A"]);
    expect(actionLabel("INVITATION_EMAIL_CHANGED")).toBe("Invitation email corrected");
    expect(actionLabel("JOIN_REQUEST_DECLINED")).toBe("Join request declined");
  });
});

describe("a People page's own address", () => {
  const A = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("round-trips each place, with ids only", () => {
    for (const place of [
      { kind: "search" as const },
      { kind: "account" as const, accountId: A },
      { kind: "member" as const, tenantId: A, userId: B },
    ]) {
      expect(peoplePlace(peopleSearch(place))).toEqual(place);
    }
    expect(peopleSearch({ kind: "member", tenantId: A, userId: B })).toBe(`?tab=people&workspace=${A}&person=${B}`);
  });

  it("treats anything that isn't an id as the search", () => {
    expect(peoplePlace("?tab=people&account=someone@example.com")).toEqual({ kind: "search" });
    expect(peoplePlace(`?tab=people&workspace=${A}`)).toEqual({ kind: "search" });
    expect(peoplePlace("")).toEqual({ kind: "search" });
  });
});
