# DartStats

An Android app for looking up darts league stats across every league in one place. Type a player's name and see their Cricket MPR and X01 PPD in each league they play in, a games-weighted combined average, team rosters and standings, league schedules, and the week's top performers.

The app is a single HTML page wrapped as an Android APK with Capacitor. A scheduled GitHub Action collects the league data twice a day, so the phone only downloads one small file and searches are instant.

> Unofficial hobby project. It is not affiliated with or endorsed by any league operator or website.

## Features

**Search**
- Search any player by full or partial name. A card appears for each league they play in, with Cricket MPR, X01 PPD, team record, and last match.
- When several players match, chips at the top switch between them.
- Players in two or more leagues get an **All leagues combined** card: MPR and PPD weighted by games played in each league, with a per-league breakdown.

**Teams and leagues**
- Tap any team name to see its roster, the league standings with the team highlighted, and its results.
- **Browse all leagues** lists every league. Each league page has a button per table (standings, Cricket, X01, and so on), a filter box, and sortable columns.
- Tap any player name, anywhere, to search for that player.

**Player of the week**
- Shown on the league page, as a one-line preview in the league list, and as a badge on a player's league card.
- Rule: most wins in the latest week (Cricket wins plus X01 wins). The highest X01 out breaks ties. Ties that remain are shown as co-winners.

**Schedules**
- Each league's schedule PDF opens inside the app (rendered with PDF.js) or in the browser.

**Customization**
- Color chooser with five presets plus separate background and text pickers, saved on the device.
- Works offline from the last downloaded copy of the data.

## How it works

```
 league website            GitHub Action (twice a day)            phone
 ───────────────    ──▶    scripts/scrape.mjs  ──▶  data.json  ──▶  app (www/index.html)
 league pages               fetch + parse tables     committed       downloads, caches,
                                                     to this repo    searches locally
```

1. **Scrape.** `scripts/scrape.mjs` finds every league page, fetches each one with a short pause between requests, and parses the HTML tables into JSON. It also records each league's schedule PDF link.
2. **Store.** The result is written to `data.json` and committed by the workflow if it changed.
3. **Read.** The app downloads `data.json` from this repo, keeps a copy on the device for 24 hours, and does all searching and calculation locally. The **Refresh** link forces a new download.

Safety check: if more than 20% of pages fail in a run, the scraper keeps the previous `data.json` instead of overwriting it.

## Repository layout

| Path | Purpose |
|---|---|
| `www/index.html` | The entire app: UI, search, calculations, PDF viewer |
| `scripts/scrape.mjs` | Scraper that produces `data.json` |
| `data.json` | Latest league data (about 600 KB), updated by the workflow |
| `.github/workflows/daily-scrape.yml` | Runs the scraper at 6 AM and 6 PM Central |
| `.github/workflows/build-apk.yml` | Builds the Android APK on every push to `main` |
| `capacitor.config.json` | Capacitor settings (native HTTP is enabled) |
| `package.json` | Dependencies: Capacitor 6 and jsdom |

## Building the app

The APK is built in the cloud, so no Android Studio is needed.

1. Commit changes to `main` (or run **Build APK** from the Actions tab).
2. When the run finishes, open it and download the `darts-lookup-apk` artifact.
3. Unzip it, copy `app-debug.apk` to the phone, and install it. Android will ask you to allow installs from the app you opened the file with.

The result is a debug-signed APK, which is fine for installing on your own devices.

To build locally instead (needs Node 20, JDK 17 and the Android SDK):

```
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Data refresh

- The scrape runs at 12:05 and 00:05 UTC, which is 6 AM and 6 PM Central Standard Time. GitHub schedules use UTC, so the local time shifts by an hour with daylight saving.
- Run it any time from **Actions → Daily scrape → Run workflow**.
- GitHub can pause scheduled workflows in repositories with no activity for a long stretch. The twice-daily data commits normally count as activity.

## Data format

`data.json` is one object:

```
{
  "generated": "ISO timestamp",
  "scanned": 23,
  "errors": [],
  "pages": [
    {
      "url": "league page address",
      "title": "league name",
      "tabs":  [ { "heading": "...", "headers": [...], "rows": [ {column: value} ] } ],
      "pdfs":  [ { "url": "...", "label": "...", "schedule": true } ],
      "embeds": []
    }
  ]
}
```

Every table on a league page becomes a tab. Player tables are recognized by a `Player` or `Captain` column, and weekly tables by a `Week N` heading. The scraper also follows embedded frames and picks up any table that has Week, Date, Home and Away columns as a schedule.

## Known limitations

- **Schedules are PDFs.** They display as images of the PDF, not as searchable rows, so "next match" and per-team schedule filtering only work for a league if its schedule is a real table.
- **Averages are approximations.** The combined MPR and PPD weight by games played, because darts thrown are not published.
- **Weeks are not dated.** Weekly tables are labeled by week number only, and different leagues can be on different weeks.
- **Some leagues record less.** A few leagues have no highest-out data or no weekly tables, so player of the week may show co-winners or nothing for them.
- **Needs the site to stay the same.** If a league page's layout changes, the scraper can miss tables until it is updated.
- **PDF viewer needs internet** the first time it is used, because PDF.js loads from a CDN.

## Ideas

- Read schedule PDFs into tables, which would unlock next-opponent scouting, match reminders, and add-to-calendar
- Team vs team comparison screen
- Favorites and a "remember me" home screen
- Trends over time and week-over-week changes, using saved snapshots
- Cross-league leaderboards with a minimum-games filter
- Rank and percentile within each league

## Tech

Plain HTML, CSS and JavaScript with no framework. Capacitor 6 wraps it for Android and provides native HTTP. The scraper uses Node 20 and jsdom. PDF.js 3.11 renders schedules. Builds and data refreshes run on GitHub Actions.
