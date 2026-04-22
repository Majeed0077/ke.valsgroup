"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { getAuthErrorMessage, resetPasswordRequest } from "@/lib/authClient";
import styles from "../login/login.module.css";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(0);

  const isPasswordValid = password.length >= 8;
  const isMatch = password === confirmPassword;
  const hasToken = Boolean(token);
  const canSubmit = hasToken && isPasswordValid && isMatch && !isSubmitting;

  const tokenPreview = useMemo(() => {
    if (!token) return "Token missing";
    if (token.length <= 44) return token;
    return `${token.slice(0, 28)}...${token.slice(-12)}`;
  }, [token]);

  useEffect(() => {
    if (redirectSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      if (redirectSeconds === 1) {
        router.replace("/login");
      } else {
        setRedirectSeconds((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [redirectSeconds, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccess("");

    if (!hasToken) {
      setError("Reset token missing. Request a new password reset link.");
      return;
    }
    if (!isPasswordValid) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!isMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await resetPasswordRequest({ token, new_password: password });
      setSuccess(data?.message || "Password updated successfully.");
      setPassword("");
      setConfirmPassword("");
      setRedirectSeconds(3);
    } catch (err) {
      setError(getAuthErrorMessage(err?.status, err.message || "Unable to reset password right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <div className={styles.formContainer}>
          <div className={styles.leftPanel}>
            <div className={styles.brandPill}>Valsgroup</div>
            <h1 className={styles.leftTitle}>Set New Password</h1>
            <p className={styles.leftText}>
              Complete the recovery flow using the token from your reset link.
            </p>
            <div className={styles.helperList}>
              <div className={styles.helperItem}>
                <span className={styles.helperIcon}>15</span>
                <div className={styles.helperBody}>
                  <strong>15 Minute Window</strong>
                  <span>After expiry the user must request a new reset link.</span>
                </div>
              </div>
              <div className={styles.helperItem}>
                <span className={styles.helperIcon}>WA</span>
                <div className={styles.helperBody}>
                  <strong>Profile-Based Delivery</strong>
                  <span>WhatsApp and email delivery depends on the profile data available.</span>
                </div>
              </div>
              <div className={styles.helperItem}>
                <span className={styles.helperIcon}>CS</span>
                <div className={styles.helperBody}>
                  <strong>Call Center Fallback</strong>
                  <span>If no contact channel exists, the user should contact support.</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <span className={styles.kicker}>Reset access</span>
            <h2 className={styles.title}>Reset Password</h2>
            <p className={styles.subtitle}>
              Choose a new password and finish the customer account recovery flow.
            </p>

            <div className={styles.fieldMeta}>
              <label className={styles.label}>Reset Token</label>
              <span className={styles.pill}>Valid for 15 min</span>
            </div>

            <div className={styles.tokenCard}>
              <span className={styles.tokenLabel}>URL Token</span>
              <code className={styles.tokenValue}>{tokenPreview}</code>
              <p className={styles.tokenHint}>
                {!hasToken
                  ? "Open this page from the password reset link to continue."
                  : "This token is validated server-side and expires after 15 minutes. If it has expired, request a new reset link."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate aria-busy={isSubmitting}>
              {error ? (
                <p className={styles.error} role="alert" aria-live="polite">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className={styles.success} role="status" aria-live="polite">
                  {success} {redirectSeconds > 0 ? `Redirecting to login in ${redirectSeconds}s.` : ""}
                </p>
              ) : null}

              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.label}>
                  New Password
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={styles.input}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className={styles.toggleButton}
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Confirm Password
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat the new password"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className={styles.toggleButton}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={isSubmitting}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
                {isSubmitting ? "Updating Password..." : "Update Password"}
              </button>
              <p className={styles.helpText}>
                Use at least 8 characters. After the 15-minute token window ends, request a fresh
                reset link from Forgot Password.
              </p>
            </form>

            <div className={styles.links}>
              <Link href="/forgot-password" className={styles.link}>
                Request New Link
              </Link>
              <span className={styles.separator}>|</span>
              <Link href="/login" className={styles.link}>
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <span className={styles.poweredByInline}>
          <Image
            src="/Valsgroup.png"
            alt="Valsgroup"
            width={16}
            height={16}
            className={styles.poweredByInlineLogo}
          />
          <span>
            Powered by <strong>&nbsp;Valsgroup</strong>
          </span>
        </span>
      </footer>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="center">Loading reset flow...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
