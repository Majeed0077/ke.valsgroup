'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/login.module.css';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const nameValue = name.trim();
  const emailValue = email.trim();
  const isNameValid = nameValue.length >= 2;
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue),
    [emailValue]
  );
  const isPasswordValid = password.length >= 6;
  const isMatch = password === confirmPassword;
  const canSubmit =
    isNameValid && isEmailValid && isPasswordValid && isMatch && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!isNameValid) {
      setError('Please enter your full name.');
      return;
    }

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!isMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      router.push('/login');
    } catch (err) {
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.pageContainer} ${styles.signupPage}`}>
      <div className={`${styles.contentWrapper} ${styles.signupContentWrapper}`}>
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
            <div className={styles.authTabs} role="tablist" aria-label="Authentication">
              <Link href="/login" className={styles.authTab}>
                Login
              </Link>
              <Link
                href="/signup"
                className={`${styles.authTab} ${styles.authTabActive}`}
                aria-current="page"
              >
                Sign Up
              </Link>
            </div>

            <div className={styles.loginCardBody}>
              <div className={styles.loginIntro}>
                <h1 className={styles.loginHeroTitle}>
                  Create <span>Account</span>
                </h1>
                <p className={styles.subtitle}>
                  Create your fleet operations account using your official details.
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
                  <label htmlFor="name" className={styles.label}>
                    Full Name
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5C20 16.015 16.418 14 12 14Z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      aria-invalid={!isNameValid && name.length > 0}
                      required
                      className={`${styles.input} ${styles.loginInput}`}
                      disabled={isSubmitting}
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>
                    Email Address
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 6h16v12H4z" />
                        <path d="m5 7 7 6 7-6" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      aria-invalid={!isEmailValid && email.length > 0}
                      required
                      className={`${styles.input} ${styles.loginInput}`}
                      disabled={isSubmitting}
                      placeholder="Enter your official email"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password" className={styles.label}>
                    Password
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M17 10h-1V8a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4Zm7 11H7v-7h10Z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={!isPasswordValid && password.length > 0}
                      required
                      className={`${styles.input} ${styles.loginInput} ${styles.loginPasswordInput}`}
                      disabled={isSubmitting}
                      placeholder="Create a password"
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

                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword" className={styles.label}>
                    Confirm Password
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M17 10h-1V8a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4Zm7 11H7v-7h10Z" />
                      </svg>
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={!isMatch && confirmPassword.length > 0}
                      required
                      className={`${styles.input} ${styles.loginInput} ${styles.loginPasswordInput}`}
                      disabled={isSubmitting}
                      placeholder="Repeat your password"
                    />
                    <button
                      type="button"
                      className={styles.toggleButton}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      disabled={isSubmitting}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`${styles.submitButton} ${styles.loginSubmitButton}`}
                  disabled={!canSubmit}
                >
                  <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h12M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>

              <div className={styles.loginAuxArea}>
                <div className={styles.links}>
                  <Link href="/login" className={styles.link}>
                    Already have an account? Sign In
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
