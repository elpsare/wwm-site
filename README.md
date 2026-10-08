# wwm-site

Static guild hub for the WWM guild, served by GitHub Pages at
https://elpsare.github.io/wwm-site/.

- **Login:** Discord OAuth2 implicit grant (`identify` only), entirely in the
  browser, with no client secret (`js/core/auth.js`). The token is kept in
  `sessionStorage`. Discord always redirects to the site root, which forwards
  back to the page that started the login. Login only proves who someone is;
  the bot decides membership and officer access (`/api/me`) from its own view
  of the guild and its roles.
- **Profile (`profile.html`):** members fill in the same questionnaire as
  `/profile setup`. The page sends the Discord token to the bot's API
  (`apiBase` in `js/config.js`, served by `bot/profile/web.py` behind Caddy on the
  bot VM). The bot checks who the token belongs to and that they're in the
  guild, then saves to its roster database. Option lists come from the bot, so
  there is nothing to keep in sync here.
- **Roster (`roster.html`):** read-only view of every profile, for officers
  only (the bot's `/profileadmin` officer roles). The API refuses everyone else,
  so hiding the nav link is only cosmetic.
- **Schedule:** hand-mirrored from `config/schedule.yaml` in the private bot
  repo (titles and times only). Edit `js/data/schedule.js` when the bot schedule changes.

Everything here is public. Don't add secrets, member IDs or roster lists.

## Discord setup

In the Developer Portal, under the bot's application → **OAuth2 → Redirects**,
add the following URL exactly:

    https://elpsare.github.io/wwm-site/

## Local preview

    python -m http.server 8000

To log in locally, also add `http://localhost:8000/` as a redirect and
temporarily set `redirectUri` in `js/config.js` to that URL.

## Layout

Plain HTML, CSS and ES modules; no build step.

    index.html, profile.html, roster.html   one page each, one module entry each
    css/base.css          tokens, typography, header, buttons, cards, form basics
    css/<page>.css        styles used only by that page (profile ones are pf-*)
    js/config.js          public settings (Discord app, API address, guild timezone)
    js/data/schedule.js   the weekly schedule shown on the home page
    js/core/dom.js        $, el, icons - every page's DOM helpers
    js/core/auth.js       Discord login and token handling (identity only)
    js/core/api.js        client for the bot's API (/me, /profile, /roster)
    js/core/guild.js      guild rules shared by pages (interests, builds, labels)
    js/core/shell.js      header login chip, Roster link, status/login messages
    js/pages/schedule.js  home page
    js/pages/roster.js    officer roster
    js/pages/profile/     profile page:
      main.js             page controller (paging by URL hash, loading, saving state)
      model.js            sections and completion rules (no DOM)
      sections.js         the four section pages
      builds.js           build list and inline editor
      widgets.js          form controls and save helpers
      progress.js         progress card, section rail, header status
    tools/bump-version.py cache-busting release helper

## Releasing

Pages caches files for up to 10 minutes, so every CSS link, module script and
module import carries the same `?v=` tag. After changing any `.css` or `.js`
file, run:

    python tools/bump-version.py

and commit the result. It updates the tag everywhere at once, so visitors never
get new HTML with old scripts.
