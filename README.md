# wwm-site

Static guild hub for the WWM guild, served by GitHub Pages at
https://elpsare.github.io/wwm-site/.

- **Login:** Discord OAuth2 implicit grant (`identify guilds`), entirely in the
  browser. No backend and no client secret. The token is kept in
  `sessionStorage` and is used only to show the user's name and avatar and to
  check membership in the guild.
- **Schedule:** hand-mirrored from `config/schedule.yaml` in the private bot
  repo (titles and times only). Edit `config.js` when the bot schedule changes.

Everything here is public. Don't add secrets, member IDs or roster lists.

## Discord setup

In the Developer Portal, under the bot's application → **OAuth2 → Redirects**,
add the following URL exactly:

    https://elpsare.github.io/wwm-site/

## Local preview

    python -m http.server 8000

To log in locally, also add `http://localhost:8000/` as a redirect and
temporarily set `redirectUri` in `config.js` to that URL.
