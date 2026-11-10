import { describe, expect, it } from "vitest";
import { clashWarning, codeFromHash, openPath, registrationStatus, savedNotice } from "../../lib/lti";

describe("LTI launch code", () => {
  const code = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo";

  it("reads the code from after #", () => {
    expect(codeFromHash("#" + code)).toBe(code);
    expect(codeFromHash(code)).toBe(code);
  });

  it("refuses anything that isn't a code", () => {
    for (const bad of ["", "#", "#short", "#" + code + "&next=/x", "#" + code + "/../x", "#<script>"]) {
      expect(codeFromHash(bad)).toBeNull();
    }
  });

  it("keeps the code after # on the way to the new tab", () => {
    expect(openPath(code)).toBe("/lti/open#" + code);
  });
});

describe("LMS registration approval (O4)", () => {
  it("names each status in plain words", () => {
    expect(registrationStatus("PENDING").label).toBe("Pending approval");
    expect(registrationStatus("APPROVED").label).toBe("Approved");
    expect(registrationStatus("REJECTED").label).toBe("Rejected");
    expect(registrationStatus(undefined).label).toBe("Pending approval");
  });

  it("shows the platform team's reason for a rejection", () => {
    const view = registrationStatus("REJECTED", "This client ID belongs to another school.");
    expect(view.tone).toBe("danger");
    expect(view.message).toContain("This client ID belongs to another school.");
    expect(registrationStatus("REJECTED", null).message).not.toContain("“");
  });

  it("says when a save sends the registration back for approval", () => {
    expect(savedNotice(null, "PENDING")).toContain("waits for approval");
    expect(savedNotice("APPROVED", "PENDING")).toContain("again");
    expect(savedNotice("APPROVED", "APPROVED")).toBe("Saved.");
    expect(savedNotice("REJECTED", "REJECTED")).toContain("still rejected");
  });

  it("flags other schools with the same issuer and client ID", () => {
    expect(clashWarning([])).toBeNull();
    const held = clashWarning([{ id: "1", schoolId: "s1", school: "North School", status: "APPROVED" }]);
    expect(held).toContain("North School (approved)");
    expect(held).toContain("turn the approved one down first");
    const waiting = clashWarning([{ id: "2", schoolId: "s2", school: "South School", status: "PENDING" }]);
    expect(waiting).toContain("South School (waiting)");
    expect(waiting).toContain("Approve only the school the LMS belongs to");
  });
});
