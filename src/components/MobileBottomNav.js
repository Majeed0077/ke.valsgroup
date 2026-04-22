"use client";

import React, { startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FaCog,
  FaCommentDots,
  FaFileAlt,
  FaMapMarkedAlt,
  FaTachometerAlt,
} from "react-icons/fa";
import { navigateWithTransition } from "@/lib/navigation";
import styles from "./MobileBottomNav.module.css";

const items = [
  { href: "/dashboard", label: "Home", icon: FaTachometerAlt },
  { href: "/tracking", label: "Tracking", icon: FaMapMarkedAlt },
  { href: "/report", label: "Reports", icon: FaFileAlt },
  { href: "/complain", label: "Clipboard", icon: FaCommentDots },
  { href: "/settings", label: "Settings", icon: FaCog },
];

const isActive = (pathname, href) => {
  if (href === "/tracking") return pathname === "/" || pathname.startsWith("/tracking");
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigate = React.useCallback(
    (href) => {
      if (!href || pathname === href || pathname.startsWith(`${href}/`)) return;
      startTransition(() => {
        navigateWithTransition(router, href);
      });
    },
    [pathname, router]
  );

  return (
    <nav className={`${styles.nav} ${styles.navVisible}`} aria-label="Mobile Navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <button
            key={item.href}
            type="button"
            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            onMouseEnter={() => router.prefetch(item.href)}
            onTouchStart={() => router.prefetch(item.href)}
            onPointerDown={(event) => {
              event.preventDefault();
              handleNavigate(item.href);
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              handleNavigate(item.href);
            }}
            onClick={() => handleNavigate(item.href)}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
