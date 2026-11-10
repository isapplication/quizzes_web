import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fileSize, isRemoved, listPictures, PICTURE_REMOVED, removalWarning, removePicture, shown, usedIn,
} from "../../lib/media";

describe("a removed picture (decision O3)", () => {
  it("is shown as removed with its words and size, never as a broken picture", () => {
    const ref = { mediaId: "a", alt: "A fox in the snow", width: 320, height: 240, removed: true };
    expect(shown(ref)).toEqual({ url: "", alt: "A fox in the snow", width: 320, height: 240, removed: true });
    expect(isRemoved(shown(ref))).toBe(true);
    // What the game server sends for a removed answer picture: no address at all.
    expect(isRemoved({ removed: true, alt: "The fox", url: undefined } as never)).toBe(true);
    expect(isRemoved({ url: "/api/v1/media/a?e=1&s=2" })).toBe(false);
    expect(isRemoved(null)).toBe(false);
    expect(PICTURE_REMOVED).toBe("Picture removed");
  });
});

describe("the confirm step's words", () => {
  it("says which quizzes change, that cached copies last up to 48 hours, and that it can't be undone", () => {
    const one = removalWarning({ quizzes: 1, quizTitles: ["Forest animals"] });
    expect(one).toContain("Questions in “Forest animals” will show “Picture removed”");
    expect(one).toContain("up to 48 hours");
    expect(one).toContain("can't be undone");
    expect(removalWarning({ quizzes: 2, quizTitles: ["A", "B"] })).toContain("“A” and “B”");
    expect(removalWarning({ quizzes: 7, quizTitles: ["A", "B", "C", "D", "E"] }))
      .toContain("“A”, “B”, “C” and 4 other quizzes");
    expect(removalWarning({ quizzes: 4, quizTitles: ["A", "B", "C"] })).toContain("and 1 other quiz ");
    const unused = removalWarning({ quizzes: 0, quizTitles: [] });
    expect(unused).toContain("No quiz uses it now.");
    expect(unused).toContain("48 hours");
  });

  it("describes a picture in plain words", () => {
    expect(usedIn(0)).toBe("Not used in a quiz");
    expect(usedIn(1)).toBe("Used in 1 quiz");
    expect(usedIn(3)).toBe("Used in 3 quizzes");
    expect(fileSize(300)).toBe("1 KB");
    expect(fileSize(86_000)).toBe("84 KB");
    expect(fileSize(1_300_000)).toBe("1.2 MB");
  });
});

describe("listing and removing pictures", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=tok" });
    fetchMock = vi.fn(async (path: string) =>
      path.startsWith("/api/v1/media/") ? new Response(null, { status: 204 }) : new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the teacher's own pictures, or the whole school's", async () => {
    await listPictures();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/media");
    await listPictures("school");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/media?scope=school");
  });

  it("removes one with DELETE and the CSRF header", async () => {
    await expect(removePicture("1b2c3d4e-0000-4000-8000-000000000001")).resolves.toBeUndefined();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/media/1b2c3d4e-0000-4000-8000-000000000001");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>)["X-XSRF-TOKEN"]).toBe("tok");
  });
});
