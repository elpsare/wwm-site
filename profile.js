(() => {
  const cfg = window.SITE_CONFIG;
  const SECTIONS = [
    { id: "general", name: "General", title: "General" },
    { id: "gvg", name: "Guild War", title: "Guild War" },
    { id: "pve", name: "PvE", title: "PvE — Skyward Bond / Speedruns" },
    { id: "social", name: "Social", title: "Casual / Social" },
  ];
  const INTEREST_FOR = {
    gvg: ["Guild War (GvG)"],
    pve: ["Skyward Bond", "Speedruns"],
    social: ["Casual/Social (Movies, Games, etc.)"],
  };
  const WHY_OPTIONAL = {
    gvg: "You didn't pick Guild War, so this page is optional. Fill it in anyway if you join GvG.",
    pve: "You didn't pick Skyward Bond or Speedruns, so this page is optional. Fill it in anyway to add PvE builds.",
    social: "You didn't pick Casual/Social, so this page is optional. Fill it in to rate events and join the buddy system.",
  };
  // Which of the server's "still to do" items belong to each section.
  const GENERAL_MISSING = ["ign", "age range", "devices", "content interests"];
  const MISSING_MATCH = { gvg: /GvG/, pve: /PvE/, social: /Social/ };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  function icon(paths, { size = 16, fill = false, width = 2 } = {}) {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("fill", fill ? "currentColor" : "none");
    if (!fill) {
      s.setAttribute("stroke", "currentColor");
      s.setAttribute("stroke-width", width);
      s.setAttribute("stroke-linecap", "round");
      s.setAttribute("stroke-linejoin", "round");
    }
    for (const d of paths) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      s.append(p);
    }
    return s;
  }
  const ICON = {
    check: () => icon(["M20 6 9 17l-5-5"], { size: 14, width: 3 }),
    plus: () => icon(["M12 5v14", "M5 12h14"], { width: 2.2 }),
    star: () => icon(["m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"], { size: 14, fill: true }),
    info: () => icon(["M12 16v-4", "M12 8h.01", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"], { size: 20, width: 1.8 }),
  };

  let token = null;
  let data = null; // last API payload: { user, member, builds, missing, options }
  let editing = null; // id of the build whose editor is open
  let current = null; // id of the section on screen (one section per page)
  const statusEls = {}; // section id -> its header status element

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
    refreshStatus();
    return json;
  }

  // Runs a save, showing progress/result in `note`.
  async function save(button, note, fn) {
    button.disabled = true;
    note.className = "pf-note";
    note.textContent = "Saving…";
    try {
      await fn();
      note.className = "pf-note ok";
      note.textContent = "Saved ✓";
    } catch (e) {
      note.className = "pf-note err";
      note.textContent = e.message || "Couldn't save.";
    } finally {
      button.disabled = false;
    }
  }

  // ---------- section status ----------
  const wanted = (id) => id === "general" || INTEREST_FOR[id].some((i) => data.member.content_interests.includes(i));
  const missingFor = (id) => data.missing.filter((m) =>
    id === "general" ? GENERAL_MISSING.includes(m) : MISSING_MATCH[id].test(m));

  function statusOf(id) {
    const left = missingFor(id).length;
    if (left) return { kind: "todo", text: `${left} thing${left > 1 ? "s" : ""} left` };
    if (wanted(id)) return { kind: "done", text: "Complete" };
    return { kind: "opt", text: "Optional" };
  }

  function refreshStatus() {
    // progress card
    const needed = SECTIONS.filter((s) => wanted(s.id));
    const done = needed.filter((s) => statusOf(s.id).kind === "done");
    const optional = SECTIONS.filter((s) => !wanted(s.id)).map((s) => s.name);
    const box = $("progress");
    const head = el("div", "pf-progress-head");
    head.append(el("span", null, `${done.length} of ${needed.length} needed section${needed.length > 1 ? "s" : ""} done`));
    if (optional.length) head.append(el("span", null, `${optional.join(" & ")} optional`));
    const bar = el("div", "pf-bar");
    bar.setAttribute("aria-hidden", "true");
    for (const s of needed) bar.append(el("span", statusOf(s.id).kind === "done" ? "done" : ""));
    const line = data.missing.length
      ? el("p", null, `Still to do: ${data.missing.join(", ")}`)
      : el("p", "ok", data.member.form_submitted_at
        ? `Complete — first finished ${data.member.form_submitted_at.slice(0, 10)}`
        : "Complete");
    box.replaceChildren(head, bar, line);
    box.hidden = false;

    // section rail
    $("rail").replaceChildren(...SECTIONS.map((s, i) => {
      const st = statusOf(s.id);
      const a = el("a", `is-${st.kind}${s.id === current ? " is-active" : ""}`);
      a.href = `#${s.id}`;
      if (s.id === current) a.setAttribute("aria-current", "page");
      const mark = el("span", "pf-mark", st.kind === "done" ? "" : String(i + 1));
      mark.setAttribute("aria-hidden", "true");
      if (st.kind === "done") mark.append(ICON.check());
      const text = el("span", "rail-text");
      text.append(el("span", "rail-name", s.name),
        el("span", "rail-status", st.kind === "opt" ? "Optional for you" : st.text));
      a.append(mark, text);
      return a;
    }));

    // On phones the rail is a sideways chip row: keep the current chip in view.
    const active = $("rail").querySelector(".is-active");
    if (active && $("rail").scrollWidth > $("rail").clientWidth) {
      $("rail").scrollLeft = active.offsetLeft - 16;
    }

    // section headers
    for (const [id, node] of Object.entries(statusEls)) {
      const st = statusOf(id);
      node.className = `pf-status ${st.kind}`;
      node.replaceChildren();
      if (st.kind === "done") node.append(ICON.check());
      node.append(document.createTextNode(st.text));
    }
  }

  // ---------- widgets ----------
  let uid = 0;
  const nextId = (p) => `${p}-${++uid}`;

  function chips(options, selected, { multi = false, max = 0, small = false, label = (o) => o, onChange } = {}) {
    const wrap = el("div", small ? "pf-chips small" : "pf-chips");
    const name = nextId("c");
    const inputs = options.map((o) => {
      const lab = el("label", "pf-chip");
      const input = el("input");
      input.type = multi ? "checkbox" : "radio";
      input.name = name;
      input.value = o;
      input.checked = multi ? selected.includes(o) : selected === o;
      const text = label(o);
      if (text !== o) lab.title = o;
      lab.append(input, el("span", null, text));
      wrap.append(lab);
      return input;
    });
    const limit = () => {
      if (max) {
        const n = inputs.filter((i) => i.checked).length;
        for (const i of inputs) i.disabled = !i.checked && n >= max;
      }
      if (onChange) onChange(wrap.read());
    };
    wrap.addEventListener("change", limit);
    wrap.read = () => (multi
      ? inputs.filter((i) => i.checked).map((i) => i.value)
      : (inputs.find((i) => i.checked) || {}).value || "");
    limit();
    return wrap;
  }

  function segmented(options, value, { label = (o) => o, cls = "", aria } = {}) {
    const wrap = el("div", `pf-seg ${cls}`.trim());
    wrap.setAttribute("role", "radiogroup");
    if (aria) wrap.setAttribute("aria-label", aria);
    const name = nextId("s");
    const inputs = options.map((o) => {
      const lab = el("label");
      const input = el("input");
      input.type = "radio";
      input.name = name;
      input.value = o;
      input.checked = o === value;
      lab.append(input, el("span", null, label(o)));
      wrap.append(lab);
      return input;
    });
    wrap.read = () => (inputs.find((i) => i.checked) || {}).value || "";
    return wrap;
  }

  function yesNo(value, aria) {
    const s = segmented(["Yes", "No"], value ? "Yes" : "No", { aria });
    s.read = ((read) => () => read() === "Yes")(s.read);
    return s;
  }

  // "PC (Keyboard & Mouse)" -> title "PC", subtitle "Keyboard & Mouse"
  function splitLabel(o) {
    const m = /^(.*?) \((.*)\)$/.exec(o);
    return m ? [m[1], m[2]] : [o, ""];
  }

  function optionCards(options, selected, { multi = false } = {}) {
    const wrap = el("div", "pf-opts");
    const name = nextId("o");
    const inputs = options.map((o) => {
      const lab = el("label", "pf-opt");
      const input = el("input");
      input.type = multi ? "checkbox" : "radio";
      input.name = name;
      input.value = o;
      input.checked = multi ? selected.includes(o) : selected === o;
      const body = el("span", "pf-opt-body");
      const box = el("span", "pf-box");
      box.append(ICON.check());
      const [title, sub] = splitLabel(o);
      const text = el("span", "pf-opt-text");
      text.append(el("b", null, title));
      if (sub) text.append(el("span", "pf-opt-sub", sub));
      body.append(box, text);
      lab.append(input, body);
      wrap.append(lab);
      return input;
    });
    wrap.read = () => (multi
      ? inputs.filter((i) => i.checked).map((i) => i.value)
      : (inputs.find((i) => i.checked) || {}).value || "");
    return wrap;
  }

  function textInput(value, maxLength, { multiline = false, placeholder = "" } = {}) {
    const t = el(multiline ? "textarea" : "input", "pf-input");
    if (!multiline) t.type = "text";
    t.value = value || "";
    t.maxLength = maxLength;
    t.placeholder = placeholder;
    if (multiline) t.rows = 3;
    t.id = nextId("t");
    return t;
  }

  // Labelled control. Group controls (chips, cards, segmented) get a fieldset + legend.
  function field(labelText, control, { sub, subClass = "", aside, hint } = {}) {
    const isInput = /^(INPUT|TEXTAREA|SELECT)$/.test(control.tagName);
    const wrap = el(isInput ? "div" : "fieldset", "pf-field");
    const head = el(isInput ? "label" : "legend");
    const main = el("span", null, labelText);
    if (sub) main.append(el("span", `pf-sub ${subClass}`.trim(), ` · ${sub}`));
    head.append(main);
    if (aside) head.append(aside);
    if (isInput) head.htmlFor = control.id;
    wrap.append(head);
    if (hint) wrap.append(el("p", "pf-hint", hint));
    wrap.append(control);
    return wrap;
  }

  function callout(text) {
    // The note is shared with the Discord wizard, which uses a dropdown.
    text = text.replace(" in the acknowledgement dropdown", " under Acknowledgement");
    const c = el("div", "pf-callout");
    c.append(ICON.info(), el("p", null, text));
    return c;
  }

  // Save bar; marks the section dirty when anything inside `scope` changes.
  function saveBar(scope, label, onSave) {
    const bar = el("div", "pf-save");
    const note = el("span", "pf-note");
    note.setAttribute("aria-live", "polite");
    const btn = el("button", "btn primary", label);
    btn.type = "button";
    btn.onclick = () => save(btn, note, onSave);
    // Builds have their own Save button, so their edits don't dirty the section.
    const dirty = (e) => {
      if (e.target.closest(".pf-builds")) return;
      note.className = "pf-note dirty";
      note.textContent = "Unsaved changes";
    };
    scope.addEventListener("input", dirty);
    scope.addEventListener("change", dirty);
    bar.append(note, btn);
    return bar;
  }

  // One section = one page of the form.
  function sectionCard(id) {
    const s = SECTIONS.find((x) => x.id === id);
    const card = el("section", "pf-card");
    card.id = `sec-${id}`;
    card.setAttribute("aria-labelledby", `h-${id}`);
    const head = el("div", "pf-card-head");
    const h = el("h2", null, s.title);
    h.id = `h-${id}`;
    h.tabIndex = -1;
    const status = el("span");
    statusEls[id] = status;
    head.append(h, status);
    if (!wanted(id)) head.append(el("p", "pf-why", WHY_OPTIONAL[id]));
    const body = el("div", "pf-body");
    card.append(head, body);
    return { card, body };
  }

  // ---------- sections ----------
  function generalSection() {
    const m = data.member, o = data.options;
    const { card, body } = sectionCard("general");
    const ign = textInput(m.ign, 32);
    const age = chips(o.age_ranges, m.age_range);
    const region = chips(o.regions, m.region);
    const devices = optionCards(o.devices, m.devices, { multi: true });
    const interests = chips(o.content_interests, m.content_interests, {
      multi: true, label: (x) => splitLabel(x)[0],
    });
    const two = el("div", "pf-two");
    two.append(field("In-game name", ign), field("Age range", age));
    body.append(
      two,
      field("Where do you play from?", region),
      field("Devices you play on", devices, { sub: "pick all that apply" }),
      field("What do you want to play with the guild?", interests,
        { hint: "This decides which sections you need to fill in." }),
      saveBar(body, "Save general", async () => {
        await api("PATCH", "/profile", {
          ign: ign.value, region: region.read(), age_range: age.read(),
          devices: devices.read(), content_interests: interests.read(),
        });
      }),
    );
    return card;
  }

  function ackField(kind, acknowledged) {
    const c = chips(data.options[`ack_${kind}`], "");
    return field("Acknowledgement", c, acknowledged
      ? { sub: "done ✓", subClass: "ok" }
      : { sub: "pick the word the note names", subClass: "warn" });
  }
  const ackValue = (fieldEl) => fieldEl.querySelector(".pf-chips").read();

  function gvgSection() {
    const m = data.member, o = data.options;
    const { card, body } = sectionCard("gvg");
    const avail = optionCards(o.gvg_availability, m.gvg_availability);
    const voice = yesNo(m.gvg_voice, "Voice during GvG");
    const ack = ackField("gvg", m.gvg_ack_ok);
    const two = el("div", "pf-two");
    two.append(field("Join Discord voice during GvG?", voice, { sub: "mic optional" }), ack);
    body.append(
      callout(o.notes.gvg),
      field("When can you make GvG?", avail),
      two,
      saveBar(body, "Save guild war", () => api("PATCH", "/profile", {
        gvg_availability: avail.read(), gvg_voice: voice.read(),
        ...(ackValue(ack) ? { gvg_ack: ackValue(ack) } : {}),
      })),
      buildsBlock("gvg"),
    );
    return card;
  }

  function pveSection() {
    const m = data.member, o = data.options;
    const { card, body } = sectionCard("pve");
    const voice = yesNo(m.pve_voice, "Voice during PvE");
    const ack = ackField("pve", m.pve_ack_ok);
    const two = el("div", "pf-two");
    two.append(field("Join Discord voice during PvE?", voice, { sub: "mic optional" }), ack);
    body.append(
      callout(o.notes.pve),
      two,
      saveBar(body, "Save PvE", () => api("PATCH", "/profile", {
        pve_voice: voice.read(), ...(ackValue(ack) ? { pve_ack: ackValue(ack) } : {}),
      })),
      buildsBlock("pve"),
    );
    return card;
  }

  function socialSection() {
    const m = data.member, o = data.options;
    const { card, body } = sectionCard("social");
    const interests = chips(o.social_interests, m.social_interests, {
      multi: true, label: (x) => splitLabel(x)[0],
    });
    const voice = yesNo(m.social_voice, "Voice for social activities");
    const buddy = yesNo(m.social_buddy, "Buddy system");
    const wishlist = textInput(m.social_wishlist, 300, { multiline: true });
    const rates = el("div", "pf-rates");
    const read = {};
    for (const a of o.social_activities) {
      const key = `social_rating_${a.key}`;
      const row = el("div", "pf-rate");
      const seg = segmented(o.social_ratings, m[key], { aria: a.label });
      row.append(el("span", null, a.label), seg);
      read[key] = seg.read;
      rates.append(row);
    }
    const ratesField = el("fieldset", "pf-field");
    const legend = el("legend");
    legend.append(el("span", null, "How do you feel about these events?"));
    ratesField.append(legend, rates);
    const two = el("div", "pf-two");
    two.append(field("Join Discord voice for social activities?", voice),
      field("Interested in the buddy system?", buddy));
    body.append(
      callout(o.notes.social),
      field("Your in-game interests", interests),
      two,
      ratesField,
      field("Activities you hope to see", wishlist),
      saveBar(body, "Save social", () => api("PATCH", "/profile", {
        social_interests: interests.read(), social_voice: voice.read(),
        social_buddy: buddy.read(), social_wishlist: wishlist.value,
        ...Object.fromEntries(Object.entries(read).map(([k, f]) => [k, f()])),
      })),
    );
    return card;
  }

  // ---------- builds ----------
  const CAT_LABEL = { gvg: "Guild War build", pve: "PvE build" };

  function weaponsOf(b) {
    return b.category === "gvg" ? [b.weapon_1, b.weapon_2] : [b.pve_weapon_1, b.pve_weapon_2];
  }
  function buildTitle(b) {
    const w = weaponsOf(b).filter(Boolean).join(" + ");
    return b.label || w || "New build";
  }
  function buildDetail(b) {
    const arts = [...new Set(weaponsOf(b).map((w) => data.options.weapon_martial_art[w]).filter(Boolean))];
    const parts = [];
    if (b.label && weaponsOf(b).some(Boolean)) parts.push(weaponsOf(b).filter(Boolean).join(" + "));
    if (arts.length) parts.push(arts.join(" / "));
    parts.push(`${b.inner_ways.length} of ${data.options.inner_way_max} inner ways`);
    if (b.category === "gvg") parts.push(`${b.mystic_skills.length} mystic skill${b.mystic_skills.length === 1 ? "" : "s"}`);
    else parts.push(`${b.screenshots.length} of ${data.options.screenshot_kinds.length} screenshots`);
    return parts.join(" · ");
  }

  function buildsBlock(cat) {
    const wrap = el("div", "pf-builds");
    wrap.dataset.cat = cat;
    fillBuilds(wrap, cat);
    return wrap;
  }

  function fillBuilds(wrap, cat) {
    const builds = data.builds.filter((b) => b.category === cat);
    const head = el("div", "pf-builds-head");
    head.append(el("h3", null, `Your ${cat === "gvg" ? "GvG" : "PvE"} builds`),
      builds.length
        ? el("span", "pf-note", `${builds.length} build${builds.length > 1 ? "s" : ""}`)
        : el("span", "pf-note todo", "Add at least one"));
    wrap.replaceChildren(head);
    for (const b of builds) wrap.append(b.id === editing ? buildEditor(b) : buildRow(b));

    const add = el("button", "btn add");
    add.type = "button";
    add.append(ICON.plus(), document.createTextNode(`Add a ${cat === "gvg" ? "GvG" : "PvE"} build`));
    const note = el("span", "pf-note");
    add.onclick = () => save(add, note, async () => {
      const before = new Set(data.builds.map((b) => b.id));
      await api("POST", "/profile/builds", { category: cat });
      const fresh = data.builds.find((b) => !before.has(b.id));
      editing = fresh ? fresh.id : null;
      fillBuilds(wrap, cat);
    });
    wrap.append(add, note);
  }

  function refreshBuilds(cat) {
    const wrap = document.querySelector(`.pf-builds[data-cat="${cat}"]`);
    if (wrap) fillBuilds(wrap, cat);
  }

  function buildRow(b) {
    const row = el("div", "pf-build-row");
    if (b.is_main) {
      const tag = el("span", "pf-main-tag");
      tag.append(ICON.star(), document.createTextNode("Main"));
      row.append(tag);
    }
    const info = el("div", "pf-build-info");
    info.append(el("b", null, buildTitle(b)), el("span", null, buildDetail(b)));
    const edit = el("button", "btn secondary", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit ${buildTitle(b)}`);
    edit.onclick = () => { editing = b.id; refreshBuilds(b.category); };
    row.append(info, edit);
    return row;
  }

  function weaponSelect(value) {
    const s = el("select", "pf-input");
    s.id = nextId("w");
    s.append(new Option("— none —", ""));
    for (const w of data.options.weapons) s.append(new Option(w, w, false, w === value));
    return s;
  }

  function innerWaySelect(value, label) {
    const s = el("select", "pf-input");
    s.setAttribute("aria-label", label);
    s.append(new Option("— pick an inner way —", ""));
    for (const [art, ways] of Object.entries(data.options.martial_arts)) {
      const g = el("optgroup");
      g.label = art;
      for (const w of ways) g.append(new Option(w, w, false, w === value));
      s.append(g);
    }
    return s;
  }

  function buildEditor(b) {
    const o = data.options;
    const ed = el("div", "pf-editor");
    ed.setAttribute("role", "group");
    ed.setAttribute("aria-label", `Edit ${buildTitle(b)}`);

    // header: what it is + main toggle
    const head = el("div", "pf-editor-head");
    const titles = el("div");
    const h = el("h4", null, buildTitle(b));
    titles.append(el("p", "eyebrow", CAT_LABEL[b.category]), h);
    const main = el("button", "btn secondary pf-main-toggle");
    main.type = "button";
    main.setAttribute("aria-pressed", String(b.is_main));
    main.append(ICON.star(), document.createTextNode(b.is_main ? "Main build" : "Set as main"));
    const note = el("span", "pf-note");
    note.setAttribute("aria-live", "polite");
    if (!b.is_main) {
      main.onclick = () => save(main, note, async () => {
        await api("POST", `/profile/builds/${b.id}/main`);
        refreshBuilds(b.category);
      });
    }
    head.append(titles, main);

    const label = textInput(b.label, 60, { placeholder: "e.g. Tank, DPS" });

    // weapons with their martial art tag
    const w1Key = b.category === "gvg" ? "weapon_1" : "pve_weapon_1";
    const w2Key = b.category === "gvg" ? "weapon_2" : "pve_weapon_2";
    const w1 = weaponSelect(b[w1Key]), w2 = weaponSelect(b[w2Key]);
    const weaponBox = (sel, name) => {
      const box = el("div", "pf-weapon");
      const lab = el("label", null, name);
      lab.htmlFor = sel.id;
      lab.className = "pf-sub";
      const art = el("span", "pf-art");
      const upd = () => { art.textContent = o.weapon_martial_art[sel.value] || ""; };
      sel.addEventListener("change", upd);
      upd();
      box.append(lab, sel, art);
      return box;
    };
    const weapons = el("div", "pf-two");
    weapons.append(weaponBox(w1, "Weapon 1"), weaponBox(w2, "Weapon 2"));
    const warn = el("p", "pf-warn");
    const checkArts = () => {
      const a1 = o.weapon_martial_art[w1.value], a2 = o.weapon_martial_art[w2.value];
      warn.textContent = b.category === "pve" && a1 && a2 && a1 !== a2
        ? `${w1.value} (${a1}) and ${w2.value} (${a2}) are different martial arts. PvE builds should use one.`
        : "";
    };
    w1.addEventListener("change", checkArts);
    w2.addEventListener("change", checkArts);
    checkArts();
    const weaponsField = el("fieldset", "pf-field");
    const wl = el("legend");
    wl.append(el("span", null, "Weapons"));
    weaponsField.append(wl, weapons, warn, el("p", "pf-hint", b.category === "gvg"
      ? "GvG can mix martial arts across the two weapons."
      : "PvE builds should use the same martial art for both weapons."));

    // inner ways: slot select + tier segmented
    const iwCount = el("span", "pf-sub");
    const iw = el("div", "pf-iw");
    const slots = [];
    const countIw = () => { iwCount.textContent = `${slots.filter((s) => s.way.value).length} of ${o.inner_way_max}`; };
    for (let i = 0; i < o.inner_way_max; i++) {
      const cur = b.inner_ways[i] || { way: "", tier: "" };
      const way = innerWaySelect(cur.way, `Inner way ${i + 1}`);
      const tier = segmented(o.inner_way_tiers, cur.tier, {
        cls: "tiers", label: (t) => `T${t}`, aria: `Inner way ${i + 1} tier`,
      });
      way.addEventListener("change", countIw);
      const row = el("div", "pf-iw-row");
      row.append(el("span", "n", `#${i + 1}`), way, tier);
      iw.append(row);
      slots.push({ way, tier });
    }
    countIw();
    const iwField = el("fieldset", "pf-field");
    const iwl = el("legend");
    iwl.append(el("span", null, "Inner ways"), iwCount);
    iwField.append(iwl, iw);

    const parts = [head, field("Build name", label, { sub: "optional" }), weaponsField];

    let willing = null, mystic = null;
    if (b.category === "gvg") {
      willing = segmented(o.willing_to_change, b.willing_to_change, { aria: "Willing to change build" });
      parts.push(field("Willing to change build if the guild needs it?", willing));
    }
    parts.push(iwField);
    if (b.category === "gvg") {
      const count = el("span", "pf-sub");
      mystic = chips(o.mystic_skills, b.mystic_skills, {
        multi: true, max: o.mystic_max, small: true,
        onChange: (v) => { count.textContent = `${v.length} of ${o.mystic_max}`; },
      });
      const mf = el("fieldset", "pf-field");
      const ml = el("legend");
      ml.append(el("span", null, "Mystic skills"), count);
      mf.append(ml, mystic);
      parts.push(mf);
    }
    const other = textInput(b.other_inner_ways, 200, { placeholder: "e.g. Bitter Seasons T6" });
    parts.push(field("Other notable inner ways", other));
    if (b.category === "pve") {
      const have = o.screenshot_kinds.map((k) => `${k.replace(/_/g, " ")} ${b.screenshots.includes(k) ? "✓" : "—"}`);
      parts.push(el("p", "pf-hint", `Screenshots: ${have.join(" · ")}. Upload them in Discord with /profile screenshot.`));
    }

    // footer
    const bar = el("div", "pf-save");
    const del = el("button", "btn danger-text", "Delete build");
    del.type = "button";
    del.onclick = () => {
      if (!confirm("Delete this build and its screenshots? This can't be undone.")) return;
      save(del, note, async () => {
        await api("DELETE", `/profile/builds/${b.id}`);
        editing = null;
        refreshBuilds(b.category);
      });
    };
    const cancel = el("button", "btn secondary", "Close");
    cancel.type = "button";
    cancel.onclick = () => { editing = null; refreshBuilds(b.category); };
    const saveBtn = el("button", "btn primary", "Save build");
    saveBtn.type = "button";
    saveBtn.onclick = () => save(saveBtn, note, async () => {
      const body = {
        label: label.value, [w1Key]: w1.value, [w2Key]: w2.value,
        other_inner_ways: other.value,
        inner_ways: slots.filter((s) => s.way.value).map((s) => ({ way: s.way.value, tier: s.tier.read() })),
      };
      if (willing) body.willing_to_change = willing.read();
      if (mystic) body.mystic_skills = mystic.read();
      await api("PATCH", `/profile/builds/${b.id}`, body);
      const fresh = data.builds.find((x) => x.id === b.id);
      if (fresh) h.textContent = buildTitle(fresh);
    });
    bar.append(del, note, cancel, saveBtn);
    const dirty = () => { note.className = "pf-note dirty"; note.textContent = "Unsaved changes"; };
    ed.addEventListener("input", dirty);
    ed.addEventListener("change", dirty);

    ed.append(...parts, bar);
    return ed;
  }

  // ---------- pages ----------
  const BUILDERS = { general: generalSection, gvg: gvgSection, pve: pveSection, social: socialSection };
  const hasUnsaved = () => !!document.querySelector("#profile .pf-note.dirty");

  // Start on the first needed section with something left to do.
  function defaultSection() {
    const todo = SECTIONS.find((s) => wanted(s.id) && statusOf(s.id).kind === "todo");
    return (todo || SECTIONS[0]).id;
  }

  function pager(id) {
    const i = SECTIONS.findIndex((s) => s.id === id);
    const nav = el("nav", "pf-pager");
    nav.setAttribute("aria-label", "Section pages");
    const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
    const link = (s, dir) => {
      const a = el("a", `btn ${dir === "next" ? "primary" : "secondary"}`);
      a.href = `#${s.id}`;
      a.textContent = dir === "next" ? `Next: ${s.name} →` : `← ${s.name}`;
      return a;
    };
    nav.append(prev ? link(prev, "prev") : el("span"),
      el("span", "pf-note", `Page ${i + 1} of ${SECTIONS.length}`),
      next ? link(next, "next") : el("span"));
    return nav;
  }

  function showSection(id, { focus = false } = {}) {
    current = id;
    editing = null;
    for (const k of Object.keys(statusEls)) delete statusEls[k];
    $("profile").replaceChildren(BUILDERS[id](), pager(id));
    refreshStatus();
    if (focus) {
      if ($("layout").getBoundingClientRect().top < 0) $("layout").scrollIntoView({ block: "start" });
      $(`h-${id}`).focus({ preventScroll: true });
    }
  }

  // The URL hash picks the page, so Back/Forward and shared links work.
  function onHashChange() {
    const id = location.hash.slice(1);
    if (!BUILDERS[id] || id === current) return;
    if (hasUnsaved() && !confirm("You have unsaved changes in this section. Leave without saving?")) {
      history.replaceState(null, "", `#${current}`);
      return;
    }
    showSection(id, { focus: true });
  }
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; }
  });

  function showMessage(kind, ...parts) {
    const box = $("status");
    box.className = `card ${kind}`.trim();
    box.replaceChildren(...parts);
    box.hidden = false;
    $("layout").hidden = true;
    $("progress").hidden = true;
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
      $("status").hidden = true;
      $("layout").hidden = false;
      const fromUrl = location.hash.slice(1);
      const first = BUILDERS[fromUrl] ? fromUrl : defaultSection();
      history.replaceState(null, "", `#${first}`);
      showSection(first);
    } catch (e) {
      if (WWMAuth.token()) showMessage("warn", el("span", null, e.message === "Failed to fetch"
        ? "Couldn't reach the guild bot. It may be restarting, so try again in a minute."
        : e.message));
    }
  }

  boot();
})();
