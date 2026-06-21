# Side A — Music Quiz Game

Party game where players place song cards in chronological order on a timeline.
React + Vite SPA, Express 5 backend, PostgreSQL on Railway. Deployed on Railway.
GitHub repo: `caspermonsted/side-a` (branch `main` → auto-deploys to Railway).

## Running locally

```powershell
# Frontend dev server (port 5173)
npm run dev

# Backend is on Railway — no local server needed for frontend dev.
# To run scripts against the prod DB:
node --env-file=.env scripts/your-script.js
```

Credentials are in `.env` (gitignored):
- `DATABASE_PUBLIC_URL` — Railway PostgreSQL public connection string
- `ANTHROPIC_API_KEY` — used by the challenge-year endpoint and batch scripts

## Architecture

```
src/
  pages/Game.jsx         # Main game component — all game logic lives here
  pages/Setup.jsx        # Team/party game setup
  pages/SoloSetup.jsx    # Solo setup
  pages/Leaderboard.jsx
  spotify/api.js         # fetchTracks() — queries /api/songs per decade, calls Deezer for previews
  spotify/player.js      # playSong() / pauseSong() — Web Audio via <audio> + Deezer preview URLs
  session.js             # sessionStart / sessionEnd helpers (POST /api/session-*)
  log.js                 # Client-side event logging
server.js                # Express 5 — all API routes + DB init
scripts/                 # One-off maintenance scripts (run with node --env-file=.env)
```

## Database tables

### `songs` — main track pool
```sql
id, source_id (UNIQUE), title, artist, year, year_original,
decade (60s/70s/80s/90s/00s/10s/20s), difficulty (1-3 legacy),
difficulty_score (1-100, 1=famous/easy, 100=obscure/hard),
listeners, artwork_url, album_title, is_danish, excluded, added_at
```
- `source_id` formats: `spotify:{id}`, `hitlisten:{title}:{artist}`, or legacy CUID
- `year_original` = rollback safety net (set once via `COALESCE(year_original, $old)`, never overwritten)
- `excluded = true` removes a song from all game queries

### `sessions` — game telemetry
```sql
id, started_at, ended_at, platform, country_code, city,
num_teams, difficulty, decades, target, completed, rounds_played,
duration_seconds, final_scores (jsonb), tracks_loaded, songs (jsonb), error
```

### `high_scores` — solo leaderboard
```sql
id, name, score, difficulty, decades, created_at
```

### `danish_tracks` — Danish chart data (currently unused in game flow)
```sql
id, spotify_id (UNIQUE), title, artist, year, decade, dk_score, preview_url, album_art
```

## Key API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/songs?decades=90s&score=9&range=9&dkScore=26&dkRange=26&count=18` | Main track query — per-decade, filtered by difficulty_score |
| `GET /api/preview?title=X&artist=Y` | Deezer preview URL proxy |
| `POST /api/challenge-year` | Claude Sonnet + web_search to verify/correct a song's year |
| `GET /api/search?q=…` | Spotify search proxy (client credentials flow) |
| `POST /api/session-start` / `POST /api/session-end` | Game telemetry |

## Difficulty system

Scores run 1 (most famous) → 100 (most obscure). Separate thresholds for international vs Danish songs (percentile-matched so each bucket holds ~same share):

```js
// src/spotify/api.js
easy:   { score:  9, range:  9, dkScore: 26, dkRange: 26 }  // intl ≤18,   dk ≤52
medium: { score: 27, range:  8, dkScore: 62, dkRange: 10 }  // intl 19–35, dk 53–72
hard:   { score: 64, range: 28, dkScore: 85, dkRange: 12 }  // intl ≥36,   dk ≥73
```

Pool sizes (all non-excluded songs with a year):
- intl-easy: ~817, intl-medium: ~684, intl-hard: ~691
- dk-easy: ~413, dk-medium: ~490, dk-hard: ~243

**Deezer coverage is the real constraint** — only ~40-56 songs per game have working Deezer preview URLs. Topup fetches (`enrichPreviews: false`) add more tracks but without preview URLs; tracks without a `previewUrl` are auto-skipped in READY phase.

## Game state machine

```
LOADING → READY → LISTENING → PLACED → REVEALED → JUDGED → HANDOFF → READY …
                                                                ↓ (solo)
                                                           GAMEOVER / DONE
```

Key phases:
- **READY**: "Play the song" button. Auto-skips tracks with no `previewUrl`.
- **LISTENING**: Song playing, player drags mystery card to a slot on their timeline.
- **PLACED**: Card placed, "Reveal the song" button.
- **REVEALED**: Year shown. Solo → next. Team → player guesses artist (WRONG/CORRECT buttons).
- **JUDGED**: Score updated. "Next →" button advances to HANDOFF.
- **HANDOFF**: Pass phone to next team. Shows final round / sudden death banners.

## Track loading & recycling

- Initial load: 60 tracks with `enrichPreviews: true` (Deezer preview URLs cached on tracks)
- Topup: triggers when `remaining ≤ 20`; fetches 120 tracks with `enrichPreviews: false`
- After 3 empty topup results, `seenIds` is cleared and tracks recycle
- If `currentTrack` is undefined (pool truly exhausted), team games force-recycle instead of ending

## Game modes

**Solo**: 1 player, 3 lives, keeps playing until lives run out or tracks exhaust.

**Team** (2–4 teams):
- Teams take turns. First to reach `target` score triggers final round.
- **Final round**: remaining teams in current cycle each get one more turn.
- After final round, `endOrContinue()` runs:
  - Clear winner → DONE screen
  - Tie → **Sudden death**: each tied team plays one full turn; re-check; repeat if still tied
- Sudden death uses `suddenDeathQueue` (array of tied team indices) and `nextTeamIdx` override for non-consecutive team routing.

## Challenge year feature

In REVEALED / JUDGED phase (max 2 uses per game, shared):
- Calls `POST /api/challenge-year` → Claude Sonnet + web_search
- If year is wrong and corrected: year updates in DB permanently; team gets a re-placement (back to PLACED); challenge NOT consumed
- If year confirmed correct: challenge IS consumed

## Known issues / history

- Hitlisten songs (Danish chart imports) had title/artist swapped in DB — fixed via bulk UPDATE.
- Many Danish songs lack Deezer preview coverage → small effective pool size per game.
- Year data quality varies; the challenge-year feature is the primary correction mechanism.
- `year_original` column preserves the original year before any challenge corrections.

## Environment variables (Railway)

```
DATABASE_URL              # Railway internal PostgreSQL URL (used by server.js)
SPOTIFY_CLIENT_ID         # Spotify app credentials
SPOTIFY_CLIENT_SECRET
ANTHROPIC_API_KEY         # Claude Sonnet for /api/challenge-year
LASTFM_API_KEY            # Used by Danish track import in server.js
BIGDATACLOUD_API_KEY      # IP geolocation for session telemetry
```

## Scripts (run locally with `node --env-file=.env scripts/name.js`)

Important ones:
- `classify-songs.js` — scores international songs 1–100 via Claude Haiku (safe to re-run, skips already-scored)
- `classify-danish.js` — same for Danish songs (uses separate Danish-context prompt)
- `fix-years-websearch.js` — batch year correction via Sonnet + web_search (expensive, has checkpoint/resume)
- `import-hitlisten.js` — imports Danish chart data
- `count-songs.js` / `stats.js` / `score-dist.js` — DB inspection utilities

**Never kill/restart a script making Anthropic API calls mid-run** — each restart re-spends money on already-processed songs. The fix-years-websearch script checkpoints after each call; always add checkpointing before running any paid-per-call batch job.
