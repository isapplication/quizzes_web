import { clearTabKey, tabKey } from "./tab";

/**
 * Calls the Quiz API. Same origin (the web app forwards /api). A tab that has its own session key sends it as
 * a Bearer header (see tab.ts); otherwise the httpOnly session cookie goes along. Changes also send the CSRF
 * token from the XSRF-TOKEN cookie. Errors carry the API's
 * human-readable message, which screens show as written. A FormData body is sent as a file upload.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function xsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  const form = init.body instanceof FormData;
  const key = tabKey();
  if (key) headers.Authorization = "Bearer " + key;
  if (init.body !== undefined && !form) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    if (!xsrfToken()) await fetch("/api/v1/me", { credentials: "same-origin" }).catch(() => undefined);
    const token = xsrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: init.body === undefined ? undefined : form ? (init.body as FormData) : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "offline", "Quizplayo cannot reach its server. Check your internet connection and try again.");
  }
  const text = await response.text();
  const data = text ? safeJson(text) : undefined;
  if (!response.ok) {
    // The tab's session has ended (signed out, timed out): forget its key, so signing in again gives a new one.
    if (response.status === 401 && key) clearTabKey();
    const body = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      body.error ?? "http_" + response.status,
      body.message ?? defaultMessage(response.status),
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return "Please sign in with your school account to continue.";
  if (status === 403) return "Your role does not allow this. Ask your school admin if you need access.";
  if (status === 404) return "That item no longer exists. It may have been removed.";
  if (status >= 500) return "Something went wrong on the Quizplayo server. Please try again in a minute.";
  return "Quizplayo could not complete that. Please try again.";
}
