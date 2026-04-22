import crypto from "crypto";

export function buildAlertScopeKey(sourceOrLoginFor, loginKey = "") {
  if (sourceOrLoginFor && typeof sourceOrLoginFor === "object") {
    const scopeType = String(
      sourceOrLoginFor.ownershipScopeType || sourceOrLoginFor.scopeType || "login"
    ).trim();
    const scopeId = String(
      sourceOrLoginFor.ownershipScopeId ||
        sourceOrLoginFor.scopeId ||
        sourceOrLoginFor.distributorId ||
        `${String(sourceOrLoginFor.loginFor || "").toUpperCase()}:${String(
          sourceOrLoginFor.loginKey || ""
        )}`
    ).trim();
    return crypto.createHash("sha256").update(`${scopeType}:${scopeId}`).digest("hex");
  }

  return crypto
    .createHash("sha256")
    .update(`${String(sourceOrLoginFor || "").toUpperCase()}:${String(loginKey || "")}`)
    .digest("hex");
}
