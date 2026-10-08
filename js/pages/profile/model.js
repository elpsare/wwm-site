// The questionnaire's sections and how complete each one is. Pure functions
// over the bot's profile payload ({ member, builds, missing, options }).
import { isInterestedIn } from "../../core/guild.js?v=202610080831";

// One section = one page of the form, in this order.
export const SECTIONS = [
  { id: "general", name: "General", title: "General" },
  { id: "gvg", name: "Guild War", title: "Guild War" },
  { id: "pve", name: "PvE", title: "PvE — Skyward Bond / Speedruns" },
  { id: "social", name: "Social", title: "Casual / Social" },
];
export const sectionById = (id) => SECTIONS.find((s) => s.id === id);

export const WHY_OPTIONAL = {
  gvg: "You didn't pick Guild War, so this page is optional. Fill it in anyway if you join GvG.",
  pve: "You didn't pick Skyward Bond or Speedruns, so this page is optional. Fill it in anyway to add PvE builds.",
  social: "You didn't pick Casual/Social, so this page is optional. Fill it in to rate events and join the buddy system.",
};

// Which of the bot's "still to do" items (wizard.missing_for_complete) belong
// to each section.
const GENERAL_MISSING = ["ign", "age range", "devices", "content interests"];
const MISSING_MATCH = { gvg: /GvG/, pve: /PvE/, social: /Social/ };

// General is always needed; the rest only for the interests the member picked.
export const isNeeded = (data, id) =>
  id === "general" || isInterestedIn(data.member.content_interests, id);

const missingIn = (data, id) => data.missing.filter((m) =>
  (id === "general" ? GENERAL_MISSING.includes(m) : MISSING_MATCH[id].test(m)));

// { kind: "todo" | "done" | "opt", text }
export function sectionStatus(data, id) {
  const left = missingIn(data, id).length;
  if (left) return { kind: "todo", text: `${left} thing${left > 1 ? "s" : ""} left` };
  if (isNeeded(data, id)) return { kind: "done", text: "Complete" };
  return { kind: "opt", text: "Optional" };
}

// Start on the first needed section with something left to do.
export function defaultSection(data) {
  const todo = SECTIONS.find((s) => isNeeded(data, s.id) && sectionStatus(data, s.id).kind === "todo");
  return (todo || SECTIONS[0]).id;
}
