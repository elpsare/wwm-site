// Form controls for the profile page. Each group control is a real radio or
// checkbox set (keyboard and screen readers work natively) and exposes
// `.read()` returning its current value.
import { el, nextId, ICON } from "../../core/dom.js?v=202610080737";
import { splitLabel } from "../../core/guild.js?v=202610080737";

function choiceInputs(wrap, options, isChecked, multi, render) {
  const name = nextId("g");
  return options.map((o) => {
    const input = el("input");
    input.type = multi ? "checkbox" : "radio";
    input.name = name;
    input.value = o;
    input.checked = isChecked(o);
    wrap.append(render(input, o));
    return input;
  });
}

function reader(inputs, multi) {
  return () => (multi
    ? inputs.filter((i) => i.checked).map((i) => i.value)
    : (inputs.find((i) => i.checked) || {}).value || "");
}

// Pill-shaped choices. `max` caps a multi-select; `onChange` gets the value.
export function chips(options, selected, { multi = false, max = 0, small = false, label = (o) => o, onChange } = {}) {
  const wrap = el("div", small ? "pf-chips small" : "pf-chips");
  const isChecked = (o) => (multi ? selected.includes(o) : selected === o);
  const inputs = choiceInputs(wrap, options, isChecked, multi, (input, o) => {
    const lab = el("label", "pf-chip");
    const text = label(o);
    if (text !== o) lab.title = o;
    lab.append(input, el("span", null, text));
    return lab;
  });
  wrap.read = reader(inputs, multi);
  const update = () => {
    if (max) {
      const n = inputs.filter((i) => i.checked).length;
      for (const i of inputs) i.disabled = !i.checked && n >= max;
    }
    if (onChange) onChange(wrap.read());
  };
  wrap.addEventListener("change", update);
  update();
  return wrap;
}

// Larger cards with a check box; "Title (Subtitle)" labels split over two lines.
export function optionCards(options, selected, { multi = false } = {}) {
  const wrap = el("div", "pf-opts");
  const isChecked = (o) => (multi ? selected.includes(o) : selected === o);
  const inputs = choiceInputs(wrap, options, isChecked, multi, (input, o) => {
    const lab = el("label", "pf-opt");
    const box = el("span", "pf-box");
    box.append(ICON.check());
    const [title, sub] = splitLabel(o);
    const text = el("span", "pf-opt-text");
    text.append(el("b", null, title));
    if (sub) text.append(el("span", "pf-opt-sub", sub));
    const body = el("span", "pf-opt-body");
    body.append(box, text);
    lab.append(input, body);
    return lab;
  });
  wrap.read = reader(inputs, multi);
  return wrap;
}

// A segmented single choice (Yes/No, ratings, tiers).
export function segmented(options, value, { label = (o) => o, cls = "", aria } = {}) {
  const wrap = el("div", `pf-seg ${cls}`.trim());
  wrap.setAttribute("role", "radiogroup");
  if (aria) wrap.setAttribute("aria-label", aria);
  const inputs = choiceInputs(wrap, options, (o) => o === value, false, (input, o) => {
    const lab = el("label");
    lab.append(input, el("span", null, label(o)));
    return lab;
  });
  wrap.read = reader(inputs, false);
  return wrap;
}

// Yes/No toggle whose .read() returns a boolean.
export function yesNo(value, aria) {
  const seg = segmented(["Yes", "No"], value ? "Yes" : "No", { aria });
  const read = seg.read;
  seg.read = () => read() === "Yes";
  return seg;
}

export function textInput(value, maxLength, { multiline = false, placeholder = "" } = {}) {
  const t = el(multiline ? "textarea" : "input", "pf-input");
  if (multiline) t.rows = 3;
  else t.type = "text";
  t.id = nextId("t");
  t.value = value || "";
  t.maxLength = maxLength;
  t.placeholder = placeholder;
  return t;
}

// A select with an empty first option. `groups` is { groupLabel: [values] }.
export function select({ options = [], groups = null, value = "", empty, aria }) {
  const s = el("select", "pf-input");
  s.id = nextId("sel");
  if (aria) s.setAttribute("aria-label", aria);
  s.append(new Option(empty, ""));
  const add = (parent, values) => {
    for (const v of values) parent.append(new Option(v, v, false, v === value));
  };
  if (groups) {
    for (const [label, values] of Object.entries(groups)) {
      const g = el("optgroup");
      g.label = label;
      add(g, values);
      s.append(g);
    }
  } else {
    add(s, options);
  }
  return s;
}

// Labelled control. Inputs get <label for>; groups get <fieldset><legend>.
// `aside` is shown at the legend's right (e.g. a "2 of 8" counter).
export function field(labelText, control, { sub, subClass = "", aside, hint } = {}) {
  const isInput = /^(INPUT|TEXTAREA|SELECT)$/.test(control.tagName);
  const wrap = el(isInput ? "div" : "fieldset", "pf-field");
  const head = el(isInput ? "label" : "legend");
  if (isInput) head.htmlFor = control.id;
  const main = el("span", null, labelText);
  if (sub) main.append(el("span", `pf-sub ${subClass}`.trim(), ` · ${sub}`));
  head.append(main);
  if (aside) head.append(aside);
  wrap.append(head);
  if (hint) wrap.append(el("p", "pf-hint", hint));
  wrap.append(control);
  return wrap;
}

export function twoColumns(...children) {
  const row = el("div", "pf-two");
  row.append(...children);
  return row;
}

export function callout(text) {
  const c = el("div", "pf-callout");
  c.append(ICON.info(), el("p", null, text));
  return c;
}

// ---------- saving ----------
export function setNote(note, kind, text) {
  note.className = `pf-note ${kind}`.trim();
  note.textContent = text;
}

// Runs `fn`, showing Saving… / Saved ✓ / the error in `note`.
export async function runSave(button, note, fn) {
  button.disabled = true;
  setNote(note, "", "Saving…");
  try {
    await fn();
    setNote(note, "ok", "Saved ✓");
  } catch (e) {
    setNote(note, "err", e.message || "Couldn't save.");
  } finally {
    button.disabled = false;
  }
}

// Shows "Unsaved changes" in `note` whenever something inside `scope` changes,
// except inside an element matching `ignore`.
export function trackDirty(scope, note, { ignore } = {}) {
  const mark = (e) => {
    if (ignore && e.target.closest(ignore)) return;
    setNote(note, "dirty", "Unsaved changes");
  };
  scope.addEventListener("input", mark);
  scope.addEventListener("change", mark);
}

export const hasUnsavedIn = (root) => !!root.querySelector(".pf-note.dirty");

export function button(label, cls, onClick) {
  const b = el("button", `btn ${cls}`.trim(), label);
  b.type = "button";
  if (onClick) b.onclick = onClick;
  return b;
}

export function liveNote() {
  const note = el("span", "pf-note");
  note.setAttribute("aria-live", "polite");
  return note;
}

// Footer with a save button for a whole section. Builds have their own Save,
// so edits inside them don't mark the section dirty.
export function saveBar(scope, label, onSave) {
  const bar = el("div", "pf-save");
  const note = liveNote();
  const btn = button(label, "primary", () => runSave(btn, note, onSave));
  trackDirty(scope, note, { ignore: ".pf-builds" });
  bar.append(note, btn);
  return bar;
}
