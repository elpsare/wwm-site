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

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
