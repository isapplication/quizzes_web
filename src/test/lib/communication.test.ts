import { describe, expect, it } from "vitest";
import { statusChip, statusText } from "../../lib/communication";

describe("statusText", () => {
  it("says in words what happened, never only a colour", () => {
    expect(statusText("PENDING")).toBe("Not emailed: mail is switched off");
    expect(statusText("SENT")).toBe("Emailed");
    expect(statusText("FAILED", "mailbox not found")).toBe("Couldn't be sent: mailbox not found");
    expect(statusText("FAILED")).toBe("Couldn't be sent");
  });

  it("gives each status its own chip", () => {
    expect(new Set([statusChip("PENDING"), statusChip("SENT"), statusChip("FAILED")]).size).toBe(3);
  });
});
