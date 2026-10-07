(() => {
  const cfg = window.SITE_CONFIG;
  const API = "https://discord.com/api/v10";
  const TOKEN_KEY = "wwm.discord.token";
  const STATE_KEY = "wwm.discord.state";
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const KIND_LABEL = { signup: "Sign-ups", roster: "Roster", raid: "Raid", poll: "Poll", war: "Guild war" };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- storage (may be unavailable in private windows) ----------
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };

  // ---------- Discord OAuth2 implicit grant ----------
  function login() {
    const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
    store.set(STATE_KEY, state);
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
    render(null);
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

  function currentToken() {
    const tok = takeTokenFromHash() || store.get(TOKEN_KEY);
    if (!tok || tok.expires < Date.now()) { store.del(TOKEN_KEY); return null; }
    return tok.value;
  }

  async function discord(path, token) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }

  async function loadSession(token) {
    const [user, guilds] = await Promise.all([
      discord("/users/@me", token),
      discord("/users/@me/guilds", token).catch(() => []),
    ]);
    return { user, guild: guilds.find((g) => g.id === cfg.guildId) || null };
  }

  function avatarUrl(u) {
    if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
    const idx = Number((BigInt(u.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  // ---------- rendering ----------
  function render(session) {
    const auth = $("auth");
    const welcome = $("welcome");
    auth.replaceChildren();
    welcome.replaceChildren();

    if (!session) {
      const btn = el("button", "btn discord", "Log in with Discord");
      btn.onclick = login;
      auth.append(btn);
      welcome.hidden = true;
      return;
    }

    const { user, guild } = session;
    const name = user.global_name || user.username;
    const chip = el("div", "user");
    const img = el("img");
    img.src = avatarUrl(user);
    img.alt = "";
    const out = el("button", "btn ghost", "Log out");
    out.onclick = logout;
    chip.append(img, el("span", null, name), out);
    auth.append(chip);

    welcome.hidden = false;
    if (guild) {
      welcome.className = "card ok";
      welcome.append(
        el("strong", null, `Welcome back, ${name}.`),
        el("span", null, ` You're a member of ${guild.name}. See the schedule below and sign up in Discord.`),
      );
    } else {
      welcome.className = "card warn";
      welcome.append(
        el("strong", null, `Hi ${name}.`),
        el("span", null, " You're not in the guild's Discord server yet. Ask an officer for an invite."),
      );
    }
  }

  // Next occurrence of a guild-time weekday/time, as a real Date.
  function nextOccurrence(day, time) {
    const off = cfg.guildUtcOffsetHours * 3600e3;
    const [h, m] = time.split(":").map(Number);
    const nowGuild = new Date(Date.now() + off); // read with getUTC* = guild wall clock
    const target = new Date(Date.UTC(
      nowGuild.getUTCFullYear(), nowGuild.getUTCMonth(), nowGuild.getUTCDate(), h, m,
    ));
    let add = (DAYS.indexOf(day) - nowGuild.getUTCDay() + 7) % 7;
    if (add === 0 && target <= nowGuild) add = 7;
    target.setUTCDate(target.getUTCDate() + add);
    return new Date(target.getTime() - off);
  }

  function relative(ms) {
    const mins = Math.round(ms / 60e3);
    if (mins < 60) return `in ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `in ${h}h ${mins % 60}m`;
    return `in ${Math.floor(h / 24)}d ${h % 24}h`;
  }

  const fmtLocal = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const fmtDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

  function renderSchedule() {
    $("tz").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time";

    const items = cfg.schedule
      .map((e) => ({ ...e, at: nextOccurrence(e.day, e.time) }))
      .sort((a, b) => a.at - b.at);

    const list = $("upcoming");
    list.replaceChildren(...items.map((e) => {
      const li = el("li", `event ${e.kind}`);
      const when = el("div", "when");
      when.append(el("span", "local", fmtLocal.format(e.at)), el("span", "date", fmtDate.format(e.at)));
      const body = el("div", "body");
      const head = el("div", "head");
      head.append(el("span", "tag", KIND_LABEL[e.kind]), el("span", "title", e.title));
      body.append(head);
      if (e.note) body.append(el("p", "note", e.note));
      body.append(el("span", "rel muted", `${relative(e.at - Date.now())} · ${e.day.toUpperCase()} ${e.time} SGT`));
      li.append(when, body);
      return li;
    }));

    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const grid = $("routine");
    grid.replaceChildren(...order.map((d) => {
      const col = el("div", "day");
      col.append(el("h3", null, d.toUpperCase()));
      const evs = cfg.schedule.filter((e) => e.day === d).sort((a, b) => a.time.localeCompare(b.time));
      if (!evs.length) col.append(el("p", "muted", "Free"));
      for (const e of evs) {
        const row = el("p", `mini ${e.kind}`);
        row.append(el("b", null, e.time), document.createTextNode(" " + e.title));
        col.append(row);
      }
      return col;
    }));
  }

  // ---------- boot ----------
  renderSchedule();
  setInterval(renderSchedule, 60e3);

  const token = currentToken();
  render(null);
  if (token) {
    loadSession(token)
      .then(render)
      .catch(() => { store.del(TOKEN_KEY); render(null); });
  }
})();
