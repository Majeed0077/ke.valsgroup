import { NextResponse } from "next/server";
import { buildCookieNames, buildExpiredCookieOptions } from "@/lib/authCore";

const COOKIE_NAMES = buildCookieNames("customer");

function applyLogoutCookies(response) {
  const expiredOptions = buildExpiredCookieOptions();
  response.cookies.set(COOKIE_NAMES.token, "", expiredOptions);
  response.cookies.set(COOKIE_NAMES.session, "", expiredOptions);
  response.cookies.set(COOKIE_NAMES.loginFor, "", expiredOptions);
  response.cookies.set(COOKIE_NAMES.loginKey, "", expiredOptions);
  return response;
}

function resolveRedirectTarget(request) {
  const { searchParams } = new URL(request.url);
  const redirect = String(searchParams.get("redirect") || "/login").trim();
  if (!redirect.startsWith("/")) return "/login";
  if (redirect.startsWith("//")) return "/login";
  return redirect;
}

export async function GET(request) {
  const redirectTarget = resolveRedirectTarget(request);
  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  return applyLogoutCookies(response);
}

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  return applyLogoutCookies(response);
}
