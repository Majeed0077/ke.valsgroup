const globalForAlertSocketHub = globalThis;

if (!globalForAlertSocketHub.__vtpAlertSocketScopes) {
  globalForAlertSocketHub.__vtpAlertSocketScopes = new Map();
}

function getScopeMap() {
  return globalForAlertSocketHub.__vtpAlertSocketScopes;
}

function getScopeSet(scopeKey) {
  const scopes = getScopeMap();
  let sockets = scopes.get(scopeKey);
  if (!sockets) {
    sockets = new Set();
    scopes.set(scopeKey, sockets);
  }
  return sockets;
}

export function registerAlertSocket(scopeKey, socket) {
  if (!scopeKey || !socket) return;
  getScopeSet(scopeKey).add(socket);
}

export function unregisterAlertSocket(scopeKey, socket) {
  if (!scopeKey || !socket) return;
  const scopes = getScopeMap();
  const sockets = scopes.get(scopeKey);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) {
    scopes.delete(scopeKey);
  }
}

export function countAlertSockets(scopeKey) {
  const sockets = getScopeMap().get(scopeKey);
  return sockets?.size || 0;
}

export function broadcastAlertEvent(scopeKey, payload) {
  if (!scopeKey) return;
  const sockets = getScopeMap().get(scopeKey);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify(payload);
  for (const socket of sockets) {
    if (!socket || socket.readyState !== 1) continue;
    try {
      socket.send(message);
    } catch {
      // Ignore send failures; cleanup happens on socket close.
    }
  }
}
