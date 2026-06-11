// ─────────────────────────────────────────────
// api.js  —  shared HTTP helpers for shop + admin
// Requires: config.js loaded first
// ─────────────────────────────────────────────

function getAdminUrl() {
  return localStorage.getItem("kiranaAdminUrl") || SCRIPT_URL || "";
}

function getSessionToken() {
  return sessionStorage.getItem("kiranaSessionPwd") || "";
}

function isConfigured() {
  const u = getAdminUrl();
  return u && u !== APPS_SCRIPT_PLACEHOLDER;
}

// For large payloads (e.g. image uploads) uses POST; otherwise GET
async function securePost(params) {
  const url = getAdminUrl();
  if (!isConfigured()) return { error: "not_configured" };
  try {
    const payload = { ...params, _ts: Date.now() };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const isLarge = encoded.length > 6000;
    let res;
    if (isLarge) {
      res = await fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ d: encoded })
      });
    } else {
      res = await fetch(`${url}?d=${encodeURIComponent(encoded)}`, { redirect: "follow" });
    }
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) { return { error: "bad_response", raw: text.substring(0, 200) }; }
  } catch (e) {
    return { error: "network", message: e.message };
  }
}

async function publicGet(action) {
  const url = getAdminUrl();
  if (!isConfigured()) return { error: "not_configured" };
  try {
    const res = await fetch(`${url}?action=${action}&t=${Date.now()}`, { redirect: "follow" });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) { return { error: "bad_response", raw: text.substring(0, 200) }; }
  } catch (e) {
    return { error: "network", message: e.message };
  }
}

// Admin calls — token automatically attached
async function adminCall(params) {
  return await securePost({ ...params, token: getSessionToken() });
}
