"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { forgotPasswordRequest, getAuthErrorMessage } from "@/lib/authClient";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const normalizedIdentifier = identifier.trim();
  const canSubmit = normalizedIdentifier.length > 0 && !isSubmitting && cooldownSeconds === 0;

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldownSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const submitLabel = useMemo(() => {
    if (isSubmitting) return "Sending Reset Link...";
    return "Send Reset Link";
  }, [isSubmitting]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || cooldownSeconds > 0) return;
    setError("");
    setSuccess("");

    if (!normalizedIdentifier) {
      setError("Enter your registered email address, mobile number, or short name.");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPasswordRequest({ login_id: normalizedIdentifier });
      setSuccess(
        "If the account exists, a password reset link has been sent. The reset token is valid for 15 minutes only. WhatsApp and email will be used only if they are available in the user profile."
      );
      setCooldownSeconds(30);
    } catch (err) {
      setError(getAuthErrorMessage(err?.status, err.message || "Unable to prepare the reset flow right now."));
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
            <h1 className={styles.leftTitle}>Recover Access</h1>
            <p className={styles.leftText}>
              Reset access for the customer panel without opening a support ticket first.
            </p>
            <ul className={styles.leftList}>
              <li>Reset link will be sent through the profile channels on record.</li>
              <li>Each reset token is valid for 15 minutes only.</li>
              <li>If no email or mobile exists, contact your call center.</li>
            </ul>
            <p className={styles.leftFoot}>Customer account recovery flow is now connected.</p>
          </div>

          <div className={styles.rightPanel}>
            <span className={styles.kicker}>Account recovery</span>
            <h2 className={styles.title}>Forgot Password</h2>
            <p className={styles.subtitle}>
              Enter your registered email, mobile number, or short name to receive the reset link.
            </p>

            <div className={styles.infoCard}>
              <span className={styles.infoTitle}>Delivery Rules</span>
              <p>
                WhatsApp message and email should be sent only if they exist in the user profile.
                Otherwise the user must contact the call center.
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
                  {success}
                </p>
              ) : null}

              <div className={styles.formGroup}>
                <label htmlFor="identifier" className={styles.label}>
                  Email Address, Mobile Number, or Short Name
                </label>
                <input
                  id="identifier"
                  type="text"
                  className={styles.input}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com, 923001234567, or short name"
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </div>

              <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
                {cooldownSeconds > 0 ? `Try Again in ${cooldownSeconds}s` : submitLabel}
              </button>
              <p className={styles.helpText}>
                The reset token remains valid for 15 minutes only. If no mobile or email exists in
                the user profile, contact the call center.
              </p>
            </form>

            <div className={styles.panelNote}>
              The reset page URL opens with a token query string and clearly warns the user when
              the 15-minute validity window has expired.
            </div>

            <div className={styles.links}>
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
