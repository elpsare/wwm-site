// Small DOM helpers shared by every page. All text goes in via textContent,
// never innerHTML, so nothing a member types can run as markup.

export const $ = (id) => document.getElementById(id);

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

let uid = 0;
// Unique ids for label/input pairs and radio groups.
export const nextId = (prefix) => `${prefix}-${++uid}`;

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

export const ICON = {
  check: () => icon(["M20 6 9 17l-5-5"], { size: 14, width: 3 }),
  plus: () => icon(["M12 5v14", "M5 12h14"], { width: 2.2 }),
  star: () => icon(["m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"], { size: 14, fill: true }),
  info: () => icon(["M12 16v-4", "M12 8h.01", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"], { size: 20, width: 1.8 }),
};
