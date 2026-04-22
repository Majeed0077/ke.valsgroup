import { NextResponse } from "next/server";
import {
  buildCookieNames,
  buildCookieOptions,
  buildContextCookieOptions,
  extendAuthSession,
  toAuthContext,
  encodeSessionCookie,
  normalizeAuthSession,
} from "@/lib/authCore";
import { resolveOwnershipScope } from "@/lib/ownershipScope";

const BASE_URL = process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";
const COOKIE_NAMES = buildCookieNames("customer");
const LOGIN_UPSTREAM_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.AUTH_LOGIN_UPSTREAM_TIMEOUT_MS || 50000)
);
const LOGIN_SCOPE_RESOLUTION_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.AUTH_LOGIN_SCOPE_TIMEOUT_MS || 2500)
);

function delayResult(timeoutMs, value = null) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), timeoutMs);
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!BASE_URL) {
      return NextResponse.json(
        { error: "Missing EXTERNAL_AUTH_API_URL environment variable." },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_UPSTREAM_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`${BASE_URL.replace(/\/$/, "")}/react/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return NextResponse.json(
          { error: "External login request timed out." },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text ? { detail: text } : {};
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    let session = normalizeAuthSession({
      ...data,
      rememberMe: body?.remember_me ?? body?.rememberMe,
    });
    if (!session) {
      return NextResponse.json(
        { error: "Login response is missing session details." },
        { status: 500 }
      );
    }

    const ownershipScope = await Promise.race([
      resolveOwnershipScope(toAuthContext(session)).catch(() => null),
      delayResult(LOGIN_SCOPE_RESOLUTION_TIMEOUT_MS, null),
    ]);
    session = extendAuthSession(session, ownershipScope || {});

    const nextResponse = NextResponse.json(session, { status: 200 });
    const cookieOptions = buildCookieOptions(session.expiresAt);
    const contextCookieOptions = buildContextCookieOptions();
    const authContext = toAuthContext(session);
    nextResponse.cookies.set(COOKIE_NAMES.token, session.accessToken, cookieOptions);
    nextResponse.cookies.set(COOKIE_NAMES.session, encodeSessionCookie(session), cookieOptions);
    nextResponse.cookies.set(COOKIE_NAMES.loginFor, authContext.loginFor, contextCookieOptions);
    nextResponse.cookies.set(COOKIE_NAMES.loginKey, authContext.loginKey, contextCookieOptions);
    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to process login request." },
      { status: 500 }
    );
  }
}
