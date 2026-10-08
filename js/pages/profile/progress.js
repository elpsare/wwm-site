// Everything that reflects completion: the progress card, the section rail,
// and the status chip in the open section's header. Redrawn after every save.
import { $, el, ICON } from "../../core/dom.js?v=202610080737";
import { SECTIONS, isNeeded, sectionStatus } from "./model.js?v=202610080737";

function renderProgressCard(data) {
  const needed = SECTIONS.filter((s) => isNeeded(data, s.id));
  const done = needed.filter((s) => sectionStatus(data, s.id).kind === "done");
  const optional = SECTIONS.filter((s) => !isNeeded(data, s.id)).map((s) => s.name);

  const head = el("div", "pf-progress-head");
  head.append(el("span", null, `${done.length} of ${needed.length} needed section${needed.length > 1 ? "s" : ""} done`));
  if (optional.length) head.append(el("span", null, `${optional.join(" & ")} optional`));

  const bar = el("div", "pf-bar");
  bar.setAttribute("aria-hidden", "true");
  for (const s of needed) bar.append(el("span", sectionStatus(data, s.id).kind === "done" ? "done" : ""));

  const submitted = data.member.form_submitted_at;
  const line = data.missing.length
    ? el("p", null, `Still to do: ${data.missing.join(", ")}`)
    : el("p", "ok", submitted ? `Complete — first finished ${submitted.slice(0, 10)}` : "Complete");

  const box = $("progress");
  box.replaceChildren(head, bar, line);
  box.hidden = false;
}

function renderRail(data, current) {
  const rail = $("rail");
  rail.replaceChildren(...SECTIONS.map((s, i) => {
    const st = sectionStatus(data, s.id);
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
  const active = rail.querySelector(".is-active");
  if (active && rail.scrollWidth > rail.clientWidth) rail.scrollLeft = active.offsetLeft - 16;
}

// The status chip next to a section's heading.
export function renderSectionStatus(node, data, id) {
  const st = sectionStatus(data, id);
  node.className = `pf-status ${st.kind}`;
  node.replaceChildren();
  if (st.kind === "done") node.append(ICON.check());
  node.append(document.createTextNode(st.text));
}

export function renderProgress(ctx) {
  renderProgressCard(ctx.data);
  renderRail(ctx.data, ctx.current);
  const status = document.querySelector("#profile .pf-status");
  if (status && ctx.current) renderSectionStatus(status, ctx.data, ctx.current);
}
