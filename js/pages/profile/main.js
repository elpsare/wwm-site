// Profile page controller: loads the member's profile, shows one section per
// page (chosen by the URL hash), and keeps the progress UI in sync.
//
//   model.js     sections + completion rules (no DOM)
//   widgets.js   form controls and save helpers
//   sections.js  the four section pages
//   builds.js    build list + inline editor
//   progress.js  progress card, section rail, header status
import { $, el } from "../../core/dom.js?v=202610080831";
import { botApi } from "../../core/api.js?v=202610080831";
import { memberPage, showOfficerLinks } from "../../core/shell.js?v=202610080831";
import { SECTIONS, defaultSection } from "./model.js?v=202610080831";
import { SECTION_VIEWS } from "./sections.js?v=202610080831";
import { renderProgress } from "./progress.js?v=202610080831";
import { hasUnsavedIn } from "./widgets.js?v=202610080831";

const page = memberPage({
  loginText: "Log in with Discord to see and edit your profile.",
  onMessage: () => {
    $("layout").hidden = true;
    $("progress").hidden = true;
  },
});

// Shared state for the section views.
const ctx = {
  api: null,      // botApi(token)
  data: null,     // last profile payload: { user, member, builds, missing, options }
  current: null,  // id of the section on screen
  editing: null,  // id of the build whose editor is open
  // Awaits an API call that returns the profile, stores it and refreshes the
  // progress UI. An expired login drops back to the "log in" message.
  async send(call) {
    try {
      ctx.data = await call;
    } catch (err) {
      if (err.status === 401) page.loggedOut(err.message);
      throw err;
    }
    renderProgress(ctx);
    return ctx.data;
  },
};

// ---------- pages ----------
function pager(id) {
  const i = SECTIONS.findIndex((s) => s.id === id);
  const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
  const link = (s, isNext) => {
    const a = el("a", `btn ${isNext ? "primary" : "secondary"}`, isNext ? `Next: ${s.name} →` : `← ${s.name}`);
    a.href = `#${s.id}`;
    return a;
  };
  const nav = el("nav", "pf-pager");
  nav.setAttribute("aria-label", "Section pages");
  nav.append(prev ? link(prev, false) : el("span"),
    el("span", "pf-note", `Page ${i + 1} of ${SECTIONS.length}`),
    next ? link(next, true) : el("span"));
  return nav;
}

function showSection(id, { focus = false } = {}) {
  ctx.current = id;
  ctx.editing = null;
  $("profile").replaceChildren(SECTION_VIEWS[id](ctx), pager(id));
  renderProgress(ctx);
  if (focus) {
    if ($("layout").getBoundingClientRect().top < 0) $("layout").scrollIntoView({ block: "start" });
    $(`h-${id}`).focus({ preventScroll: true });
  }
}

const hasUnsaved = () => hasUnsavedIn($("profile"));

// The URL hash picks the page, so Back/Forward and shared links work.
window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (!ctx.data || !SECTION_VIEWS[id] || id === ctx.current) return;
  if (hasUnsaved() && !confirm("You have unsaved changes in this section. Leave without saving?")) {
    history.replaceState(null, "", `#${ctx.current}`);
    return;
  }
  showSection(id, { focus: true });
});

window.addEventListener("beforeunload", (e) => {
  if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- boot ----------
async function boot() {
  const tok = page.start();
  if (!tok) return;
  ctx.api = botApi(tok);
  page.message("", el("span", "muted", "Loading your profile…"));
  try {
    ctx.data = await ctx.api.profile();
  } catch (err) {
    page.fail(err);
    return;
  }
  showOfficerLinks(ctx.data.user.officer);
  page.hideMessage();
  $("layout").hidden = false;
  const fromUrl = location.hash.slice(1);
  const first = SECTION_VIEWS[fromUrl] ? fromUrl : defaultSection(ctx.data);
  history.replaceState(null, "", `#${first}`);
  showSection(first);
}

boot();
