import { NextRequest, NextResponse } from "next/server";

/**
 * Entry point from the school portal's Quizplayo tile: /login?school=<school UUID>&next=/home.
 * Hands over to the Quiz API, which starts "Sign in with your school account".
 */
export function GET(request: NextRequest) {
  const params = new URLSearchParams();
  const school = request.nextUrl.searchParams.get("school");
  const next = request.nextUrl.searchParams.get("next");
  if (school) params.set("school", school);
  params.set("next", next ?? "/home");
  return NextResponse.redirect(new URL("/api/v1/auth/login?" + params.toString(), request.nextUrl.origin), 302);
}
