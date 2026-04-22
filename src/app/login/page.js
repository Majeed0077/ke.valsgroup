'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import {
  RECENT_LOGIN_ID_KEY,
  buildSessionFromAuthResponse,
  decodeAuthHandoff,
  getAuthErrorMessage,
  importSessionRequest,
  loginRequest,
} from '@/lib/authClient';
import { setCachedAuthSession } from '@/lib/authSessionCache';
import { invalidateRbacSessionCache } from '@/lib/useRbacAccess';
import { navigateWithTransition } from '@/lib/navigation';

const CUSTOMER_AUTH_HINT_KEY = 'vtp_customer_auth_hint_v1';
const MOBILE_LOGIN_QUERY = '(max-width: 768px)';

function getPostLoginTarget(isMobileView) {
  return isMobileView ? '/dashboard' : '/tracking';
}

function writeCustomerAuthHint() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      CUSTOMER_AUTH_HINT_KEY,
      JSON.stringify({ authenticated: true, issuedAt: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(MOBILE_LOGIN_QUERY);
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    router.prefetch('/tracking');
    router.prefetch('/dashboard');
  }, [router]);

  useEffect(() => {
    const rememberedLoginId = localStorage.getItem(RECENT_LOGIN_ID_KEY);
    if (rememberedLoginId) {
      setLoginId(rememberedLoginId);
    }
  }, []);

  useEffect(() => {
    const handoff = searchParams.get('handoff');
    if (!handoff) return;

    const session = decodeAuthHandoff(handoff);
    if (!session) return;

    let cancelled = false;
    importSessionRequest(session)
      .then(() => {
        if (cancelled) return;
        invalidateRbacSessionCache();
        writeCustomerAuthHint();
        const targetRoute = getPostLoginTarget(
          typeof window !== 'undefined' && window.matchMedia(MOBILE_LOGIN_QUERY).matches
        );
        router.prefetch(targetRoute);
        import('@/components/MapComponent').catch(() => null);
        if (typeof window !== 'undefined') {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
        }
        navigateWithTransition(router, targetRoute, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Unable to restore your session.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  const loginIdValue = loginId.trim();
  const isLoginIdValid = useMemo(() => loginIdValue.length > 0, [loginIdValue]);
  const isPasswordValid = password.trim().length > 0;
  const canSubmit = isLoginIdValid && isPasswordValid && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!isLoginIdValid) {
      setError('Enter your email address, mobile number, or short name.');
      return;
    }

    if (!isPasswordValid) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginRequest({
        login_id: loginIdValue,
        password,
        platform_hint: 'WEB',
        remember_me: rememberMe,
      });
      const session = buildSessionFromAuthResponse(data, { rememberMe });

      if (!session) {
        throw new Error('Login response is missing session details.');
      }

      if (rememberMe) {
        localStorage.setItem(RECENT_LOGIN_ID_KEY, loginIdValue);
      } else {
        localStorage.removeItem(RECENT_LOGIN_ID_KEY);
      }

      setCachedAuthSession(session);
      invalidateRbacSessionCache();
      writeCustomerAuthHint();
      const targetRoute = getPostLoginTarget(isMobileView);
      router.prefetch(targetRoute);
      import('@/components/MapComponent').catch(() => null);
      navigateWithTransition(router, targetRoute, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err?.status, err.message || 'An error occurred during login.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.pageContainer} ${styles.loginPage}`}>
      <div className={`${styles.contentWrapper} ${styles.loginContentWrapper}`}>
        <div className={styles.loginShell}>
          <div className={styles.loginBrandStack}>
            <div className={styles.loginBrandLogoWrap}>
              <Image
                src="/icons/KE.webp"
                alt="K-Electric"
                width={180}
                height={96}
                className={styles.loginBrandLogo}
                priority
              />
            </div>
            <p className={styles.loginBrandTagline}>Energy That Moves Life</p>
          </div>

          <div className={`${styles.formContainer} ${styles.loginSingleCard}`}>
            <div className={`${styles.authTabs} ${styles.authTabsSingle}`} role="tablist" aria-label="Authentication">
              <Link
                href="/login"
                className={`${styles.authTab} ${styles.authTabActive}`}
                aria-current="page"
              >
                Login
              </Link>
            </div>

            <div className={styles.loginCardBody}>
              <div className={styles.loginIntro}>
                <h1 className={styles.loginHeroTitle}>
                  Welcome <span>Back!</span>
                </h1>
                <p className={styles.subtitle}>
                  Access your fleet operations portal using your official credentials.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className={styles.form}
                noValidate
                aria-busy={isSubmitting}
              >
                {error && (
                  <p className={styles.error} role="alert" aria-live="polite">
                    {error}
                  </p>
                )}

                <div className={styles.formGroup}>
                  <label htmlFor="loginId" className={styles.label}>
                    Login ID
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5C20 16.015 16.418 14 12 14Z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="loginId"
                      className={`${styles.input} ${styles.loginInput}`}
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      autoComplete="username"
                      inputMode="text"
                      aria-invalid={!isLoginIdValid && loginId.length > 0}
                      required
                      disabled={isSubmitting}
                      placeholder="Enter your login ID"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password" className={styles.label}>
                    Password
                  </label>
                  <div className={`${styles.inputWrap} ${styles.passwordWrap}`}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M17 10h-1V8a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4Zm7 11H7v-7h10Z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      className={`${styles.input} ${styles.loginInput} ${styles.loginPasswordInput}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      aria-invalid={!isPasswordValid && password.length > 0}
                      required
                      disabled={isSubmitting}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className={styles.toggleButton}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      disabled={isSubmitting}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <label className={`${styles.checkboxRow} ${styles.loginCheckboxRow}`}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    disabled={isSubmitting}
                  />
                  <span>Remember this device</span>
                </label>

                <button
                  type="submit"
                  className={`${styles.submitButton} ${styles.loginSubmitButton}`}
                  disabled={!canSubmit}
                >
                  <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h12M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>

              <div className={styles.loginAuxArea}>
                <div className={styles.links}>
                  <Link href="/forgot-password" className={styles.link}>
                    Forgot Password?
                  </Link>
                </div>

                <div className={styles.languageSwitcher} aria-label="Language switcher">
                  <button type="button" className={`${styles.languageButton} ${styles.languageButtonActive}`}>
                    English
                  </button>
                  <button type="button" className={styles.languageButton}>
                    اردو
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.loginFooter}>
        <div className={styles.loginFooterMeta}>
          <div className={styles.loginFooterItem}>
            <span className={styles.loginFooterIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 5 6v6c0 4.4 2.9 8.46 7 9 4.1-.54 7-4.6 7-9V6Z" />
              </svg>
            </span>
            <span>Secure Access</span>
          </div>
          <div className={styles.loginFooterItem}>
            <span className={styles.loginFooterIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </span>
            <span>Karachi Operations</span>
          </div>
          <div className={styles.loginFooterItem}>
            <span className={styles.loginFooterIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 13v-2a8 8 0 1 1 16 0v2" />
                <path d="M5 13h2v5H5zM17 13h2v5h-2zM9 19c.72.67 1.85 1 3 1s2.28-.33 3-1" />
              </svg>
            </span>
            <span>24/7 Fleet Support</span>
          </div>
        </div>
        <p className={styles.loginCopyright}>© 2025 Valsgroup. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="center">Loading login...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
