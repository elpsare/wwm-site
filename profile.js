(() => {
  const cfg = window.SITE_CONFIG;
  const CAT_TITLE = { gvg: "GvG build", pve: "PvE build" };
  const INTEREST_FOR = {
    gvg: ["Guild War (GvG)"],
    pve: ["Skyward Bond", "Speedruns"],
    social: ["Casual/Social (Movies, Games, etc.)"],
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let token = null;
  let data = null; // last API payload: { user, member, builds, missing, options }

  // ---------- API ----------
  async function api(method, path, body) {
    const r = await fetch(cfg.apiBase + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    if (r.status === 401) { WWMAuth.logout(); showLoggedOut(json.error); throw new Error(json.error); }
    if (!r.ok) throw new Error(json.error || `Request failed (${r.status})`);
    data = json;
    renderStatus();
    return json;
  }

  // Runs a save, showing progress/result next to the button that triggered it.
  async function save(button, note, fn) {
    button.disabled = true;
    note.className = "save-note muted";
    note.textContent = "Saving…";
    try {
      await fn();
      note.className = "save-note ok";
      note.textContent = "Saved ✓";
    } catch (e) {
      note.className = "save-note err";
      note.textContent = e.message || "Couldn't save.";
    } finally {
      button.disabled = false;
    }
  }

  // ---------- form widgets ----------
  let uid = 0;
  function field(label, control, hint) {
    const wrap = el("div", "field");
    const id = control.id || (control.id = `f${++uid}`);
    const lab = el("label", null, label);
    if (control.tagName === "FIELDSET") {
      const legend = el("legend", null, label);
      control.prepend(legend);
      wrap.append(control);
    } else {
      lab.htmlFor = id;
      wrap.append(lab, control);
    }
    if (hint) wrap.append(el("p", "hint muted", hint));
    return wrap;
  }

  function select(options, value, { blank = "— pick one —", label = (o) => o } = {}) {
    const s = el("select");
    if (blank != null) s.append(new Option(blank, ""));
    for (const o of options) s.append(new Option(label(o), o, false, o === value));
    if (!options.includes(value)) s.value = "";
    return s;
  }

  function yesNo(value) {
    const s = select(["Yes", "No"], value ? "Yes" : "No", { blank: null });
    s.read = () => s.value === "Yes";
    return s;
  }

  function checks(options, selected, { max } = {}) {
    const fs = el("fieldset", "checks");
    const boxes = options.map((o) => {
      const lab = el("label", "check");
      const box = el("input");
      box.type = "checkbox";
      box.value = o;
      box.checked = selected.includes(o);
      lab.append(box, el("span", null, o));
      fs.append(lab);
      return box;
    });
    const limit = () => {
      if (!max) return;
      const n = boxes.filter((b) => b.checked).length;
      for (const b of boxes) b.disabled = !b.checked && n >= max;
    };
    fs.addEventListener("change", limit);
    limit();
    fs.read = () => boxes.filter((b) => b.checked).map((b) => b.value);
    return fs;
  }

  function text(value, maxLength, { multiline = false, placeholder = "" } = {}) {
    const t = el(multiline ? "textarea" : "input");
    if (!multiline) t.type = "text";
    t.value = value || "";
    t.maxLength = maxLength;
    t.placeholder = placeholder;
    if (multiline) t.rows = 3;
    return t;
  }

  function saveRow(onSave, label = "Save") {
    const row = el("div", "save-row");
    const btn = el("button", "btn primary", label);
    const note = el("span", "save-note");
    btn.type = "button";
    btn.onclick = () => save(btn, note, onSave);
    row.append(btn, note);
    return row;
  }

  function section(title, open, hint) {
    const d = el("details", "card section");
    d.open = open;
    const sum = el("summary");
    sum.append(el("span", "section-title", title));
    if (hint) sum.append(el("span", "muted section-hint", hint));
    d.append(sum);
    return d;
  }

  // ---------- status ----------
  function renderStatus() {
    const box = $("status");
    box.replaceChildren();
    if (!data.missing.length) {
      box.className = "card ok";
      const when = data.member.form_submitted_at ? ` (first completed ${data.member.form_submitted_at.slice(0, 10)})` : "";
      box.append(el("strong", null, "Your profile is complete ✓"), el("span", null, when));
    } else {
      box.className = "card warn";
      box.append(el("strong", null, "Still to do: "), el("span", null, data.missing.join(", ")));
    }
  }

  // ---------- sections ----------
  function generalSection() {
    const m = data.member, o = data.options;
    const d = section("General", true);
    const ign = text(m.ign, 32);
    const region = select(o.regions, m.region);
    const age = select(o.age_ranges, m.age_range);
    const devices = checks(o.devices, m.devices);
    const interests = checks(o.content_interests, m.content_interests);
    d.append(
      field("In-game name", ign),
      field("Where do you play from?", region),
      field("Age range", age),
      field("Device(s) you use", devices),
      field("Content you're interested in", interests,
        "This decides which of the sections below you need to fill in."),
      saveRow(async () => {
        await api("PATCH", "/profile", {
          ign: ign.value, region: region.value, age_range: age.value,
          devices: devices.read(), content_interests: interests.read(),
        });
        renderSections(); // interests change which sections are expected
      }),
    );
    return d;
  }

  function ackField(kind, acknowledged) {
    const opts = data.options[`ack_${kind}`];
    const s = select(opts, "", { blank: acknowledged ? "Already acknowledged ✓" : "— pick the option the note names —" });
    return s;
  }

  function wanted(cat) {
    return INTEREST_FOR[cat].some((i) => data.member.content_interests.includes(i));
  }

  function gvgSection() {
    const m = data.member, o = data.options;
    const d = section("GvG (guild war)", wanted("gvg"), wanted("gvg") ? null : "optional, you didn't pick Guild War");
    const avail = select(o.gvg_availability, m.gvg_availability);
    const voice = yesNo(m.gvg_voice);
    const ack = ackField("gvg", m.gvg_ack_ok);
    d.append(
      el("p", "note", o.notes.gvg),
      field("When are you available for GvG?", avail),
      field("Join Discord voice during GvG? (mic optional)", voice),
      field("Acknowledgement", ack),
      saveRow(() => api("PATCH", "/profile", {
        gvg_availability: avail.value, gvg_voice: voice.read(),
        ...(ack.value ? { gvg_ack: ack.value } : {}),
      })),
      buildsBlock("gvg"),
    );
    return d;
  }

  function pveSection() {
    const m = data.member, o = data.options;
    const d = section("PvE (Skyward Bond / Speedruns)", wanted("pve"), wanted("pve") ? null : "optional, you didn't pick Skyward Bond or Speedruns");
    const voice = yesNo(m.pve_voice);
    const ack = ackField("pve", m.pve_ack_ok);
    d.append(
      el("p", "note", o.notes.pve),
      field("Join Discord voice during PvE? (mic optional)", voice),
      field("Acknowledgement", ack),
      saveRow(() => api("PATCH", "/profile", {
        pve_voice: voice.read(), ...(ack.value ? { pve_ack: ack.value } : {}),
      })),
      buildsBlock("pve"),
    );
    return d;
  }

  function socialSection() {
    const m = data.member, o = data.options;
    const d = section("Casual / Social", wanted("social"), wanted("social") ? null : "optional, you didn't pick Casual/Social");
    const interests = checks(o.social_interests, m.social_interests);
    const voice = yesNo(m.social_voice);
    const buddy = yesNo(m.social_buddy);
    const wishlist = text(m.social_wishlist, 300, { multiline: true });

    const ratings = el("div", "ratings");
    const read = {};
    for (const a of o.social_activities) {
      const key = `social_rating_${a.key}`;
      const row = el("fieldset", "rating-row");
      row.append(el("legend", null, a.label));
      for (const r of o.social_ratings) {
        const lab = el("label", "pill");
        const radio = el("input");
        radio.type = "radio";
        radio.name = key;
        radio.value = r;
        radio.checked = m[key] === r;
        lab.append(radio, el("span", null, r));
        row.append(lab);
      }
      read[key] = () => (row.querySelector("input:checked") || {}).value || "";
      ratings.append(row);
    }

    d.append(
      el("p", "note", o.notes.social),
      field("Your in-game interests", interests),
      field("Join Discord voice for social activities?", voice),
      field("Interested in the buddy system?", buddy),
      field("Activities you hope to see", wishlist),
      el("h4", null, "How do you feel about these events?"),
      ratings,
      saveRow(() => api("PATCH", "/profile", {
        social_interests: interests.read(), social_voice: voice.read(),
        social_buddy: buddy.read(), social_wishlist: wishlist.value,
        ...Object.fromEntries(Object.entries(read).map(([k, f]) => [k, f()])),
      })),
    );
    return d;
  }

  // ---------- builds ----------
  function buildsBlock(cat) {
    const wrap = el("div", "builds");
    wrap.dataset.cat = cat;
    fillBuilds(wrap, cat);
    return wrap;
  }

  function fillBuilds(wrap, cat) {
    const builds = data.builds.filter((b) => b.category === cat);
    wrap.replaceChildren(el("h4", null, `Your ${cat.toUpperCase()} builds`));
    if (!builds.length) wrap.append(el("p", "muted", "No builds yet. Add at least one."));
    for (const b of builds) wrap.append(buildCard(b));
    const row = el("div", "save-row");
    const add = el("button", "btn ghost", "+ Add build");
    const note = el("span", "save-note");
    add.type = "button";
    add.onclick = () => save(add, note, async () => {
      await api("POST", "/profile/builds", { category: cat });
      fillBuilds(wrap, cat);
    });
    row.append(add, note);
    wrap.append(row);
  }

  function refreshBuilds(cat) {
    const wrap = document.querySelector(`.builds[data-cat="${cat}"]`);
    if (wrap) fillBuilds(wrap, cat);
  }

  function weaponSelect(value) {
    const arts = data.options.weapon_martial_art;
    return select(data.options.weapons, value, {
      blank: "— none —", label: (w) => (arts[w] ? `${w} · ${arts[w]}` : w),
    });
  }

  function innerWaySelect(value) {
    const s = el("select");
    s.append(new Option("— none —", ""));
    for (const [art, ways] of Object.entries(data.options.martial_arts)) {
      const g = el("optgroup");
      g.label = art;
      for (const w of ways) g.append(new Option(w, w, false, w === value));
      s.append(g);
    }
    return s;
  }

  function buildCard(b) {
    const o = data.options;
    const card = el("div", "build");
    const head = el("div", "build-head");
    head.append(el("strong", null, b.label || `${CAT_TITLE[b.category]} #${b.id}`));
    if (b.is_main) head.append(el("span", "badge", "★ Main"));
    card.append(head);

    const label = text(b.label, 60, { placeholder: "e.g. Tank, DPS" });
    card.append(field("Build name (optional)", label));

    const w1Key = b.category === "gvg" ? "weapon_1" : "pve_weapon_1";
    const w2Key = b.category === "gvg" ? "weapon_2" : "pve_weapon_2";
    const w1 = weaponSelect(b[w1Key]);
    const w2 = weaponSelect(b[w2Key]);
    const pair = el("div", "pair");
    pair.append(field("Weapon 1", w1), field("Weapon 2", w2));
    card.append(pair);

    const warn = el("p", "warn-text");
    const checkArts = () => {
      const a1 = o.weapon_martial_art[w1.value], a2 = o.weapon_martial_art[w2.value];
      warn.textContent = b.category === "pve" && a1 && a2 && a1 !== a2
        ? `${w1.value} (${a1}) and ${w2.value} (${a2}) are different martial arts. PvE builds should use one.`
        : "";
    };
    w1.onchange = w2.onchange = checkArts;
    checkArts();
    card.append(warn);
    card.append(el("p", "hint muted", b.category === "gvg"
      ? "GvG can mix martial arts across the two weapons."
      : "PvE builds should use the same martial art for both weapons."));

    let willing = null, mystic = null;
    if (b.category === "gvg") {
      willing = select(o.willing_to_change, b.willing_to_change);
      mystic = checks(o.mystic_skills, b.mystic_skills, { max: o.mystic_max });
      card.append(
        field("Willing to change build?", willing),
        field(`Mystic skills (up to ${o.mystic_max})`, mystic),
      );
    }

    const iwRows = el("div", "inner-ways");
    const slots = [];
    for (let i = 0; i < o.inner_way_max; i++) {
      const cur = b.inner_ways[i] || { way: "", tier: "" };
      const way = innerWaySelect(cur.way);
      const tier = select(o.inner_way_tiers, cur.tier, { blank: "Tier", label: (t) => `Tier ${t}` });
      const row = el("div", "iw-row");
      row.append(el("span", "muted", `#${i + 1}`), way, tier);
      iwRows.append(row);
      slots.push({ way, tier });
    }
    card.append(field(`Inner ways (up to ${o.inner_way_max})`, iwRows));

    const other = text(b.other_inner_ways, 200, { placeholder: "e.g. Bitter Seasons T6" });
    card.append(field("Other notable inner ways", other));

    if (b.category === "pve") {
      const have = o.screenshot_kinds.map((k) => `${k.replace(/_/g, " ")} ${b.screenshots.includes(k) ? "✓" : "—"}`);
      card.append(el("p", "hint muted", `Screenshots: ${have.join(" · ")}. Upload them in Discord with /profile screenshot.`));
    }

    const row = el("div", "save-row");
    const saveBtn = el("button", "btn primary", "Save build");
    const note = el("span", "save-note");
    saveBtn.type = "button";
    saveBtn.onclick = () => save(saveBtn, note, async () => {
      const body = {
        label: label.value, [w1Key]: w1.value, [w2Key]: w2.value,
        other_inner_ways: other.value,
        inner_ways: slots.filter((s) => s.way.value).map((s) => ({ way: s.way.value, tier: s.tier.value })),
      };
      if (willing) body.willing_to_change = willing.value;
      if (mystic) body.mystic_skills = mystic.read();
      await api("PATCH", `/profile/builds/${b.id}`, body);
      head.firstChild.textContent = label.value || `${CAT_TITLE[b.category]} #${b.id}`;
    });
    row.append(saveBtn);

    if (!b.is_main) {
      const main = el("button", "btn ghost", "☆ Set as main");
      main.type = "button";
      main.onclick = () => save(main, note, async () => {
        await api("POST", `/profile/builds/${b.id}/main`);
        refreshBuilds(b.category);
      });
      row.append(main);
    }
    const del = el("button", "btn ghost danger", "Delete");
    del.type = "button";
    del.onclick = () => {
      if (!confirm("Delete this build and its screenshots? This can't be undone.")) return;
      save(del, note, async () => {
        await api("DELETE", `/profile/builds/${b.id}`);
        refreshBuilds(b.category);
      });
    };
    row.append(del, note);
    card.append(row);
    return card;
  }

  // ---------- page states ----------
  function renderSections() {
    $("profile").replaceChildren(generalSection(), gvgSection(), pveSection(), socialSection());
  }

  function showMessage(kind, ...parts) {
    const box = $("status");
    box.className = `card ${kind}`;
    box.replaceChildren(...parts);
    $("profile").replaceChildren();
  }

  function showLoggedOut(reason) {
    WWMAuth.renderChip($("auth"), null, showLoggedOut);
    const btn = el("button", "btn discord", "Log in with Discord");
    btn.onclick = WWMAuth.login;
    showMessage("warn", el("p", null, reason || "Log in with Discord to see and edit your profile."), btn);
  }

  async function boot() {
    token = WWMAuth.token();
    if (!token) { showLoggedOut(); return; }
    WWMAuth.session(token)
      .then((s) => WWMAuth.renderChip($("auth"), s.user, showLoggedOut))
      .catch(() => {});
    showMessage("", el("span", "muted", "Loading your profile…"));
    try {
      await api("GET", "/profile");
      $("nav-roster").hidden = !data.user.officer;
      renderSections();
    } catch (e) {
      if (WWMAuth.token()) showMessage("warn", el("span", null, e.message === "Failed to fetch"
        ? "Couldn't reach the guild bot. It may be restarting, so try again in a minute."
        : e.message));
    }
  }

  boot();
})();
