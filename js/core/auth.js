// Discord login (OAuth2 implicit grant, scope "identify"). This only proves who
// the visitor is; what they may see or edit is decided by the bot (api.js).
//
// Discord redirects back to the site root only (one registered redirect), so
// the page that started the login is remembered and the root forwards there
// once the token has been taken from the URL.
import { CONFIG } from "../config.js?v=202610080831";

const DISCORD_API = "https://discord.com/api/v10";
const TOKEN_KEY = "wwm.discord.token";
const STATE_KEY = "wwm.discord.state";
const RETURN_KEY = "wwm.discord.return";

// sessionStorage can be unavailable (private windows, blocked site data).
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export function login() {
  const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
  store.set(STATE_KEY, state);
  store.set(RETURN_KEY, location.pathname + location.search);
  const q = new URLSearchParams({
    client_id: CONFIG.discordClientId,
    response_type: "token",
    redirect_uri: CONFIG.redirectUri,
    scope: "identify",
    state,
    prompt: "none",
  });
  location.href = `https://discord.com/oauth2/authorize?${q}`;
}

export function logout() {
  store.del(TOKEN_KEY);
}

// Consume #access_token=... from the redirect, then scrub it from the URL.
function takeTokenFromHash() {
  if (!location.hash.includes("access_token") && !location.hash.includes("error")) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname + location.search);
  const expected = store.get(STATE_KEY);
  store.del(STATE_KEY);
  if (p.get("error") || !p.get("access_token") || p.get("state") !== expected) return null;
  const tok = {
    value: p.get("access_token"),
    expires: Date.now() + Number(p.get("expires_in") || 0) * 1000,
  };
  store.set(TOKEN_KEY, tok);
  return tok;
}

// True when the page is about to navigate away to finish a login.
function forwardAfterLogin() {
  const back = store.get(RETURN_KEY);
  store.del(RETURN_KEY);
  if (back && back !== location.pathname + location.search) {
    location.replace(back);
    return true;
  }
  return false;
}

// The current Discord access token, or null when logged out / expired.
export function token() {
  const fresh = takeTokenFromHash();
  if (fresh && forwardAfterLogin()) return null;
  const tok = fresh || store.get(TOKEN_KEY);
  if (!tok || tok.expires < Date.now()) { store.del(TOKEN_KEY); return null; }
  return tok.value;
}

// The visitor's Discord account (name and avatar for the header).
export async function fetchUser(tok) {
  const r = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`Discord /users/@me: ${r.status}`);
  return r.json();
}

export function avatarUrl(u) {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

export const displayName = (u) => u.global_name || u.username;
