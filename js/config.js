// Public values only - no secrets belong on a static site.
export const CONFIG = {
  // Discord application (same app as the bot). OAuth2 > Redirects must list redirectUri exactly.
  discordClientId: "1542629030791225494",
  redirectUri: "https://elpsare.github.io/wwm-site/",
  // The bot's profile API (bot/profile/web.py behind Caddy on the bot VM).
  apiBase: "https://140.245.96.135/api",
  // Guild times are fixed to SGT.
  guildUtcOffsetHours: 8,
};
