// Home page: this week's guild schedule in the visitor's time zone, plus a
// welcome card once they're logged in.
import { CONFIG } from "../config.js?v=202610080737";
import { SCHEDULE } from "../data/schedule.js?v=202610080737";
import { $, el } from "../core/dom.js?v=202610080737";
import * as auth from "../core/auth.js?v=202610080737";
import { botApi } from "../core/api.js?v=202610080737";
import { renderUserChip, showRosterLink } from "../core/shell.js?v=202610080737";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const KIND_LABEL = { signup: "Sign-ups", roster: "Roster", raid: "Raid", poll: "Poll", war: "Guild war" };

// ---------- welcome card ----------
// access: the bot's answer from /api/me, or null if the bot couldn't be reached.
function renderWelcome(user, access) {
  const welcome = $("welcome");
  welcome.replaceChildren();
  showRosterLink(!!(access && access.officer));
  if (!user) {
    welcome.hidden = true;
    return;
  }
  const name = auth.displayName(user);
  welcome.hidden = false;
  if (!access) {
    welcome.className = "card";
    welcome.append(el("strong", null, `Hi ${name}.`),
      el("span", "muted", " Couldn't reach the guild bot to check your membership. Try again in a minute."));
  } else if (access.member) {
    welcome.className = "card ok";
    const link = el("a", null, "Fill in or update your guild profile");
    link.href = "profile.html";
    welcome.append(el("strong", null, `Welcome back, ${access.name || name}.`),
      el("span", null, " "), link, el("span", null, ", or see the schedule below."));
  } else {
    welcome.className = "card warn";
    welcome.append(el("strong", null, `Hi ${name}.`),
      el("span", null, " You're not in the guild's Discord server yet. Ask an officer for an invite."));
  }
}

function loggedOut() {
  renderUserChip(null);
  renderWelcome(null, null);
}

// ---------- schedule ----------
// Next occurrence of a guild-time weekday/time, as a real Date.
function nextOccurrence(day, time) {
  const off = CONFIG.guildUtcOffsetHours * 3600e3;
  const [h, m] = time.split(":").map(Number);
  const nowGuild = new Date(Date.now() + off); // read with getUTC* = guild wall clock
  const target = new Date(Date.UTC(
    nowGuild.getUTCFullYear(), nowGuild.getUTCMonth(), nowGuild.getUTCDate(), h, m,
  ));
  let add = (DAYS.indexOf(day) - nowGuild.getUTCDay() + 7) % 7;
  if (add === 0 && target <= nowGuild) add = 7;
  target.setUTCDate(target.getUTCDate() + add);
  return new Date(target.getTime() - off);
}

function relative(ms) {
  const mins = Math.round(ms / 60e3);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h ${mins % 60}m`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

const fmtLocal = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const fmtDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function upcomingItem(e) {
  const li = el("li", `event ${e.kind}`);
  const when = el("div", "when");
  when.append(el("span", "local", fmtLocal.format(e.at)), el("span", "date", fmtDate.format(e.at)));
  const body = el("div", "body");
  const head = el("div", "head");
  head.append(el("span", "tag", KIND_LABEL[e.kind]), el("span", "title", e.title));
  body.append(head);
  if (e.note) body.append(el("p", "note", e.note));
  body.append(el("span", "rel muted", `${relative(e.at - Date.now())} · ${e.day.toUpperCase()} ${e.time} SGT`));
  li.append(when, body);
  return li;
}

function dayColumn(day) {
  const col = el("div", "day");
  col.append(el("h3", null, day.toUpperCase()));
  const events = SCHEDULE.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));
  if (!events.length) col.append(el("p", "muted", "Free"));
  for (const e of events) {
    const row = el("p", `mini ${e.kind}`);
    row.append(el("b", null, e.time), document.createTextNode(` ${e.title}`));
    col.append(row);
  }
  return col;
}

function renderSchedule() {
  $("tz").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time";
  const items = SCHEDULE
    .map((e) => ({ ...e, at: nextOccurrence(e.day, e.time) }))
    .sort((a, b) => a.at - b.at);
  $("upcoming").replaceChildren(...items.map(upcomingItem));
  $("routine").replaceChildren(...WEEK.map(dayColumn));
}

// ---------- boot ----------
renderSchedule();
setInterval(renderSchedule, 60e3);

const tok = auth.token();
renderWelcome(null, null);
if (tok) {
  auth.fetchUser(tok)
    .then((user) => {
      renderUserChip(user, { onLogout: loggedOut });
      return botApi(tok).me()
        .then((access) => renderWelcome(user, access), () => renderWelcome(user, null));
    })
    .catch(() => { auth.logout(); loggedOut(); });
} else {
  renderUserChip(null);
}
