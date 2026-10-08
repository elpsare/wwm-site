// A section's builds: one summary row per build, and an inline editor for the
// one being edited (ctx.editing). Each build saves on its own.
import { el, ICON } from "../../core/dom.js?v=202610080831";
import { martialArtsOf, plural, screenshotSummary, weaponKeys, weaponsOf } from "../../core/guild.js?v=202610080831";
import {
  button, chips, field, liveNote, runSave, segmented, select, textInput, trackDirty, twoColumns,
} from "./widgets.js?v=202610080831";

const CATEGORY = {
  gvg: { short: "GvG", eyebrow: "Guild War build" },
  pve: { short: "PvE", eyebrow: "PvE build" },
};

function buildTitle(b) {
  return b.label || weaponsOf(b).filter(Boolean).join(" + ") || "New build";
}

function buildDetail(b, options) {
  const parts = [];
  if (b.label && weaponsOf(b).some(Boolean)) parts.push(weaponsOf(b).filter(Boolean).join(" + "));
  const arts = martialArtsOf(b, options);
  if (arts.length) parts.push(arts.join(" / "));
  parts.push(`${b.inner_ways.length} of ${options.inner_way_max} inner ways`);
  parts.push(b.category === "gvg"
    ? plural(b.mystic_skills.length, "mystic skill")
    : `${b.screenshots.length} of ${options.screenshot_kinds.length} screenshots`);
  return parts.join(" · ");
}

// The builds area for one category; redraws itself after changes.
export function buildsBlock(ctx, cat) {
  const wrap = el("div", "pf-builds");
  const redraw = () => fill(ctx, wrap, cat, redraw);
  redraw();
  return wrap;
}

function fill(ctx, wrap, cat, redraw) {
  const builds = ctx.data.builds.filter((b) => b.category === cat);
  const head = el("div", "pf-builds-head");
  head.append(el("h3", null, `Your ${CATEGORY[cat].short} builds`), builds.length
    ? el("span", "pf-note", plural(builds.length, "build"))
    : el("span", "pf-note todo", "Add at least one"));
  wrap.replaceChildren(head);
  for (const b of builds) {
    wrap.append(b.id === ctx.editing ? buildEditor(ctx, b, redraw) : buildRow(ctx, b, redraw));
  }

  const note = liveNote();
  const add = button("", "add", () => runSave(add, note, async () => {
    const before = new Set(ctx.data.builds.map((b) => b.id));
    await ctx.send(ctx.api.addBuild(cat));
    const created = ctx.data.builds.find((b) => !before.has(b.id));
    ctx.editing = created ? created.id : null;
    redraw();
  }));
  add.append(ICON.plus(), document.createTextNode(`Add a ${CATEGORY[cat].short} build`));
  wrap.append(add, note);
}

function buildRow(ctx, b, redraw) {
  const row = el("div", "pf-build-row");
  if (b.is_main) {
    const tag = el("span", "pf-main-tag");
    tag.append(ICON.star(), document.createTextNode("Main"));
    row.append(tag);
  }
  const info = el("div", "pf-build-info");
  info.append(el("b", null, buildTitle(b)), el("span", null, buildDetail(b, ctx.data.options)));
  const edit = button("Edit", "secondary", () => { ctx.editing = b.id; redraw(); });
  edit.setAttribute("aria-label", `Edit ${buildTitle(b)}`);
  row.append(info, edit);
  return row;
}

// ---------- editor ----------
function weaponsField(b, options) {
  const [k1, k2] = weaponKeys(b.category);
  const box = (key, name) => {
    const sel = select({ options: options.weapons, value: b[key], empty: "— none —" });
    const lab = el("label", "pf-sub", name);
    lab.htmlFor = sel.id;
    const art = el("span", "pf-art");
    const showArt = () => { art.textContent = options.weapon_martial_art[sel.value] || ""; };
    sel.addEventListener("change", showArt);
    showArt();
    const col = el("div", "pf-weapon");
    col.append(lab, sel, art);
    return { col, sel };
  };
  const w1 = box(k1, "Weapon 1"), w2 = box(k2, "Weapon 2");

  // PvE builds should keep both weapons in one martial art.
  const warn = el("p", "pf-warn");
  const checkArts = () => {
    const a1 = options.weapon_martial_art[w1.sel.value], a2 = options.weapon_martial_art[w2.sel.value];
    warn.textContent = b.category === "pve" && a1 && a2 && a1 !== a2
      ? `${w1.sel.value} (${a1}) and ${w2.sel.value} (${a2}) are different martial arts. PvE builds should use one.`
      : "";
  };
  w1.sel.addEventListener("change", checkArts);
  w2.sel.addEventListener("change", checkArts);
  checkArts();

  const hint = el("p", "pf-hint", b.category === "gvg"
    ? "GvG can mix martial arts across the two weapons."
    : "PvE builds should use the same martial art for both weapons.");
  const group = el("div", "pf-stack");
  group.append(twoColumns(w1.col, w2.col), warn, hint);
  return {
    node: field("Weapons", group),
    read: () => ({ [k1]: w1.sel.value, [k2]: w2.sel.value }),
  };
}

function innerWaysField(b, options) {
  const count = el("span", "pf-sub");
  const list = el("div", "pf-iw");
  const slots = [];
  const recount = () => { count.textContent = `${slots.filter((s) => s.way.value).length} of ${options.inner_way_max}`; };
  for (let i = 0; i < options.inner_way_max; i++) {
    const cur = b.inner_ways[i] || { way: "", tier: "" };
    const way = select({
      groups: options.martial_arts, value: cur.way, empty: "— pick an inner way —", aria: `Inner way ${i + 1}`,
    });
    const tier = segmented(options.inner_way_tiers, cur.tier, {
      cls: "tiers", label: (t) => `T${t}`, aria: `Inner way ${i + 1} tier`,
    });
    way.addEventListener("change", recount);
    const row = el("div", "pf-iw-row");
    row.append(el("span", "n", `#${i + 1}`), way, tier);
    list.append(row);
    slots.push({ way, tier });
  }
  recount();
  return {
    node: field("Inner ways", list, { aside: count }),
    read: () => slots.filter((s) => s.way.value).map((s) => ({ way: s.way.value, tier: s.tier.read() })),
  };
}

function mysticField(b, options) {
  const count = el("span", "pf-sub");
  const picker = chips(options.mystic_skills, b.mystic_skills, {
    multi: true, max: options.mystic_max, small: true,
    onChange: (v) => { count.textContent = `${v.length} of ${options.mystic_max}`; },
  });
  return { node: field("Mystic skills", picker, { aside: count }), read: picker.read };
}

function buildEditor(ctx, b, redraw) {
  const options = ctx.data.options;
  const ed = el("div", "pf-editor");
  ed.setAttribute("role", "group");
  ed.setAttribute("aria-label", `Edit ${buildTitle(b)}`);
  const note = liveNote();

  // header: what it is + main toggle
  const heading = el("h4", null, buildTitle(b));
  const titles = el("div");
  titles.append(el("p", "eyebrow", CATEGORY[b.category].eyebrow), heading);
  const main = button("", "secondary pf-main-toggle", b.is_main ? null : () => runSave(main, note, async () => {
    await ctx.send(ctx.api.setMainBuild(b.id));
    redraw();
  }));
  main.setAttribute("aria-pressed", String(b.is_main));
  main.append(ICON.star(), document.createTextNode(b.is_main ? "Main build" : "Set as main"));
  const head = el("div", "pf-editor-head");
  head.append(titles, main);

  const label = textInput(b.label, 60, { placeholder: "e.g. Tank, DPS" });
  const weapons = weaponsField(b, options);
  const innerWays = innerWaysField(b, options);
  const other = textInput(b.other_inner_ways, 200, { placeholder: "e.g. Bitter Seasons T6" });
  const willing = b.category === "gvg"
    ? segmented(options.willing_to_change, b.willing_to_change, { aria: "Willing to change build" })
    : null;
  const mystic = b.category === "gvg" ? mysticField(b, options) : null;

  const parts = [head, field("Build name", label, { sub: "optional" }), weapons.node];
  if (willing) parts.push(field("Willing to change build if the guild needs it?", willing));
  parts.push(innerWays.node);
  if (mystic) parts.push(mystic.node);
  parts.push(field("Other notable inner ways", other));
  if (b.category === "pve") {
    parts.push(el("p", "pf-hint",
      `Screenshots: ${screenshotSummary(b, options)}. Upload them in Discord with /profile screenshot.`));
  }

  // footer
  const del = button("Delete build", "danger-text", () => {
    if (!confirm("Delete this build and its screenshots? This can't be undone.")) return;
    runSave(del, note, async () => {
      await ctx.send(ctx.api.deleteBuild(b.id));
      ctx.editing = null;
      redraw();
    });
  });
  const close = button("Close", "secondary", () => { ctx.editing = null; redraw(); });
  const save = button("Save build", "primary", () => runSave(save, note, async () => {
    const fields = {
      label: label.value,
      ...weapons.read(),
      inner_ways: innerWays.read(),
      other_inner_ways: other.value,
    };
    if (willing) fields.willing_to_change = willing.read();
    if (mystic) fields.mystic_skills = mystic.read();
    await ctx.send(ctx.api.updateBuild(b.id, fields));
    const saved = ctx.data.builds.find((x) => x.id === b.id);
    if (saved) heading.textContent = buildTitle(saved);
  }));
  const bar = el("div", "pf-save");
  bar.append(del, note, close, save);
  trackDirty(ed, note);

  ed.append(...parts, bar);
  return ed;
}
