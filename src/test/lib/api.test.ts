import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../lib/api";

type Call = [string, RequestInit];

function lastCall(fetchMock: ReturnType<typeof vi.fn>): Call {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as Call;
}

describe("api() bodies", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=tok%2B1" });
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a Blob as its raw bytes with its own type, plus the CSRF header", async () => {
    const zip = new Blob([new Uint8Array([0x50, 0x4b, 3, 4])], { type: "application/x-zip-compressed" });
    await api("/api/v1/admin/people/oneroster", { method: "POST", body: zip });
    const [path, init] = lastCall(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(path).toBe("/api/v1/admin/people/oneroster");
    expect(init.body).toBe(zip);
    expect(headers["Content-Type"]).toBe("application/x-zip-compressed");
    expect(headers["X-XSRF-TOKEN"]).toBe("tok+1");
  });

  it("falls back to application/zip for a File with no type", async () => {
    const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], "roster.zip");
    await api("/x", { method: "POST", body: file });
    const [, init] = lastCall(fetchMock);
    expect(init.body).toBe(file);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/zip");
  });

  it("still sends a plain object as JSON", async () => {
    await api("/x", { method: "PUT", body: { a: 1 } });
    const [, init] = lastCall(fetchMock);
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("still sends FormData as an upload, letting the browser set its type", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.png");
    await api("/x", { method: "POST", body: form });
    const [, init] = lastCall(fetchMock);
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("carries the API's message as written on an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "too_large", message: "The zip is larger than 20 MB." }),
      { status: 400 }));
    const err = await api("/x", { method: "POST", body: new Blob(["x"]) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("too_large");
    expect((err as ApiError).message).toBe("The zip is larger than 20 MB.");
  });
});
