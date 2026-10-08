// Officer table of every member's answers: sort by any column, filter by the
// common questions, search across everything. Uses the same officer-only
// roster data as roster.js; the bot refuses it to everyone else.
//
// Filters and sort live in the URL (?interest=...&sort=...), so a view such as
// "everyone interested in Guild War" can be shared as a link. Which columns
// are shown is a per-viewer preference kept in localStorage.
import { $, el } from "../core/dom.js?v=202610080831";
import { botApi } from "../core/api.js?v=202610080831";
import { memberPage, showOfficerLinks } from "../core/shell.js?v=202610080831";
import { hasStatus, mainBuild, memberStatus, shortLabel } from "../core/guild.js?v=202610080831";

const COLUMNS_KEY = "wwm.responses.columns";
const list = (a) => (a || []).map(shortLabel).join(", ");
const yn = (b) => (b ? "Yes" : "No");
const buildText = (b) => (b ? b.summary.replace("★ ", "") : "");

// One entry per column. `value` is the shown/searched text; `sort` (optional)
// gives a different sort key; `show` is the default visibility.
const COLUMNS = [
  { key: "member", label: "Member", show: true, fixed: true, value: (m) => m.ign || m.name || `#${m.discord_id}` },
  { key: "discord", label: "Discord name", show: false, value: (m) => m.name },
  { key: "region", label: "Region", show: true, value: (m) => m.region },
  { key: "age", label: "Age range", show: false, value: (m) => m.age_range },
  { key: "devices", label: "Devices", show: true, value: (m) => list(m.devices) },
  { key: "interests", label: "Interests", show: true, value: (m) => list(m.content_interests) },
  { key: "gvg_availability", label: "GvG availability", show: true, value: (m) => m.gvg_availability },
  { key: "gvg_voice", label: "GvG voice", show: true, value: (m) => yn(m.gvg_voice) },
  { key: "gvg_ack", label: "GvG rules", show: false, value: (m) => (m.gvg_ack_ok ? "Acknowledged" : "") },
  { key: "gvg_build", label: "Main GvG build", show: true, value: (m) => buildText(mainBuild(m, "gvg")) },
  { key: "pve_voice", label: "PvE voice", show: false, value: (m) => yn(m.pve_voice) },
  { key: "pve_ack", label: "PvE rules", show: false, value: (m) => (m.pve_ack_ok ? "Acknowledged" : "") },
  { key: "pve_build", label: "Main PvE build", show: true, value: (m) => buildText(mainBuild(m, "pve")) },
  { key: "social_interests", label: "Social interests", show: false, value: (m) => list(m.social_interests) },
  { key: "social_voice", label: "Social voice", show: false, value: (m) => yn(m.social_voice) },
  { key: "buddy", label: "Buddy system", show: false, value: (m) => yn(m.social_buddy) },
  { key: "wishlist", label: "Wishlist", show: false, value: (m) => m.social_wishlist },
  { key: "power", label: "Combat power", show: false, numeric: true,
    value: (m) => (m.combat_power == null ? "" : String(m.combat_power)), sort: (m) => m.combat_power },
  { key: "status", label: "Status", show: true, value: (m) => memberStatus(m).text, sort: (m) => memberStatus(m).rank },
  { key: "updated", label: "Updated", show: true, value: (m) => (m.updated_at || "").slice(0, 10) },
];
const COLUMN = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

// Dropdown filters: URL param, label, options from the payload, and the test.
const FILTERS = [
  { param: "interest", label: "Any interest", options: (o) => o.content_interests, short: true,
    test: (m, v) => m.content_interests.includes(v) },
  { param: "region", label: "Any region", options: (o) => o.regions, test: (m, v) => m.region === v },
  { param: "avail", label: "Any GvG availability", options: (o) => o.gvg_availability,
    test: (m, v) => m.gvg_availability === v },
  { param: "status", label: "Any status", test: (m, v) => hasStatus(m, v),
    choices: [["todo", "Incomplete"], ["done", "Complete"], ["gone", "Left server"]] },
];

let data = null; // { members, options }
const state = { q: "", filters: {}, sort: "member", dir: "asc", columns: new Set() };

const page = memberPage({
  loginText: "Log in with Discord to see member responses.",
  onMessage: () => { $("tools").hidden = true; $("table-wrap").hidden = true; $("count").textContent = ""; },
});

// ---------- state <-> URL / storage ----------
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get("q") || "";
  for (const f of FILTERS) state.filters[f.param] = p.get(f.param) || "";
  state.sort = COLUMN[p.get("sort")] ? p.get("sort") : "member";
  state.dir = p.get("dir") === "desc" ? "desc" : "asc";
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  for (const [k, v] of Object.entries(state.filters)) if (v) p.set(k, v);
  if (state.sort !== "member") p.set("sort", state.sort);
  if (state.dir === "desc") p.set("dir", "desc");
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
}

function loadColumns() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(COLUMNS_KEY)); } catch { /* ignore */ }
  const keys = Array.isArray(saved) ? saved.filter((k) => COLUMN[k]) : COLUMNS.filter((c) => c.show).map((c) => c.key);
  state.columns = new Set(["member", ...keys]);
}

function saveColumns() {
  try { localStorage.setItem(COLUMNS_KEY, JSON.stringify([...state.columns])); } catch { /* ignore */ }
}

// ---------- filtering + sorting ----------
function rowsToShow() {
  const q = state.q.trim().toLowerCase();
  const rows = data.members.filter((m) => {
    for (const f of FILTERS) {
      const v = state.filters[f.param];
      if (v && !f.test(m, v)) return false;
    }
    if (!q) return true;
    return COLUMNS.some((c) => (c.value(m) || "").toLowerCase().includes(q));
  });

  const col = COLUMN[state.sort];
  const key = col.sort || col.value;
  const dir = state.dir === "desc" ? -1 : 1;
  const empty = (v) => v == null || v === "";
  return rows.sort((a, b) => {
    const x = key(a), y = key(b);
    if (empty(x) || empty(y)) return empty(x) - empty(y); // blanks last either way
    const cmp = typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
    return cmp * dir;
  });
}

// ---------- rendering ----------
function headerCell(col) {
  const th = el("th");
  th.scope = "col";
  const active = state.sort === col.key;
  th.setAttribute("aria-sort", active ? (state.dir === "asc" ? "ascending" : "descending") : "none");
  const b = el("button", "sort", col.label);
  b.type = "button";
  b.append(el("span", "arrow", active ? (state.dir === "asc" ? "▲" : "▼") : ""));
  b.onclick = () => {
    state.dir = active && state.dir === "asc" ? "desc" : "asc";
    state.sort = col.key;
    writeUrl();
    renderTable();
  };
  th.append(b);
  if (col.numeric) th.classList.add("num");
  return th;
}

function cell(col, m) {
  if (col.key === "member") {
    const th = el("th");
    th.scope = "row";
    th.append(el("span", "name", col.value(m)));
    if (m.ign && m.name) th.append(el("span", "sub", m.name));
    return th;
  }
  const td = el("td");
  if (col.numeric) td.classList.add("num");
  if (col.key === "status") {
    const st = memberStatus(m);
    td.append(el("span", `pill-tag ${st.kind}`, st.text));
    if (m.missing.length) td.title = `Still to do: ${m.missing.join(", ")}`;
    return td;
  }
  const v = col.value(m);
  td.textContent = v || "—";
  if (!v) td.classList.add("blank");
  return td;
}

function renderTable() {
  const cols = COLUMNS.filter((c) => state.columns.has(c.key));
  const rows = rowsToShow();
  $("count").textContent = `Showing ${rows.length} of ${data.members.length} members`;

  const head = el("tr");
  head.append(...cols.map(headerCell));
  const body = rows.map((m) => {
    const tr = el("tr");
    tr.append(...cols.map((c) => cell(c, m)));
    return tr;
  });
  if (!rows.length) {
    const tr = el("tr");
    const td = el("td", "empty", "No members match these filters.");
    td.colSpan = cols.length;
    tr.append(td);
    body.push(tr);
  }
  $("thead").replaceChildren(head);
  $("tbody").replaceChildren(...body);
}

function filterSelect(f) {
  const s = el("select");
  s.setAttribute("aria-label", f.label);
  s.append(new Option(f.label, ""));
  const choices = f.choices || f.options(data.options).map((o) => [o, f.short ? shortLabel(o) : o]);
  for (const [value, label] of choices) s.append(new Option(label, value, false, value === state.filters[f.param]));
  s.onchange = () => { state.filters[f.param] = s.value; writeUrl(); renderTable(); };
  return s;
}

function columnPicker() {
  const menu = el("details", "columns");
  const sum = el("summary", "btn secondary", "Columns");
  const box = el("fieldset");
  box.append(el("legend", "sr-only", "Columns to show"));
  for (const c of COLUMNS) {
    const lab = el("label");
    const input = el("input");
    input.type = "checkbox";
    input.checked = state.columns.has(c.key);
    input.disabled = !!c.fixed;
    input.onchange = () => {
      if (input.checked) state.columns.add(c.key); else state.columns.delete(c.key);
      saveColumns();
      renderTable();
    };
    lab.append(input, document.createTextNode(` ${c.label}`));
    box.append(lab);
  }
  menu.append(sum, box);
  return menu;
}

function renderTools() {
  const search = el("input");
  search.type = "search";
  search.placeholder = "Search any answer";
  search.setAttribute("aria-label", "Search any answer");
  search.value = state.q;
  search.oninput = () => { state.q = search.value; writeUrl(); renderTable(); };

  const reset = el("button", "btn ghost", "Reset");
  reset.type = "button";
  reset.onclick = () => {
    history.replaceState(null, "", location.pathname);
    readUrl();
    renderTools();
    renderTable();
  };
  $("tools").replaceChildren(search, ...FILTERS.map(filterSelect), columnPicker(), reset);
  $("tools").hidden = false;
}

// The column menu closes when clicking anywhere else.
document.addEventListener("click", (e) => {
  const menu = document.querySelector(".columns");
  if (menu && !menu.contains(e.target)) menu.open = false;
});

// ---------- boot ----------
async function boot() {
  const tok = page.start();
  if (!tok) return;
  page.message("", el("span", "muted", "Loading responses…"));
  try {
    data = await botApi(tok).roster();
  } catch (err) {
    if (err.status === 403) {
      const link = el("a", null, "Go to your own profile");
      link.href = "profile.html";
      page.message("warn", el("p", null, err.message), link);
    } else {
      page.fail(err);
    }
    return;
  }
  showOfficerLinks(true);
  page.hideMessage();
  readUrl();
  loadColumns();
  renderTools();
  $("table-wrap").hidden = false;
  renderTable();
}

boot();
