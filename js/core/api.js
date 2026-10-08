// Client for the bot's web API (bot/profile/web.py). Every call sends the
// visitor's Discord token; the bot checks who it belongs to, that they're in
// the guild, and (for the roster) that they're an officer.
import { CONFIG } from "../config.js?v=202610080831";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // HTTP status, or 0 when the bot couldn't be reached
  }
}

const UNREACHABLE = "Couldn't reach the guild bot. It may be restarting, so try again in a minute.";

async function request(token, method, path, body) {
  let r;
  try {
    r = await fetch(CONFIG.apiBase + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(UNREACHABLE, 0);
  }
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(json.error || `Request failed (${r.status})`, r.status);
  return json;
}

// Profile calls all return the full profile payload:
// { user, member, builds, missing, options }.
export function botApi(token) {
  const call = (method, path, body) => request(token, method, path, body);
  return {
    me: () => call("GET", "/me"), // { member, officer, name }
    profile: () => call("GET", "/profile"),
    updateProfile: (fields) => call("PATCH", "/profile", fields),
    addBuild: (category) => call("POST", "/profile/builds", { category }),
    updateBuild: (id, fields) => call("PATCH", `/profile/builds/${id}`, fields),
    setMainBuild: (id) => call("POST", `/profile/builds/${id}/main`),
    deleteBuild: (id) => call("DELETE", `/profile/builds/${id}`),
    roster: () => call("GET", "/roster"), // officers only
  };
}
