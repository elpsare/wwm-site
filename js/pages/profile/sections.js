// The four questionnaire pages. Each view builds its card from ctx.data and
// saves its own fields; builds (GvG/PvE) save separately via builds.js.
import { el } from "../../core/dom.js?v=202610080737";
import { shortLabel } from "../../core/guild.js?v=202610080737";
import { WHY_OPTIONAL, isNeeded, sectionById } from "./model.js?v=202610080737";
import { renderSectionStatus } from "./progress.js?v=202610080737";
import { buildsBlock } from "./builds.js?v=202610080737";
import {
  callout, chips, field, optionCards, saveBar, segmented, textInput, twoColumns, yesNo,
} from "./widgets.js?v=202610080737";

// The rules notes are shared with the Discord wizard, which uses a dropdown.
const ruleNote = (text) => callout(text.replace(" in the acknowledgement dropdown", " under Acknowledgement"));

function sectionCard(ctx, id) {
  const card = el("section", "pf-card");
  card.setAttribute("aria-labelledby", `h-${id}`);
  const head = el("div", "pf-card-head");
  const h = el("h2", null, sectionById(id).title);
  h.id = `h-${id}`;
  h.tabIndex = -1; // focused when the page changes
  const status = el("span");
  renderSectionStatus(status, ctx.data, id);
  head.append(h, status);
  if (!isNeeded(ctx.data, id)) head.append(el("p", "pf-why", WHY_OPTIONAL[id]));
  const body = el("div", "pf-body");
  card.append(head, body);
  return { card, body };
}

// The "pick the word the note names" check. Sent only when a choice is made.
function acknowledgement(options, acknowledged) {
  const picker = chips(options, "");
  const node = field("Acknowledgement", picker, acknowledged
    ? { sub: "done ✓", subClass: "ok" }
    : { sub: "pick the word the note names", subClass: "warn" });
  return { node, read: picker.read };
}

function general(ctx) {
  const m = ctx.data.member, o = ctx.data.options;
  const { card, body } = sectionCard(ctx, "general");
  const ign = textInput(m.ign, 32);
  const age = chips(o.age_ranges, m.age_range);
  const region = chips(o.regions, m.region);
  const devices = optionCards(o.devices, m.devices, { multi: true });
  const interests = chips(o.content_interests, m.content_interests, { multi: true, label: shortLabel });
  body.append(
    twoColumns(field("In-game name", ign), field("Age range", age)),
    field("Where do you play from?", region),
    field("Devices you play on", devices, { sub: "pick all that apply" }),
    field("What do you want to play with the guild?", interests,
      { hint: "This decides which sections you need to fill in." }),
    saveBar(body, "Save general", () => ctx.send(ctx.api.updateProfile({
      ign: ign.value, region: region.read(), age_range: age.read(),
      devices: devices.read(), content_interests: interests.read(),
    }))),
  );
  return card;
}

function gvg(ctx) {
  const m = ctx.data.member, o = ctx.data.options;
  const { card, body } = sectionCard(ctx, "gvg");
  const availability = optionCards(o.gvg_availability, m.gvg_availability);
  const voice = yesNo(m.gvg_voice, "Voice during GvG");
  const ack = acknowledgement(o.ack_gvg, m.gvg_ack_ok);
  body.append(
    ruleNote(o.notes.gvg),
    field("When can you make GvG?", availability),
    twoColumns(field("Join Discord voice during GvG?", voice, { sub: "mic optional" }), ack.node),
    saveBar(body, "Save guild war", () => ctx.send(ctx.api.updateProfile({
      gvg_availability: availability.read(),
      gvg_voice: voice.read(),
      ...(ack.read() ? { gvg_ack: ack.read() } : {}),
    }))),
    buildsBlock(ctx, "gvg"),
  );
  return card;
}

function pve(ctx) {
  const m = ctx.data.member, o = ctx.data.options;
  const { card, body } = sectionCard(ctx, "pve");
  const voice = yesNo(m.pve_voice, "Voice during PvE");
  const ack = acknowledgement(o.ack_pve, m.pve_ack_ok);
  body.append(
    ruleNote(o.notes.pve),
    twoColumns(field("Join Discord voice during PvE?", voice, { sub: "mic optional" }), ack.node),
    saveBar(body, "Save PvE", () => ctx.send(ctx.api.updateProfile({
      pve_voice: voice.read(),
      ...(ack.read() ? { pve_ack: ack.read() } : {}),
    }))),
    buildsBlock(ctx, "pve"),
  );
  return card;
}

function ratings(m, o) {
  const rows = el("div", "pf-rates");
  const readers = {};
  for (const a of o.social_activities) {
    const key = `social_rating_${a.key}`;
    const seg = segmented(o.social_ratings, m[key], { aria: a.label });
    const row = el("div", "pf-rate");
    row.append(el("span", null, a.label), seg);
    rows.append(row);
    readers[key] = seg.read;
  }
  return {
    node: field("How do you feel about these events?", rows),
    read: () => Object.fromEntries(Object.entries(readers).map(([k, read]) => [k, read()])),
  };
}

function social(ctx) {
  const m = ctx.data.member, o = ctx.data.options;
  const { card, body } = sectionCard(ctx, "social");
  const interests = chips(o.social_interests, m.social_interests, { multi: true, label: shortLabel });
  const voice = yesNo(m.social_voice, "Voice for social activities");
  const buddy = yesNo(m.social_buddy, "Buddy system");
  const events = ratings(m, o);
  const wishlist = textInput(m.social_wishlist, 300, { multiline: true });
  body.append(
    callout(o.notes.social),
    field("Your in-game interests", interests),
    twoColumns(field("Join Discord voice for social activities?", voice),
      field("Interested in the buddy system?", buddy)),
    events.node,
    field("Activities you hope to see", wishlist),
    saveBar(body, "Save social", () => ctx.send(ctx.api.updateProfile({
      social_interests: interests.read(),
      social_voice: voice.read(),
      social_buddy: buddy.read(),
      social_wishlist: wishlist.value,
      ...events.read(),
    }))),
  );
  return card;
}

export const SECTION_VIEWS = { general, gvg, pve, social };
