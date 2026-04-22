"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MobileBottomNav from "@/components/MobileBottomNav";
import { fetchSessionRequest, redirectToLogout } from "@/lib/authClient";
import { getCachedAuthSession } from "@/lib/authSessionCache";
import styles from "./profile.module.css";
import { navigateWithTransition } from "@/lib/navigation";

const STORAGE_KEY = "vtp_profile_data_v1";
const AVATAR_CACHE_KEY = "vtp_profile_avatar_meta_v1";
const AVATAR_PREVIEW_GLOBAL_KEY = "__vtpProfileAvatarPreviewUrl";
const DEFAULT_LOCAL_PROFILE = {
  language: "English",
  timezone: "GMT+5 (PKT)",
  units: "KM / KMH",
  twoFactorEnabled: true,
};

const emitProfileUpdated = (detail = null) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vtp-profile-updated", { detail }));
};

const setGlobalAvatarPreviewUrl = (nextUrl) => {
  if (typeof window === "undefined") return;
  window[AVATAR_PREVIEW_GLOBAL_KEY] = nextUrl || "";
};

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read selected image."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to prepare avatar image."));
    }, mimeType, quality);
  });

async function optimizeAvatarFile(file) {
  if (typeof window === "undefined") return file;
  const targetMimeType = "image/jpeg";
  const maxDimension = 320;
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return file;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const optimizedBlob = await canvasToBlob(canvas, targetMimeType, 0.82);
  if (!optimizedBlob || optimizedBlob.size <= 0) return file;
  if (optimizedBlob.size >= file.size) return file;
  const nextName = String(file.name || "avatar")
    .replace(/\.[^.]+$/, "")
    .concat(".jpg");
  return new File([optimizedBlob], nextName, {
    type: targetMimeType,
    lastModified: Date.now(),
  });
}

const formatAccountType = (loginFor) => {
  if (String(loginFor || "").toUpperCase() === "D") return "Distributor/Admin";
  if (String(loginFor || "").toUpperCase() === "C") return "Client/Customer";
  return "Customer";
};

const formatSessionDate = (value) => {
  if (!value) return "Not available yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available yet";
  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildSessionProfile = (session) => ({
  name: session?.username || session?.userId || "Customer User",
  userId: session?.userId || "Not available yet",
  email: session?.email || "Not available yet",
  phone: session?.mobile || "Not available yet",
  company: session?.loginDesc || "Organization details will appear here once the API is available.",
  accountType: formatAccountType(session?.loginFor),
  status: session?.status || "Unknown",
  loginAt: formatSessionDate(session?.loginAt),
  expiresAt: formatSessionDate(session?.expiresAt),
});

export default function ProfilePage() {
  const router = useRouter();
  const [sessionProfile, setSessionProfile] = useState(null);
  const [profilePrefs, setProfilePrefs] = useState(DEFAULT_LOCAL_PROFILE);
  const [draft, setDraft] = useState(DEFAULT_LOCAL_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  const avatarPreviewUrlRef = useRef("");
  const avatarUrl = useMemo(
    () =>
      avatarPreviewUrl ||
      (avatarUpdatedAt ? `/api/profile/avatar?v=${encodeURIComponent(avatarUpdatedAt)}` : ""),
    [avatarPreviewUrl, avatarUpdatedAt]
  );

  useEffect(
    () => () => {
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current);
        setGlobalAvatarPreviewUrl("");
      }
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const { photoDataUrl: _legacyPhotoDataUrl, ...safeParsed } = parsed || {};
      const merged = { ...DEFAULT_LOCAL_PROFILE, ...safeParsed };
      setProfilePrefs(merged);
      setDraft(merged);
    } catch {
      // Ignore invalid stored profile preferences.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cachedSession = getCachedAuthSession();
    if (cachedSession?.isLoggedIn) {
      setSessionProfile(buildSessionProfile(cachedSession));
      setIsLoadingProfile(false);
    }

    const loadSessionProfile = async () => {
      try {
        const session = await fetchSessionRequest();
        if (cancelled) return;
        if (!session?.isLoggedIn) {
          router.replace("/login");
          return;
        }
        setSessionProfile(buildSessionProfile(session));
      } catch {
        if (cancelled) return;
        router.replace("/login");
        return;
      } finally {
        if (!cancelled && !cachedSession?.isLoggedIn) setIsLoadingProfile(false);
      }
    };

    loadSessionProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let idleHandle = null;

    const loadAvatarMeta = async () => {
      try {
        if (typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              const cachedUpdatedAt = String(parsed?.avatarUpdatedAt || "").trim();
              if (cachedUpdatedAt) {
                setAvatarUpdatedAt(cachedUpdatedAt);
              }
            }
          } catch {}
        }
        const response = await fetch("/api/profile/avatar?meta=1", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setAvatarUpdatedAt("");
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(AVATAR_CACHE_KEY);
          }
          return;
        }
        const nextUpdatedAt = String(payload?.avatarUpdatedAt || "").trim();
        setAvatarUpdatedAt(nextUpdatedAt);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            AVATAR_CACHE_KEY,
            JSON.stringify({ avatarUpdatedAt: nextUpdatedAt, hasAvatar: Boolean(payload?.hasAvatar) })
          );
        }
      } catch {
        if (!cancelled) setAvatarUpdatedAt("");
      }
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        loadAvatarMeta();
      }, { timeout: 700 });
    } else {
      idleHandle = window.setTimeout(() => {
        loadAvatarMeta();
      }, 120);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
        return;
      }
      window.clearTimeout(idleHandle);
    };
  }, []);

  useEffect(() => {
    router.prefetch("/tracking");
    router.prefetch("/forgot-password");
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const initials = useMemo(() => {
    const parts = String(sessionProfile?.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "VT";
    return parts
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }, [sessionProfile?.name]);

  const activePrefs = isEditing ? draft : profilePrefs;

  const persistLocalProfile = (nextProfile) => {
    const { photoDataUrl: _legacyPhotoDataUrl, ...safeProfile } = nextProfile || {};
    setProfilePrefs(nextProfile);
    setDraft(nextProfile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfile));
      emitProfileUpdated();
    } catch {
      setStatusMessage("Preferences updated, but local save failed.");
    }
  };

  const handleFieldChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleTwoFactorToggle = (checked) => {
    if (isEditing) {
      setDraft((prev) => ({ ...prev, twoFactorEnabled: checked }));
      return;
    }
    const nextProfile = { ...profilePrefs, twoFactorEnabled: checked };
    persistLocalProfile(nextProfile);
    setStatusMessage("Preference updated locally.");
  };

  const handleStartEdit = () => {
    setDraft(profilePrefs);
    setIsEditing(true);
    setStatusMessage("");
  };

  const handleCancelEdit = () => {
    setDraft(profilePrefs);
    setIsEditing(false);
    setStatusMessage("Changes discarded.");
  };

  const handleSave = () => {
    persistLocalProfile(draft);
    setIsEditing(false);
    setStatusMessage("Local preferences updated successfully.");
  };

  const handleLogout = () => {
    redirectToLogout("/login");
  };

  const handlePhotoPick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatusMessage("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage("Image size must be under 5MB.");
      return;
    }

    const submitAvatar = async () => {
      try {
        setStatusMessage("Uploading profile photo...");
        const optimizedFile = await optimizeAvatarFile(file);
        if (avatarPreviewUrlRef.current) {
          URL.revokeObjectURL(avatarPreviewUrlRef.current);
        }
        const localPreviewUrl = URL.createObjectURL(optimizedFile);
        avatarPreviewUrlRef.current = localPreviewUrl;
        setGlobalAvatarPreviewUrl(localPreviewUrl);
        setAvatarPreviewUrl(localPreviewUrl);
        const formData = new FormData();
        formData.append("avatar", optimizedFile);
        const response = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload?.error || "Unable to upload profile photo."));
        }
        const nextUpdatedAt = String(payload?.avatarUpdatedAt || new Date().toISOString()).trim();
        setAvatarUpdatedAt(nextUpdatedAt);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            AVATAR_CACHE_KEY,
            JSON.stringify({ avatarUpdatedAt: nextUpdatedAt, hasAvatar: true })
          );
        }
        setStatusMessage("Profile photo updated successfully.");
        emitProfileUpdated({ avatarUpdatedAt: nextUpdatedAt, previewUrl: localPreviewUrl, hasAvatar: true });
      } catch (error) {
        if (avatarPreviewUrlRef.current) {
          URL.revokeObjectURL(avatarPreviewUrlRef.current);
          avatarPreviewUrlRef.current = "";
        }
        setGlobalAvatarPreviewUrl("");
        setAvatarPreviewUrl("");
        setStatusMessage(String(error?.message || "Unable to upload profile photo."));
      } finally {
        event.target.value = "";
      }
    };

    submitAvatar();
  };

  const handleRemovePhoto = () => {
    const removeAvatar = async () => {
      try {
        setStatusMessage("Removing profile photo...");
        const response = await fetch("/api/profile/avatar", {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload?.error || "Unable to remove profile photo."));
        }
        if (avatarPreviewUrlRef.current) {
          URL.revokeObjectURL(avatarPreviewUrlRef.current);
          avatarPreviewUrlRef.current = "";
        }
        setGlobalAvatarPreviewUrl("");
        setAvatarPreviewUrl("");
        setAvatarUpdatedAt("");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(AVATAR_CACHE_KEY);
        }
        setStatusMessage("Profile photo removed.");
        emitProfileUpdated({ avatarUpdatedAt: "", previewUrl: "", hasAvatar: false });
      } catch (error) {
        setStatusMessage(String(error?.message || "Unable to remove profile photo."));
      }
    };

    removeAvatar();
  };

  if (isLoadingProfile) {
    return (
      <>
        <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
          <section className={styles.loadingCard}>
            <h1>Profile</h1>
            <p>Loading your current account details...</p>
          </section>
        </main>
        {isMobileView ? <MobileBottomNav /> : null}
      </>
    );
  }

  return (
    <>
      <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
        <section className={styles.hero}>
          <button
            type="button"
            className={styles.backBtn}
            aria-label="Back to Home"
            onClick={() => {
              navigateWithTransition(router, "/tracking");
            }}
          >
            Back to Home
          </button>

          <div className={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile"
                width={140}
                height={140}
                className={styles.avatarImage}
                unoptimized
              />
            ) : (
              <div className={styles.avatar}>{initials}</div>
            )}
            <div className={styles.avatarActions}>
              <button
                type="button"
                className={styles.avatarBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className={styles.avatarBtnGhost}
                onClick={handleRemovePhoto}
                disabled={!avatarUrl}
              >
                Remove
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenInput}
                onChange={handlePhotoPick}
              />
            </div>
          </div>

          <div className={styles.heroInfo}>
            <h1>{sessionProfile?.name}</h1>
            <p className={styles.role}>{sessionProfile?.accountType}</p>
            <div className={styles.company}>{sessionProfile?.company}</div>
            <div className={styles.heroMeta}>
              <span className={styles.metaPill}>{sessionProfile?.status}</span>
              <span className={styles.metaPill}>ID: {sessionProfile?.userId}</span>
            </div>
            {statusMessage ? <p className={styles.status}>{statusMessage}</p> : null}
          </div>

          <div className={styles.heroActions}>
            {isEditing ? (
              <>
                <button className={styles.primary} type="button" onClick={handleSave}>
                  Save Preferences
                </button>
                <button className={styles.ghost} type="button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              </>
            ) : (
              <button className={styles.primary} type="button" onClick={handleStartEdit}>
                Edit Preferences
              </button>
            )}
            <button className={styles.ghost} type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <h2>Account Info</h2>
            <p className={styles.infoNote}>These values are coming from the current authenticated API session.</p>
            <div className={styles.row}>
              <span>Name</span>
              <strong>{sessionProfile?.name}</strong>
            </div>
            <div className={styles.row}>
              <span>User ID</span>
              <strong>{sessionProfile?.userId}</strong>
            </div>
            <div className={styles.row}>
              <span>Email</span>
              <strong>{sessionProfile?.email}</strong>
            </div>
            <div className={styles.row}>
              <span>Mobile</span>
              <strong>{sessionProfile?.phone}</strong>
            </div>
            <div className={styles.row}>
              <span>Account Type</span>
              <strong>{sessionProfile?.accountType}</strong>
            </div>
            <div className={styles.row}>
              <span>Status</span>
              <strong>{sessionProfile?.status}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <h2>Workspace</h2>
            <p className={styles.infoNote}>Additional organization details can be connected once the next API is available.</p>
            <div className={styles.row}>
              <span>Company / Organization</span>
              <strong>{sessionProfile?.company}</strong>
            </div>
            <div className={styles.row}>
              <span>Panel</span>
              <strong>Customer Panel</strong>
            </div>
            <div className={styles.row}>
              <span>Last Login</span>
              <strong>{sessionProfile?.loginAt}</strong>
            </div>
            <div className={styles.row}>
              <span>Session Expires</span>
              <strong>{sessionProfile?.expiresAt}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <h2>Security</h2>
            <p className={styles.infoNote}>Password changes currently use the recovery flow provided by the backend.</p>
            <div className={styles.row}>
              <span>Password</span>
              <button
                className={styles.linkBtn}
                type="button"
                onClick={() => navigateWithTransition(router, "/forgot-password")}
              >
                Open Recovery
              </button>
            </div>
            <div className={styles.row}>
              <span>Two-Factor Auth</span>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={activePrefs.twoFactorEnabled}
                  onChange={(e) => handleTwoFactorToggle(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>
            <div className={styles.row}>
              <span>Current Session</span>
              <strong>{sessionProfile?.status}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <h2>Preferences</h2>
            <p className={styles.infoNote}>These preferences are local for now and can be moved to API later.</p>
            <div className={styles.row}>
              <span>Language</span>
              {isEditing ? (
                <select
                  className={styles.fieldInput}
                  value={draft.language}
                  onChange={(e) => handleFieldChange("language", e.target.value)}
                >
                  <option>English</option>
                  <option>Urdu</option>
                </select>
              ) : (
                <strong>{profilePrefs.language}</strong>
              )}
            </div>
            <div className={styles.row}>
              <span>Timezone</span>
              {isEditing ? (
                <select
                  className={styles.fieldInput}
                  value={draft.timezone}
                  onChange={(e) => handleFieldChange("timezone", e.target.value)}
                >
                  <option>GMT+5 (PKT)</option>
                  <option>GMT+4</option>
                  <option>GMT+6</option>
                </select>
              ) : (
                <strong>{profilePrefs.timezone}</strong>
              )}
            </div>
            <div className={styles.row}>
              <span>Units</span>
              {isEditing ? (
                <select
                  className={styles.fieldInput}
                  value={draft.units}
                  onChange={(e) => handleFieldChange("units", e.target.value)}
                >
                  <option>KM / KMH</option>
                  <option>MI / MPH</option>
                </select>
              ) : (
                <strong>{profilePrefs.units}</strong>
              )}
            </div>
          </div>

          <div className={`${styles.card} ${styles.readOnlyCard}`}>
            <h2>Notifications</h2>
            <p className={styles.readOnlyNote}>Read-only for now</p>
            <div className={styles.row}>
              <span>Email</span>
              <label className={styles.toggle}>
                <input type="checkbox" defaultChecked disabled />
                <span className={styles.slider} />
              </label>
            </div>
            <div className={styles.row}>
              <span>SMS</span>
              <label className={styles.toggle}>
                <input type="checkbox" disabled />
                <span className={styles.slider} />
              </label>
            </div>
            <div className={styles.row}>
              <span>WhatsApp</span>
              <label className={styles.toggle}>
                <input type="checkbox" disabled />
                <span className={styles.slider} />
              </label>
            </div>
          </div>

          <div className={`${styles.card} ${styles.readOnlyCard}`}>
            <h2>Activity Log</h2>
            <p className={styles.readOnlyNote}>Only currently available session data is shown here.</p>
            <div className={styles.logItem}>
              <span>Last Login</span>
              <strong>{sessionProfile?.loginAt}</strong>
            </div>
            <div className={styles.logItem}>
              <span>Session Expires</span>
              <strong>{sessionProfile?.expiresAt}</strong>
            </div>
            <div className={styles.logItem}>
              <span>Account Status</span>
              <strong>{sessionProfile?.status}</strong>
            </div>
          </div>
        </section>
      </main>
      {isMobileView ? <MobileBottomNav /> : null}
    </>
  );
}
