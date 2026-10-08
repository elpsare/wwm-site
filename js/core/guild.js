// Guild domain knowledge shared by the profile and roster pages. Option lists
// themselves come from the bot (payload.options); this only knows how they
// relate to each other.

// Which content interests make a questionnaire category relevant.
export const INTEREST_FOR = {
  gvg: ["Guild War (GvG)"],
  pve: ["Skyward Bond", "Speedruns"],
  social: ["Casual/Social (Movies, Games, etc.)"],
};

export const isInterestedIn = (interests, category) =>
  INTEREST_FOR[category].some((i) => interests.includes(i));

// "PC (Keyboard & Mouse)" -> ["PC", "Keyboard & Mouse"]
export function splitLabel(label) {
  const m = /^(.*?) \((.*)\)$/.exec(label);
  return m ? [m[1], m[2]] : [label, ""];
}
export const shortLabel = (label) => splitLabel(label)[0];

// ---------- builds ----------
export const weaponKeys = (category) =>
  (category === "gvg" ? ["weapon_1", "weapon_2"] : ["pve_weapon_1", "pve_weapon_2"]);

export const weaponsOf = (build) => weaponKeys(build.category).map((k) => build[k]);

export function martialArtsOf(build, options) {
  return [...new Set(weaponsOf(build).map((w) => options.weapon_martial_art[w]).filter(Boolean))];
}

export function screenshotSummary(build, options) {
  return options.screenshot_kinds
    .map((k) => `${k.replace(/_/g, " ")} ${build.screenshots.includes(k) ? "✓" : "—"}`)
    .join(" · ");
}

export const mainBuild = (member, category) =>
  member.builds.find((b) => b.category === category && b.is_main) || null;

// Roster member status: { kind: "gone" | "todo" | "done", text, rank }.
// rank orders them for sorting (most attention needed first).
export function memberStatus(m) {
  if (!m.in_guild) return { kind: "gone", text: "Left server", rank: 2 };
  if (m.missing.length) return { kind: "todo", text: `${m.missing.length} to do`, rank: 0 };
  return { kind: "done", text: "Complete", rank: 1 };
}

// Matches the roster/table "status" filter values.
export function hasStatus(m, wanted) {
  return !wanted || memberStatus(m).kind === wanted;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
