// src/app/fleet-dashboard/useAuth.js
"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  decodeAuthHandoff,
  fetchSessionRequest,
  importSessionRequest,
} from '@/lib/authClient';
import { navigateWithTransition } from '@/lib/navigation';
import {
  getCachedAuthSession,
  getInflightAuthSessionPromise,
  setCachedAuthSession,
  setInflightAuthSessionPromise,
} from '@/lib/authSessionCache';
import { invalidateRbacSessionCache } from '@/lib/useRbacAccess';

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);
const MOBILE_AUTH_QUERY = '(max-width: 768px)';

function getAuthenticatedRedirectTarget() {
  if (typeof window !== 'undefined' && window.matchMedia(MOBILE_AUTH_QUERY).matches) {
    return '/dashboard';
  }
  return '/tracking';
}
const CUSTOMER_AUTH_HINT_KEY = 'vtp_customer_auth_hint_v1';
const SESSION_KEEPALIVE_INTERVAL_MS = 1000 * 60 * 30;
const SESSION_KEEPALIVE_MIN_GAP_MS = 1000 * 60;
const AUTH_HINT_TTL_MS = 1000 * 60 * 60 * 12;

let keepAlivePromise = null;
let lastKeepAliveAt = 0;

function writeAuthHint(isAuthenticated) {
  if (typeof window === 'undefined') return;
  try {
    if (!isAuthenticated) {
      window.sessionStorage.removeItem(CUSTOMER_AUTH_HINT_KEY);
      return;
    }
    window.sessionStorage.setItem(
      CUSTOMER_AUTH_HINT_KEY,
      JSON.stringify({ authenticated: true, issuedAt: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
}

function hasRecentAuthHint() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(CUSTOMER_AUTH_HINT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const issuedAt = Number(parsed?.issuedAt || 0);
    if (!parsed?.authenticated) return false;
    if (!issuedAt) return true;
    return Date.now() - issuedAt <= AUTH_HINT_TTL_MS;
  } catch {
    return false;
  }
}

function isUnauthorizedError(error) {
  return Number(error?.status || 0) === 401;
}

async function refreshActiveSession({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastKeepAliveAt < SESSION_KEEPALIVE_MIN_GAP_MS) {
    const cachedSession = getCachedAuthSession();
    if (cachedSession) return cachedSession;
  }

  if (keepAlivePromise) return keepAlivePromise;

  keepAlivePromise = fetchSessionRequest()
    .then((session) => {
      setCachedAuthSession(session);
      invalidateRbacSessionCache();
      writeAuthHint(Boolean(session?.isLoggedIn));
      lastKeepAliveAt = Date.now();
      return session;
    })
    .finally(() => {
      keepAlivePromise = null;
    });

  return keepAlivePromise;
}

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyResolvedSession = (session) => {
      if (cancelled) return;
      const loggedIn = Boolean(session?.isLoggedIn);
      invalidateRbacSessionCache();
      writeAuthHint(loggedIn);
      setIsAuthenticated(loggedIn);
      setAuthChecked(true);

      if (loggedIn && AUTH_ROUTES.has(pathname)) {
        navigateWithTransition(router, getAuthenticatedRedirectTarget(), { replace: true });
        return;
      }

      if (!loggedIn && !AUTH_ROUTES.has(pathname)) {
        router.replace('/login');
      }
    };

    const applyLoggedOutState = () => {
      if (cancelled) return;
      invalidateRbacSessionCache();
      setCachedAuthSession({ isLoggedIn: false });
      writeAuthHint(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (!AUTH_ROUTES.has(pathname)) {
        router.replace('/login');
      }
    };

    const bootstrapAuth = async () => {
      try {
        const cachedSession = getCachedAuthSession();
        if (cachedSession) {
          applyResolvedSession(cachedSession);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const handoff = decodeAuthHandoff(params.get('handoff'));
        let sessionPromise = getInflightAuthSessionPromise();

        if (!sessionPromise) {
          sessionPromise = (async () => {
            if (handoff) {
              const session = await importSessionRequest(handoff);
              const cleanParams = new URLSearchParams(params);
              cleanParams.delete('handoff');
              const cleanQuery = cleanParams.toString();
              const cleanUrl = `${window.location.origin}${window.location.pathname}${
                cleanQuery ? `?${cleanQuery}` : ''
              }`;
              window.history.replaceState({}, '', cleanUrl);
              return session;
            }

            return fetchSessionRequest();
          })();

          setInflightAuthSessionPromise(
            sessionPromise.finally(() => {
              setInflightAuthSessionPromise(null);
            })
          );
        }

        const session = await sessionPromise;
        setCachedAuthSession(session);
        applyResolvedSession(session);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          applyLoggedOutState();
          return;
        }

        const fallbackSession = getCachedAuthSession();
        if (fallbackSession) {
          applyResolvedSession(fallbackSession);
          return;
        }

        if (!AUTH_ROUTES.has(pathname) && hasRecentAuthHint()) {
          setIsAuthenticated(true);
          setAuthChecked(true);
          return;
        }

        applyLoggedOutState();
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return undefined;

    let cancelled = false;

    const syncSession = async (force = false) => {
      try {
        const session = await refreshActiveSession({ force });
        if (cancelled) return;

        const loggedIn = Boolean(session?.isLoggedIn);
        setIsAuthenticated(loggedIn);
        setAuthChecked(true);

        if (!loggedIn && !AUTH_ROUTES.has(pathname)) {
          router.replace('/login');
        }
      } catch (error) {
        if (cancelled) return;
        if (!isUnauthorizedError(error)) {
          return;
        }
        invalidateRbacSessionCache();
        setCachedAuthSession({ isLoggedIn: false });
        writeAuthHint(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
        if (!AUTH_ROUTES.has(pathname)) {
          router.replace('/login');
        }
      }
    };

    const intervalId = window.setInterval(() => {
      syncSession(false);
    }, SESSION_KEEPALIVE_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSession(true);
      }
    };

    const handleWindowFocus = () => {
      syncSession(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [authChecked, isAuthenticated, pathname, router]);

  return { authChecked, isAuthenticated };
}
