// Officer roster: every member's profile, read-only. The bot refuses the data
// to anyone who isn't an officer.
import { $, el } from "../core/dom.js?v=202610080831";
import { botApi } from "../core/api.js?v=202610080831";
import { memberPage, showOfficerLinks } from "../core/shell.js?v=202610080831";
import {
  hasStatus, isInterestedIn, mainBuild, martialArtsOf, memberStatus, screenshotSummary, shortLabel, weaponsOf,
} from "../core/guild.js?v=202610080831";

const RATING = { Like: "👍", Neutral: "😐", Dislike: "👎" };
const list = (a) => (a && a.length ? a.map(shortLabel).join(", ") : "—");
const yn = (b) => (b ? "yes" : "no");

let data = null; // { members, options }

const page = memberPage({
  loginText: "Log in with Discord to see the roster.",
  onMessage: () => {
    $("tools").hidden = true;
    $("roster").replaceChildren();
    $("count").textContent = "";
  },
});

// ---------- one member ----------
function fact(dl, label, value) {
  dl.append(el("dt", null, label), el("dd", null, value || "—"));
}

function buildBlock(b) {
  const box = el("div", "build");
  const head = el("div", "build-head");
  head.append(el("strong", null, b.label || `${b.category.toUpperCase()} build #${b.id}`));
  if (b.is_main) head.append(el("span", "badge", "★ Main"));
  const dl = el("dl", "facts");
  const arts = martialArtsOf(b, data.options);
  fact(dl, "Weapons", weaponsOf(b).filter(Boolean).join(" + ") + (arts.length ? ` (${arts.join(" / ")})` : ""));
  fact(dl, "Inner ways", b.inner_ways.map((i) => (i.tier ? `${i.way} T${i.tier}` : i.way)).join(", "));
  if (b.other_inner_ways) fact(dl, "Also", b.other_inner_ways);
  if (b.category === "gvg") {
    fact(dl, "Mystic skills", b.mystic_skills.join(", "));
    fact(dl, "Would swap build", b.willing_to_change);
  } else {
    fact(dl, "Screenshots", screenshotSummary(b, data.options));
  }
  box.append(head, dl);
  return box;
}

function memberDetails(m) {
  const body = el("div", "member-body");
  const category = (title, dl, cat) => {
    body.append(el("h4", null, title), dl);
    if (cat) for (const b of m.builds.filter((x) => x.category === cat)) body.append(buildBlock(b));
  };

  const general = el("dl", "facts");
  fact(general, "Discord", m.name);
  fact(general, "Age range", m.age_range);
  fact(general, "Devices", list(m.devices));
  fact(general, "Interests", list(m.content_interests));
  if (m.combat_power != null) fact(general, "Combat power", String(m.combat_power));
  if (m.gear_score != null) fact(general, "Gear score", String(m.gear_score));
  fact(general, "Submitted", (m.form_submitted_at || "").slice(0, 10));
  fact(general, "Last updated", (m.updated_at || "").slice(0, 10));
  if (m.missing.length) fact(general, "Still to do", m.missing.join(", "));
  category("General", general);

  const gvg = el("dl", "facts");
  fact(gvg, "Availability", m.gvg_availability);
  fact(gvg, "Voice", yn(m.gvg_voice));
  fact(gvg, "Rules", m.gvg_ack_ok ? "acknowledged" : "not acknowledged");
  category("Guild war", gvg, "gvg");

  const pve = el("dl", "facts");
  fact(pve, "Voice", yn(m.pve_voice));
  fact(pve, "Rules", m.pve_ack_ok ? "acknowledged" : "not acknowledged");
  category("PvE", pve, "pve");

  const social = el("dl", "facts");
  fact(social, "Interests", list(m.social_interests));
  fact(social, "Voice / buddy", `${yn(m.social_voice)} / ${yn(m.social_buddy)}`);
  fact(social, "Event ratings", data.options.social_activities
    .map((a) => `${shortLabel(a.label)} ${RATING[m[`social_rating_${a.key}`]] || "—"}`).join(" · "));
  if (m.social_wishlist) fact(social, "Wishlist", m.social_wishlist);
  category("Social", social);
  return body;
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

  const glance = el("div", "glance");
  for (const [label, b] of [["GvG", mainBuild(m, "gvg")], ["PvE", mainBuild(m, "pve")]]) {
    glance.append(el("span", null, `${label}: ${b ? b.summary.replace("★ ", "") : "—"}`));
  }
  glance.prepend(el("span", null, m.region || "—"));

  const st = memberStatus(m);
  const status = el("span", `pill-tag ${st.kind}`, st.text);
  sum.append(who, glance, status);
  d.append(sum);

  // Details are built on first open - the roster can be long.
  d.addEventListener("toggle", () => {
    if (!d.open || d.dataset.filled) return;
    d.dataset.filled = "1";
    d.append(memberDetails(m));
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
  if (interest && !isInterestedIn(m.content_interests, interest)) return false;
  return hasStatus(m, $("state").value);
}

function renderList() {
  const shown = data.members.filter(matches);
  $("count").textContent = `Showing ${shown.length} of ${data.members.length} members`;
  $("roster").replaceChildren(...shown.map(memberCard));
}

function renderSummary() {
  const inGuild = data.members.filter((m) => m.in_guild);
  const done = inGuild.filter((m) => !m.missing.length).length;
  page.message("",
    el("strong", null, `${done} of ${inGuild.length} members have a complete profile.`),
    el("span", "muted", " Members who never opened the questionnaire aren't listed."));
}

// ---------- boot ----------
async function boot() {
  const tok = page.start();
  if (!tok) return;
  page.message("", el("span", "muted", "Loading the roster…"));
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
  renderSummary();
  $("tools").hidden = false;
  for (const id of ["q", "interest", "state"]) $(id).addEventListener("input", renderList);
  renderList();
}

boot();
