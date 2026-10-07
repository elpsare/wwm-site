(() => {
  const cfg = window.SITE_CONFIG;
  const INTEREST_FOR = {
    gvg: ["Guild War (GvG)"],
    pve: ["Skyward Bond", "Speedruns"],
    social: ["Casual/Social (Movies, Games, etc.)"],
  };
  const RATING = { Like: "👍", Neutral: "😐", Dislike: "👎" };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const short = (s) => s.split(" (")[0];
  const list = (a) => (a && a.length ? a.map(short).join(", ") : "—");
  const yn = (b) => (b ? "yes" : "no");

  let data = null;

  function mainBuild(m, cat) {
    return m.builds.find((b) => b.category === cat && b.is_main) || null;
  }

  // ---------- one member ----------
  function row(dl, label, value) {
    dl.append(el("dt", null, label), el("dd", null, value || "—"));
  }

  function buildBlock(b) {
    const box = el("div", "build");
    const head = el("div", "build-head");
    head.append(el("strong", null, b.label || `${b.category.toUpperCase()} build #${b.id}`));
    if (b.is_main) head.append(el("span", "badge", "★ Main"));
    box.append(head);
    const dl = el("dl", "facts");
    const w = b.category === "gvg" ? [b.weapon_1, b.weapon_2] : [b.pve_weapon_1, b.pve_weapon_2];
    const arts = [...new Set(w.map((x) => data.options.weapon_martial_art[x]).filter(Boolean))];
    row(dl, "Weapons", w.filter(Boolean).join(" + ") + (arts.length ? ` (${arts.join(" / ")})` : ""));
    row(dl, "Inner ways", b.inner_ways.map((i) => (i.tier ? `${i.way} T${i.tier}` : i.way)).join(", "));
    if (b.other_inner_ways) row(dl, "Also", b.other_inner_ways);
    if (b.category === "gvg") {
      row(dl, "Mystic skills", b.mystic_skills.join(", "));
      row(dl, "Would swap build", b.willing_to_change);
    } else {
      row(dl, "Screenshots", data.options.screenshot_kinds
        .map((k) => `${k.replace(/_/g, " ")} ${b.screenshots.includes(k) ? "✓" : "—"}`).join(" · "));
    }
    box.append(dl);
    return box;
  }

  function memberCard(m) {
    const d = el("details", "member");
    const sum = el("summary");
    const who = el("div", "who");
    if (m.avatar) {
      const img = el("img");
      img.src = m.avatar;
      img.alt = "";
      img.loading = "lazy";
      who.append(img);
    }
    const names = el("div", "names");
    names.append(el("strong", null, m.ign || m.name || `#${m.discord_id}`),
      el("span", "muted", m.ign ? m.name : ""));
    who.append(names);

    const gvg = mainBuild(m, "gvg"), pve = mainBuild(m, "pve");
    const facts = el("div", "glance");
    facts.append(
      el("span", null, m.region || "—"),
      el("span", null, `GvG: ${gvg ? gvg.summary.replace("★ ", "") : "—"}`),
      el("span", null, `PvE: ${pve ? pve.summary.replace("★ ", "") : "—"}`),
    );
    const status = !m.in_guild ? el("span", "pill-tag gone", "Left server")
      : m.missing.length ? el("span", "pill-tag todo", `${m.missing.length} to do`)
        : el("span", "pill-tag done", "Complete");
    sum.append(who, facts, status);
    d.append(sum);

    // Details are built on first open - the roster can be long.
    d.addEventListener("toggle", () => {
      if (!d.open || d.dataset.filled) return;
      d.dataset.filled = "1";
      const body = el("div", "member-body");

      const general = el("dl", "facts");
      row(general, "Discord", m.name);
      row(general, "Age range", m.age_range);
      row(general, "Devices", list(m.devices));
      row(general, "Interests", list(m.content_interests));
      if (m.combat_power != null) row(general, "Combat power", String(m.combat_power));
      if (m.gear_score != null) row(general, "Gear score", String(m.gear_score));
      row(general, "Submitted", (m.form_submitted_at || "").slice(0, 10));
      row(general, "Last updated", (m.updated_at || "").slice(0, 10));
      if (m.missing.length) row(general, "Still to do", m.missing.join(", "));
      body.append(el("h4", null, "General"), general);

      const g = el("dl", "facts");
      row(g, "Availability", m.gvg_availability);
      row(g, "Voice", yn(m.gvg_voice));
      row(g, "Rules", m.gvg_ack_ok ? "acknowledged" : "not acknowledged");
      body.append(el("h4", null, "Guild war"), g);
      for (const b of m.builds.filter((x) => x.category === "gvg")) body.append(buildBlock(b));

      const p = el("dl", "facts");
      row(p, "Voice", yn(m.pve_voice));
      row(p, "Rules", m.pve_ack_ok ? "acknowledged" : "not acknowledged");
      body.append(el("h4", null, "PvE"), p);
      for (const b of m.builds.filter((x) => x.category === "pve")) body.append(buildBlock(b));

      const s = el("dl", "facts");
      row(s, "Interests", list(m.social_interests));
      row(s, "Voice / buddy", `${yn(m.social_voice)} / ${yn(m.social_buddy)}`);
      row(s, "Event ratings", data.options.social_activities
        .map((a) => `${short(a.label)} ${RATING[m[`social_rating_${a.key}`]] || "—"}`).join(" · "));
      if (m.social_wishlist) row(s, "Wishlist", m.social_wishlist);
      body.append(el("h4", null, "Social"), s);

      d.append(body);
    });
    return d;
  }

  // ---------- list + filters ----------
  function matches(m) {
    const q = $("q").value.trim().toLowerCase();
    if (q) {
      const hay = [m.ign, m.name, ...m.builds.map((b) => b.summary)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const interest = $("interest").value;
    if (interest && !INTEREST_FOR[interest].some((i) => m.content_interests.includes(i))) return false;
    const state = $("state").value;
    if (state === "done" && (m.missing.length || !m.in_guild)) return false;
    if (state === "todo" && (!m.missing.length || !m.in_guild)) return false;
    if (state === "gone" && m.in_guild) return false;
    return true;
  }

  function renderList() {
    const shown = data.members.filter(matches);
    $("count").textContent = `Showing ${shown.length} of ${data.members.length} members`;
    $("roster").replaceChildren(...shown.map(memberCard));
  }

  function renderStatus() {
    const inGuild = data.members.filter((m) => m.in_guild);
    const done = inGuild.filter((m) => !m.missing.length).length;
    const box = $("status");
    box.className = "card";
    box.replaceChildren(
      el("strong", null, `${done} of ${inGuild.length} members have a complete profile.`),
      el("span", "muted", " Members who never opened the questionnaire aren't listed."),
    );
  }

  function showMessage(kind, ...parts) {
    const box = $("status");
    box.className = `card ${kind}`;
    box.replaceChildren(...parts);
    $("tools").hidden = true;
    $("roster").replaceChildren();
    $("count").textContent = "";
  }

  function showLoggedOut(reason) {
    WWMAuth.renderChip($("auth"), null, showLoggedOut);
    const btn = el("button", "btn discord", "Log in with Discord");
    btn.onclick = WWMAuth.login;
    showMessage("warn", el("p", null, reason || "Log in with Discord to see the roster."), btn);
  }

  async function boot() {
    const token = WWMAuth.token();
    if (!token) { showLoggedOut(); return; }
    WWMAuth.session(token)
      .then((s) => WWMAuth.renderChip($("auth"), s.user, showLoggedOut))
      .catch(() => {});
    showMessage("", el("span", "muted", "Loading the roster…"));
    try {
      const r = await fetch(`${cfg.apiBase}/roster`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await r.json().catch(() => ({}));
      if (r.status === 401) { WWMAuth.logout(); showLoggedOut(json.error); return; }
      if (r.status === 403) {
        const link = el("a", null, "Go to your own profile");
        link.href = "profile.html";
        showMessage("warn", el("p", null, json.error || "Only officers can see the roster."), link);
        return;
      }
      if (!r.ok) throw new Error(json.error || `Request failed (${r.status})`);
      data = json;
      renderStatus();
      $("tools").hidden = false;
      for (const id of ["q", "interest", "state"]) $(id).addEventListener("input", renderList);
      renderList();
    } catch (e) {
      showMessage("warn", el("span", null, e.message === "Failed to fetch"
        ? "Couldn't reach the guild bot. It may be restarting, so try again in a minute."
        : e.message));
    }
  }

  boot();
})();
