"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import styles from "./CustomerModulePage.module.css";
import { navigateWithTransition } from "@/lib/navigation";
import { useAppShell } from "@/components/AppShellContext";

export default function CustomerModulePage({ title, description }) {
  const router = useRouter();
  const [backLoading, setBackLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const { shellActive } = useAppShell();

  useEffect(() => {
    router.prefetch("/settings");
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {!shellActive && !isMobileView ? <Sidebar isOpen={true} /> : null}
      {!shellActive && !isMobileView ? <Header /> : null}
      <main
        className={styles.page}
        style={
          isMobileView
            ? {
                marginLeft: 0,
                paddingBottom: "108px",
              }
            : undefined
        }
      >
        <button
          type="button"
          className={styles.backBtn}
          disabled={backLoading}
          onClick={() => {
            setBackLoading(true);
            navigateWithTransition(router, "/settings");
          }}
        >
          {backLoading ? "Opening..." : "Back to Settings"}
        </button>

        <section className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{description}</p>

          <div className={styles.row}>
            <span>Module</span>
            <strong>{title}</strong>
          </div>
          <div className={styles.row}>
            <span>Access</span>
            <span className={styles.status}>View</span>
          </div>
          <div className={styles.row}>
            <span>Status</span>
            <strong>Dedicated page is now available</strong>
          </div>
        </section>
      </main>
      {isMobileView ? <MobileBottomNav /> : null}
    </>
  );
}
