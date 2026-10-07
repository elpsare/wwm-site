// Discord OAuth2 implicit grant, shared by every page. Discord only redirects
// back to the site root (one registered redirect), so the page that started the
// login is remembered and the root forwards there once the token is taken.
window.WWMAuth = (() => {
  const cfg = window.SITE_CONFIG;
  const API = "https://discord.com/api/v10";
  const TOKEN_KEY = "wwm.discord.token";
  const STATE_KEY = "wwm.discord.state";
  const RETURN_KEY = "wwm.discord.return";

  // ---------- storage (may be unavailable in private windows) ----------
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };

  function login() {
    const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
    store.set(STATE_KEY, state);
    store.set(RETURN_KEY, location.pathname + location.search);
    const q = new URLSearchParams({
      client_id: cfg.discordClientId,
      response_type: "token",
      redirect_uri: cfg.redirectUri,
      scope: "identify guilds",
      state,
      prompt: "none",
    });
    location.href = `https://discord.com/oauth2/authorize?${q}`;
  }

  function logout() {
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

  // Returns true when the page is about to navigate away to finish a login.
  function forwardAfterLogin() {
    const back = store.get(RETURN_KEY);
    store.del(RETURN_KEY);
    if (back && back !== location.pathname + location.search) {
      location.replace(back);
      return true;
    }
    return false;
  }

  function token() {
    const fresh = takeTokenFromHash();
    if (fresh && forwardAfterLogin()) return null;
    const tok = fresh || store.get(TOKEN_KEY);
    if (!tok || tok.expires < Date.now()) { store.del(TOKEN_KEY); return null; }
    return tok.value;
  }

  async function discord(path, tok) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }

  async function session(tok) {
    const [user, guilds] = await Promise.all([
      discord("/users/@me", tok),
      discord("/users/@me/guilds", tok).catch(() => []),
    ]);
    return { user, guild: guilds.find((g) => g.id === cfg.guildId) || null };
  }

  function avatarUrl(u) {
    if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
    const idx = Number((BigInt(u.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  // Header chip: "Log in" button, or avatar + name + "Log out".
  function renderChip(container, user, onLogout) {
    container.replaceChildren();
    if (!user) {
      const btn = document.createElement("button");
      btn.className = "btn discord";
      btn.textContent = "Log in with Discord";
      btn.onclick = login;
      container.append(btn);
      return;
    }
    const chip = document.createElement("div");
    chip.className = "user";
    const img = document.createElement("img");
    img.src = avatarUrl(user);
    img.alt = "";
    const name = document.createElement("span");
    name.textContent = user.global_name || user.username;
    const out = document.createElement("button");
    out.className = "btn ghost";
    out.textContent = "Log out";
    out.onclick = () => { logout(); onLogout(); };
    chip.append(img, name, out);
    container.append(chip);
  }

  return { login, logout, token, session, renderChip };
})();
