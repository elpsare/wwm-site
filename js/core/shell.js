// The parts every page shares: the header's login chip and Roster link, and a
// status card for "log in" / "loading" / error messages.
import { $, el } from "./dom.js?v=202610080737";
import * as auth from "./auth.js?v=202610080737";

// Header chip: "Log in" button, or avatar + name + "Log out".
export function renderUserChip(user, { onLogout } = {}) {
  const container = $("auth");
  container.replaceChildren();
  if (!user) {
    container.append(loginButton());
    return;
  }
  const chip = el("div", "user");
  const img = el("img");
  img.src = auth.avatarUrl(user);
  img.alt = "";
  const out = el("button", "btn ghost", "Log out");
  out.type = "button";
  out.onclick = () => {
    auth.logout();
    renderUserChip(null);
    if (onLogout) onLogout();
  };
  chip.append(img, el("span", null, auth.displayName(user)), out);
  container.append(chip);
}

export function loginButton() {
  const btn = el("button", "btn discord", "Log in with Discord");
  btn.type = "button";
  btn.onclick = auth.login;
  return btn;
}

// The Roster link is only a shortcut; the bot refuses the roster to non-officers.
export function showRosterLink(visible) {
  $("nav-roster").hidden = !visible;
}

// A page that needs a logged-in member. Returns the Discord token, or null
// after showing the "log in" message. `onMessage` lets the page hide its own
// content while a message is up.
export function memberPage({ loginText, onMessage = () => {} }) {
  const box = $("status");

  function message(kind, ...parts) {
    box.className = `card ${kind}`.trim();
    box.replaceChildren(...parts);
    box.hidden = false;
    onMessage();
  }

  function loggedOut(reason) {
    auth.logout();
    renderUserChip(null);
    message("warn", el("p", null, reason || loginText), loginButton());
  }

  // Shows an API failure; an expired login goes back to the "log in" message.
  function fail(err) {
    if (err.status === 401) loggedOut(err.message);
    else message("warn", el("span", null, err.message));
  }

  function start() {
    const tok = auth.token();
    if (!tok) { loggedOut(); return null; }
    auth.fetchUser(tok)
      .then((u) => renderUserChip(u, { onLogout: () => loggedOut() }))
      .catch(() => {});
    return tok;
  }

  return { start, message, hideMessage: () => { box.hidden = true; }, loggedOut, fail };
}
