import { NextRequest, NextResponse } from "next/server";

/**
 * A strict Content Security Policy on every page. Each tab keeps its session key in sessionStorage, which any
 * script on the page could read, so only Quizplayo's own scripts may run: each response gets a fresh nonce,
 * which Next.js puts on its scripts. Live games may connect to the game servers in ISQUIZ_CSP_CONNECT (the
 * same site in production); sign-out posts a form to the school portal (ISQUIZ_IDP_ORIGIN).
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development";
  const idp = process.env.ISQUIZ_IDP_ORIGIN ?? "http://localhost:9000";
  const connect = (process.env.ISQUIZ_CSP_CONNECT ?? "").split(/[\s,]+/).filter(Boolean);
  if (dev) connect.push("http://localhost:*", "ws://localhost:*");
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${connect.join(" ")}`.trim(),
    `form-action 'self' ${idp}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  // Pages only: not the Quiz API paths the web app forwards, nor Next.js's own files.
  matcher: [
    {
      source: "/((?!api/|oauth2/|login/oauth2/|logout|_next/static|_next/image|icon.svg|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
    },
  ],
};
