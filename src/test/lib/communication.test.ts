import { describe, expect, it } from "vitest";
import { fileSize, statusChip, statusText } from "../../lib/communication";

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

describe("fileSize", () => {
  it("shows kilobytes under a megabyte and never zero", () => {
    expect(fileSize(18)).toMatch(/^1\s?kB$/i);
    expect(fileSize(240 * 1024)).toMatch(/^240\s?kB$/i);
  });

  it("shows megabytes with one decimal", () => {
    expect(fileSize(3.14 * 1024 * 1024)).toMatch(/^3\.1\s?MB$/);
  });
});
