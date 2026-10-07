// Public values only - no secrets belong on a static site.
window.SITE_CONFIG = {
  // Discord application (same app as the bot). OAuth2 > Redirects must list REDIRECT_URI exactly.
  discordClientId: "1542629030791225494",
  redirectUri: "https://elpsare.github.io/wwm-site/",
  // The bot's profile API (bot/profile/web.py behind Caddy on the bot VM).
  apiBase: "https://140.245.96.135/api",

  // Mirrors config/schedule.yaml in the bot repo (titles/times only). SGT, 24h.
  schedule: [
    { title: "HR/GHR sign-ups open", day: "sat", time: "12:00", kind: "signup",
      note: "RaidHelper posts the Monday and Tuesday sign-up events. Signing up is mandatory." },
    { title: "Monday roster posted", day: "mon", time: "20:00", kind: "roster",
      note: "Balanced teams are built from confirmed sign-ups." },
    { title: "Monday Guild Hero's Realm / Hero's Realm", day: "mon", time: "20:15", kind: "raid" },
    { title: "Tuesday roster posted", day: "tue", time: "20:00", kind: "roster",
      note: "Balanced teams are built from confirmed sign-ups." },
    { title: "Tuesday Guild Hero's Realm / Hero's Realm", day: "tue", time: "20:15", kind: "raid" },
    { title: "Skyward Bond availability poll opens", day: "wed", time: "12:00", kind: "poll",
      note: "Vote for the day and time slots that work for you." },
    { title: "Skyward Bond poll closes", day: "sun", time: "20:00", kind: "poll" },
    { title: "Guild war: join voice", day: "sat", time: "20:10", kind: "war",
      note: "Party up in Discord voice. War starts at 20:30." },
    { title: "Guild war: join voice", day: "sun", time: "20:10", kind: "war",
      note: "Party up in Discord voice. War starts at 20:30." },
  ],
  guildUtcOffsetHours: 8,
};
