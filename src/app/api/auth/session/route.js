import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildCookieNames,
  buildCookieOptions,
  buildContextCookieOptions,
  buildExpiredCookieOptions,
  decodeSessionCookie,
  encodeSessionCookie,
  extendAuthSession,
  normalizeAuthSession,
  toAuthContext,
} from "@/lib/authCore";
import { resolveOwnershipScope } from "@/lib/ownershipScope";

const COOKIE_NAMES = buildCookieNames("customer");
const configuredScopeTimeout = Number(process.env.AUTH_SESSION_SCOPE_TIMEOUT_MS || 350);
const SESSION_SCOPE_RESOLUTION_TIMEOUT_MS = Number.isFinite(configuredScopeTimeout)
  ? Math.min(Math.max(configuredScopeTimeout, 100), 350)
  : 350;

function delayResult(timeoutMs, value = null) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), timeoutMs);
  });
}

export async function GET() {
  const cookieStore = await cookies();
  let session = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );

  if (!session) {
    const response = NextResponse.json({ isLoggedIn: false }, { status: 401 });
    const expiredOptions = buildExpiredCookieOptions();
    response.cookies.set(COOKIE_NAMES.token, "", expiredOptions);
    response.cookies.set(COOKIE_NAMES.session, "", expiredOptions);
    response.cookies.set(COOKIE_NAMES.loginFor, "", expiredOptions);
    response.cookies.set(COOKIE_NAMES.loginKey, "", expiredOptions);
    return response;
  }

  const ownershipScope = await Promise.race([
    resolveOwnershipScope(toAuthContext(session)).catch(() => null),
    delayResult(SESSION_SCOPE_RESOLUTION_TIMEOUT_MS, null),
  ]);
  session = extendAuthSession(session, ownershipScope || {});

  const response = NextResponse.json(
    {
      isLoggedIn: true,
      ...session,
    },
    { status: 200 }
  );
  const options = buildCookieOptions(session.expiresAt);
  const contextCookieOptions = buildContextCookieOptions();
  const authContext = toAuthContext(session);
  response.cookies.set(COOKIE_NAMES.token, session.accessToken, options);
  response.cookies.set(COOKIE_NAMES.session, encodeSessionCookie(session), options);
  response.cookies.set(COOKIE_NAMES.loginFor, authContext.loginFor, contextCookieOptions);
  response.cookies.set(COOKIE_NAMES.loginKey, authContext.loginKey, contextCookieOptions);
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json();
    let session = normalizeAuthSession(body);
    if (!session) {
      return NextResponse.json({ error: "Invalid session payload." }, { status: 400 });
    }

    const ownershipScope = await Promise.race([
      resolveOwnershipScope(toAuthContext(session)).catch(() => null),
      delayResult(SESSION_SCOPE_RESOLUTION_TIMEOUT_MS, null),
    ]);
    session = extendAuthSession(session, ownershipScope || {});

    const response = NextResponse.json(
      {
        isLoggedIn: true,
        ...session,
      },
      { status: 200 }
    );
    const options = buildCookieOptions(session.expiresAt);
    const contextCookieOptions = buildContextCookieOptions();
    const authContext = toAuthContext(session);
    response.cookies.set(COOKIE_NAMES.token, session.accessToken, options);
    response.cookies.set(COOKIE_NAMES.session, encodeSessionCookie(session), options);
    response.cookies.set(COOKIE_NAMES.loginFor, authContext.loginFor, contextCookieOptions);
    response.cookies.set(COOKIE_NAMES.loginKey, authContext.loginKey, contextCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to persist session." },
      { status: 500 }
    );
  }
}
