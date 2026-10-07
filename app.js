(() => {
  const cfg = window.SITE_CONFIG;
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const KIND_LABEL = { signup: "Sign-ups", roster: "Roster", raid: "Raid", poll: "Poll", war: "Guild war" };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- rendering ----------
  // access: the bot's answer from /api/me, or null if the bot couldn't be reached.
  function render(session, access) {
    const welcome = $("welcome");
    welcome.replaceChildren();
    WWMAuth.renderChip($("auth"), session && session.user, () => render(null));
    $("nav-roster").hidden = !(access && access.officer);

    if (!session) {
      welcome.hidden = true;
      return;
    }

    const name = session.user.global_name || session.user.username;
    welcome.hidden = false;
    if (!access) {
      welcome.className = "card";
      welcome.append(el("strong", null, `Hi ${name}.`),
        el("span", "muted", " Couldn't reach the guild bot to check your membership. Try again in a minute."));
    } else if (access.member) {
      welcome.className = "card ok";
      const link = el("a", null, "Fill in or update your guild profile");
      link.href = "profile.html";
      welcome.append(
        el("strong", null, `Welcome back, ${access.name || name}.`),
        el("span", null, " "),
        link,
        el("span", null, ", or see the schedule below."),
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

  const token = WWMAuth.token();
  render(null);
  if (token) {
    WWMAuth.session(token)
      .then((s) => WWMAuth.access(token)
        .then((a) => render(s, a), () => render(s, null)))
      .catch(() => { WWMAuth.logout(); render(null); });
  }
})();
