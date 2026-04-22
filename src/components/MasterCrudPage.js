"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import AccessGuardState from "@/components/AccessGuardState";
import { useMenuAccess } from "@/lib/useRbacAccess";
import { useAppShell } from "@/components/AppShellContext";
import styles from "./MasterCrudPage.module.css";
import pageStyles from "@/app/page.module.css";

const STATUS_OPTIONS = ["Active", "Inactive"];
const EMPTY_OPTION_SOURCES = {};
const EMPTY_AUTO_FILL_SOURCES = {};

function createInitialState(fields) {
  const state = {};
  fields.forEach((field) => {
    state[field.name] = field.defaultValue ?? "";
  });
  return state;
}

function extractRefId(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value?._id != null) return String(value._id);
    if (value?.id != null) return String(value.id);
    return "";
  }
  return String(value);
}

function validateSingleField(field, value, form) {
  const normalized = typeof value === "string" ? value.trim() : value;

  if (field.required && !String(normalized || "").trim()) {
    return `${field.label} is required.`;
  }

  if (typeof field.validate === "function") {
    return field.validate(normalized, form) || "";
  }

  return "";
}

export default function MasterCrudPage({
  title,
  description,
  apiBase,
  fields,
  columns,
  optionSources = EMPTY_OPTION_SOURCES,
  autoFillSources = EMPTY_AUTO_FILL_SOURCES,
  readOnly = false,
  readOnlyMessage = "These records are available in review mode only.",
  canCreate = true,
  canEdit = true,
  canDelete = true,
  restrictedMessage = "",
  menuKey = "",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => createInitialState(fields));
  const [fieldErrors, setFieldErrors] = useState({});
  const [options, setOptions] = useState({});
  const [showBusyOverlay, setShowBusyOverlay] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const autoFillRequestRef = useRef(0);
  const { shellActive } = useAppShell();
  const {
    ready: rbacReady,
    error: rbacError,
    canView: rbacCanView,
    canCreate: rbacCanCreate,
    canUpdate: rbacCanUpdate,
    canDelete: rbacCanDelete,
    allowedActions,
  } = useMenuAccess(menuKey);
  const isResolvingAccess = Boolean(menuKey) && !rbacReady;
  const hasViewAccess = !menuKey || rbacCanView;
  const effectiveCanCreate = !readOnly && canCreate && (!menuKey || rbacCanCreate);
  const effectiveCanEdit = !readOnly && canEdit && (!menuKey || rbacCanUpdate);
  const effectiveCanDelete = !readOnly && canDelete && (!menuKey || rbacCanDelete);
  const capabilityLabel = readOnly
    ? "View Only"
    : effectiveCanCreate && effectiveCanEdit && effectiveCanDelete
      ? "View + CRUD"
      : effectiveCanEdit && !effectiveCanCreate && !effectiveCanDelete
        ? "Update Only"
        : "Limited Access";
  const mobileCapabilityLabel = readOnly
    ? "Review"
    : effectiveCanCreate && effectiveCanEdit && effectiveCanDelete
      ? "CRUD"
      : effectiveCanEdit && !effectiveCanCreate && !effectiveCanDelete
        ? "Update"
        : "Limited";
  const canShowForm = !readOnly && hasViewAccess && isFormOpen && (editingId ? effectiveCanEdit : effectiveCanCreate);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load records.");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const fetchOptions = useCallback(async () => {
    const entries = Object.entries(optionSources);
    if (!entries.length) return;

    setOptionsLoading(true);
    try {
      const requests = await Promise.all(
        entries.map(async ([key, source]) => {
          const res = await fetch(source.url, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `Failed to load ${key}.`);

          const normalized = Array.isArray(data)
            ? data.map((item) => {
                const option = {
                  value: extractRefId(item[source.valueField || "_id"] ?? item._id ?? item.id),
                  label: String(item[source.labelField || "name"] || ""),
                };

                (source.includeFields || []).forEach((fieldName) => {
                  option[fieldName] = extractRefId(item[fieldName]);
                });
                return option;
              })
            : [];
          return [key, normalized];
        })
      );
      setOptions(Object.fromEntries(requests));
    } catch (err) {
      setError(err.message || "Failed to load select options.");
    } finally {
      setOptionsLoading(false);
    }
  }, [optionSources]);

  useEffect(() => {
    if (isResolvingAccess) return;
    if (!hasViewAccess) {
      setRows([]);
      setOptions({});
      setLoading(false);
      setOptionsLoading(false);
      return;
    }
    fetchRows();
    fetchOptions();
  }, [fetchRows, fetchOptions, hasViewAccess, isResolvingAccess]);

  const resetForm = () => {
    setForm(createInitialState(fields));
    setFieldErrors({});
    setEditingId(null);
    setIsFormOpen(false);
  };

  const clearFieldErrors = useCallback((fieldNames) => {
    if (!Array.isArray(fieldNames) || fieldNames.length === 0) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      fieldNames.forEach((fieldName) => {
        if (next[fieldName]) {
          delete next[fieldName];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const handleChange = async (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    const config = autoFillSources[name];
    if (!config) return;

    const requestId = autoFillRequestRef.current + 1;
    autoFillRequestRef.current = requestId;
    const targetFields = Object.keys(config.fieldMap || {});
    const shouldClearOnEmpty = config.clearOnEmpty !== false;
    const shouldClearBeforeLoad = config.clearBeforeLoad !== false;
    if (!String(value || "").trim()) {
      setAutoFilling(false);
      if (!shouldClearOnEmpty || targetFields.length === 0) return;
      setForm((prev) => {
        const next = { ...prev };
        targetFields.forEach((fieldName) => {
          next[fieldName] = "";
        });
        return next;
      });
      clearFieldErrors(targetFields);
      return;
    }

    const requestUrl =
      typeof config.getUrl === "function" ? config.getUrl(value, { ...form, [name]: value }) : String(config.url || "");

    if (!requestUrl) return;

    if (shouldClearBeforeLoad && targetFields.length > 0) {
      setForm((prev) => {
        const next = { ...prev };
        targetFields.forEach((fieldName) => {
          next[fieldName] = "";
        });
        return next;
      });
      clearFieldErrors(targetFields);
    }

    setAutoFilling(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(requestUrl, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || config.errorMessage || "Failed to auto-fill form.");
      }
      if (requestId !== autoFillRequestRef.current) return;

      const record = Array.isArray(data) ? data[0] : data;
      setForm((prev) => {
        const next = { ...prev };
        next[name] = value;
        targetFields.forEach((fieldName) => {
          const sourceField = config.fieldMap[fieldName];
          next[fieldName] = sourceField ? extractRefId(record?.[sourceField]) : "";
        });
        return next;
      });
      clearFieldErrors(targetFields);
    } catch (err) {
      if (requestId !== autoFillRequestRef.current) return;
      if (shouldClearOnEmpty && targetFields.length > 0) {
        setForm((prev) => {
          const next = { ...prev };
          next[name] = value;
          targetFields.forEach((fieldName) => {
            next[fieldName] = "";
          });
          return next;
        });
        clearFieldErrors(targetFields);
      }
      setError(err.message || config.errorMessage || "Failed to auto-fill form.");
    } finally {
      if (requestId === autoFillRequestRef.current) {
        setAutoFilling(false);
      }
    }
  };

  const handleEdit = (row) => {
    if (!effectiveCanEdit) return;
    const next = createInitialState(fields);
    fields.forEach((field) => {
      const raw = row?.[field.name];
      next[field.name] = extractRefId(raw);
    });
    setForm(next);
    setFieldErrors({});
    setEditingId(String(row._id));
    setIsFormOpen(true);
    setMessage("");
    setError("");
  };

  const handleDelete = async (id) => {
    if (!effectiveCanDelete) return;
    if (!window.confirm("Delete this record?")) return;
    setError("");
    setMessage("");
    setDeletingId(String(id));
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed.");
      setRows((prev) => prev.filter((item) => String(item._id) !== String(id)));
      if (editingId === String(id)) resetForm();
      setMessage("Record deleted successfully.");
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const computedValidationErrors = useMemo(() => {
    const next = {};
    fields.forEach((field) => {
      const maybeError = validateSingleField(field, form[field.name], form);
      if (maybeError) next[field.name] = maybeError;
    });
    return next;
  }, [fields, form]);

  const canSubmit = useMemo(
    () =>
      fields.every((field) => {
        if (!field.required) return true;
        return String(form[field.name] || "").trim().length > 0;
      }) && Object.keys(computedValidationErrors).length === 0,
    [fields, form, computedValidationErrors]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hasViewAccess) return;
    if (!editingId && !effectiveCanCreate) return;
    if (editingId && !effectiveCanEdit) return;

    if (Object.keys(computedValidationErrors).length > 0) {
      setFieldErrors(computedValidationErrors);
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${apiBase}/${editingId}` : apiBase;
      const payload = {};
      fields.forEach((field) => {
        const value = form[field.name];
        payload[field.name] = typeof value === "string" ? value.trim() : value;
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed.");

      setMessage(editingId ? "Record updated successfully." : "Record created successfully.");
      resetForm();
      await fetchRows();
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = loading || optionsLoading || submitting || autoFilling || Boolean(deletingId);
  const isInitialLoading = loading || optionsLoading;
  const busyMessage = submitting
    ? `Saving ${title}...`
    : deletingId
    ? `Deleting ${title}...`
    : autoFilling
    ? `Loading ${title} details...`
    : loading
    ? `Loading ${title}...`
    : `Loading ${title} form options...`;

  useEffect(() => {
    if (!isBusy) {
      setShowBusyOverlay(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowBusyOverlay(true), 350);
    return () => window.clearTimeout(timer);
  }, [isBusy]);

  return (
    <>
      {!shellActive && !isMobileView ? <Sidebar isOpen={true} /> : null}
      {!shellActive && !isMobileView ? <Header /> : null}
      <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
        {showBusyOverlay ? (
          <div className={pageStyles.centerLoaderOverlay}>
            <div className={pageStyles.centerLoaderCard}>
              <div className={pageStyles.loaderOrbit}>
                <div className={pageStyles.loaderTrack} />
                <div className={pageStyles.loaderCar} />
              </div>
              <div className={pageStyles.loaderText}>{busyMessage}</div>
            </div>
          </div>
        ) : null}
        <section className={styles.card}>
          {isMobileView ? (
            <div className={styles.mobileTopBar}>
              <strong>{title}</strong>
              <span className={styles.mobileTopBadge}>{mobileCapabilityLabel}</span>
            </div>
          ) : null}
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.subtitle}>{description}</p>
            </div>
            <span className={styles.badge}>{capabilityLabel}</span>
          </div>

          {message ? <div className={`${styles.message} ${styles.success}`}>{message}</div> : null}
          {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
          {rbacError && hasViewAccess ? <div className={styles.message}>{rbacError}</div> : null}

          {isResolvingAccess ? (
            <AccessGuardState
              mode="loading"
              title={`${title} access is loading`}
              message="Checking your page and action permissions before opening this module."
            />
          ) : !hasViewAccess ? (
            <AccessGuardState
              title={`${title} access denied`}
              message={`You do not currently have view access for ${menuKey || title}. Assign the matching role-right first, then reopen this page.`}
            />
          ) : (
            <>
              {Object.keys(allowedActions || {}).length ? (
                <div className={styles.message}>
                  Allowed actions:{" "}
                  {Object.entries(allowedActions)
                    .filter(([, allowed]) => allowed)
                    .map(([action]) => action)
                    .join(", ") || "view"}
                </div>
              ) : null}

              {readOnly ? (
                <div className={styles.message}>{readOnlyMessage}</div>
              ) : restrictedMessage ? (
                <div className={styles.message}>{restrictedMessage}</div>
              ) : null}

              {!readOnly && !effectiveCanCreate && effectiveCanEdit ? (
                <div className={styles.message}>Select a record below to update it.</div>
              ) : null}

              {!readOnly && effectiveCanCreate ? (
                <div className={styles.toolbar}>
                  <button
                    className={`${styles.btn} ${styles.primary}`}
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFieldErrors({});
                      setForm(createInitialState(fields));
                      setIsFormOpen(true);
                    }}
                  >
                    Create
                  </button>
                </div>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      {!readOnly && (effectiveCanEdit || effectiveCanDelete) ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {isInitialLoading ? (
                      <tr>
                        <td
                          colSpan={columns.length + (!readOnly && (effectiveCanEdit || effectiveCanDelete) ? 1 : 0)}
                        >
                          <div className={styles.skeletonRow} />
                          <div className={styles.skeletonRow} />
                          <div className={styles.skeletonRow} />
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          className={styles.empty}
                          colSpan={columns.length + (!readOnly && (effectiveCanEdit || effectiveCanDelete) ? 1 : 0)}
                        >
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row._id}>
                          {columns.map((col) => (
                            <td key={`${row._id}-${col.key}`}>{String(row[col.key] ?? "")}</td>
                          ))}
                          {!readOnly && (effectiveCanEdit || effectiveCanDelete) ? (
                            <td>
                              <div className={styles.rowActions}>
                                {effectiveCanEdit ? (
                                  <button
                                    className={`${styles.btn} ${styles.muted}`}
                                    type="button"
                                    onClick={() => handleEdit(row)}
                                    disabled={submitting || Boolean(deletingId)}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {effectiveCanDelete ? (
                                  <button
                                    className={`${styles.btn} ${styles.primary}`}
                                    type="button"
                                    onClick={() => handleDelete(row._id)}
                                    disabled={submitting || Boolean(deletingId)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {canShowForm ? (
          <div className={styles.modalOverlay} onClick={resetForm}>
            <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <div className={styles.modalHead}>
                <div>
                  <h2>{editingId ? `Edit ${title}` : `Create ${title}`}</h2>
                  <p>{editingId ? "Update the selected record." : "Add a new record."}</p>
                </div>
                <button type="button" className={styles.modalClose} onClick={resetForm} aria-label="Close form">
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className={styles.grid}>
                  {fields.map((field) => {
                    const value = form[field.name] ?? "";
                    const errorText = fieldErrors[field.name] || "";

                    if (field.type === "select") {
                      const baseList = field.optionsKey
                        ? options[field.optionsKey] || []
                        : Array.isArray(field.options)
                        ? field.options.map((option) =>
                            typeof option === "object"
                              ? {
                                  value: extractRefId(option.value ?? option.id ?? option._id),
                                  label: String(option.label ?? option.name ?? option.value ?? option.id ?? ""),
                                }
                              : { value: String(option), label: String(option) }
                          )
                        : STATUS_OPTIONS.map((v) => ({ value: v, label: v }));

                      const dependsOn = field.dependsOn || {};
                      const dependencyEntries = Object.entries(dependsOn);
                      const dependencyMissing = dependencyEntries.some(
                        ([formField]) => !String(form[formField] || "").trim()
                      );
                      const list = baseList.filter((opt) =>
                        dependencyEntries.every(([formField, optionField]) => {
                          if (!optionField) return true;
                          const parentValue = String(form[formField] || "").trim();
                          if (!parentValue) return false;
                          return String(opt[optionField] || "") === parentValue;
                        })
                      );

                      return (
                        <div key={field.name} className={styles.fieldWrap}>
                          <label className={styles.fieldLabel}>{field.label}</label>
                          <select
                            className={styles.select}
                            value={value}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            required={field.required}
                            disabled={dependencyMissing}
                          >
                            <option value="">{field.placeholder || `Select ${field.label}`}</option>
                            {list.map((opt) => (
                              <option key={`${field.name}-${opt.value}`} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {errorText ? <p className={styles.fieldError}>{errorText}</p> : null}
                        </div>
                      );
                    }

                    return (
                      <div key={field.name} className={styles.fieldWrap}>
                        <label className={styles.fieldLabel}>{field.label}</label>
                        <input
                          className={styles.input}
                          value={value}
                          onChange={(e) => handleChange(field.name, e.target.value)}
                          placeholder={field.placeholder || field.label}
                          required={field.required}
                        />
                        {errorText ? <p className={styles.fieldError}>{errorText}</p> : null}
                      </div>
                    );
                  })}
                </div>

                <div className={styles.actions}>
                  <button
                    className={`${styles.btn} ${styles.primary}`}
                    type="submit"
                    disabled={submitting || !canSubmit}
                  >
                    {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.muted}`}
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </main>
      {isMobileView ? <MobileBottomNav /> : null}
    </>
  );
}
