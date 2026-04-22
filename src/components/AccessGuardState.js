"use client";

import styles from "./AccessGuardState.module.css";

export default function AccessGuardState({
  title,
  message,
  mode = "denied",
}) {
  const isLoading = mode === "loading";

  return (
    <section className={styles.card}>
      <span className={styles.eyebrow}>{isLoading ? "Checking Access" : "Access Restricted"}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
    </section>
  );
}
