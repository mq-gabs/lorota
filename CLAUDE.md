# CLAUDE.md

LOROTA: a 2–4 player web bluffing-trivia game. Players write fake answers ("lorotas") to obscure questions,
then vote for the one they think is true. [SPEC.md](SPEC.md) is the source of truth for rules, events,
types, screens and audio. Read the relevant section before changing behavior.

## Commands

Run everything from the repo root (npm workspaces; the client and server both import `shared` as TypeScript):

```sh
npm run dev        # server :3000 (tsx watch) + client :5173 (Vite, proxies /socket.io to :3000)
npm test           # Vitest, all workspaces (root vitest.config.ts)
npm run typecheck  # tsc --noEmit for shared, server, client
npm run build      # client -> client/dist, server -> server/dist/index.js (esbuild bundle incl. shared)
npm start          # node server/dist/index.js; serves client/dist too if it exists
```

Single workspace: `npm run build -w server` / `-w client` (or `--workspace @lorota/server`).
Before calling a change done, run `npm run typecheck && npm test`.

## Layout

- `shared/src/`: `config.ts` (every tunable: timers, points, limits), `types.ts` (Snapshot, RoomListItem,
  socket event maps, ErrorCode), `format.ts` (`formatLive`/`normalize`), `ranking.ts`. No build step:
  `package.json` exports `./src/index.ts`.
- `server/src/`:
  - `game.ts`: pure rules (resolveAnswers, buildOptions, scoreRound, buildReveal). No I/O.
  - `roomManager.ts`: all room state, the phase machine and **every timer**. Knows nothing about sockets;
    it reports changes through `onRoomChange`/`onListChange` callbacks.
  - `sockets.ts`: Socket.IO glue (socket↔player maps, payload shape checks, acks, snapshot fan-out).
  - `index.ts`: Express + Socket.IO bootstrap, `/health`, env vars, static client.
  - `data/questions.json`: question pool.
- `client/src/`:
  - `App.tsx`: socket wiring, session restore, phase→screen switch, snapshot-diff sounds, clock-driven
    tick/music mood.
  - `net.ts`: socket, `request()` ack helper, sessionStorage tokens, server clock offset.
  - `strings.ts`: **all** user-visible text.
  - `screens/`, `components/`, `styles.css` (plain CSS, mobile first).
  - `audio/`: the only code that touches Web Audio. `soundsFor.ts` (pure snapshot diff → effect names),
    `sfx.ts` (effect recipes), `tracks.ts` (music as note data), `music.ts` (step sequencer), `index.ts`
    (public API).

## Invariants

- **The server is authoritative.** Clients send intents; the server validates, mutates and owns all timers.
  The client renders only from the latest `room:state` snapshot, which is built per player by
  `RoomManager.snapshot()`.
- **Secrecy (SPEC §4).** Before REVEAL, snapshots must not contain the real answer's identity, answer
  authors, votes, or other players' drafts. Options carry only `{id, text}`; option ids are random, never
  derived from player ids. REVEAL exposes `revealed` one entry at a time. Scores and `roundGain` change only
  when REVEAL ends. Changing `snapshot()` needs a matching update to the secrecy test in
  `roomManager.test.ts`.
- **No answer is ever rejected for its content.** Empty answers, duplicates and copies of the truth are all
  kept as separate options. Never merge or dedupe. Options = players + 1, always. The server re-runs
  `normalize` on every answer and draft, and on the real answer.
- **Phases never wait for disconnected players**, but `everyoneConnected()` requires at least one connected
  player, so an empty room doesn't fast-forward. A disconnect can legitimately end WRITING/VOTING early.
- **Ack before snapshot.** On create/join, `sockets.ts` replies to the ack and *then* sends `room:state`.
  The client drops snapshots for a room it doesn't know it's in yet, so reversing that order breaks joining.
- **Sounds come from snapshot diffs** in `soundsFor(prev, next, myId)`. `prev === null` (first snapshot
  after load or reconnect) plays nothing. Effects that depend on who wrote or picked what may only fire
  during REVEAL. `tick` and the music speed-up are driven by `phaseEndsAt` in `App.tsx`, not by `soundsFor`.
- Countdowns use `phaseEndsAt` corrected by `serverNow` (`net.ts` `secondsLeft`), never a local timer.

## Conventions

- **All UI text is informal Brazilian Portuguese and lives in `client/src/strings.ts`.** Code, comments
  and identifiers are in English. Use the exact wording SPEC.md quotes.
- Server errors are `ErrorCode`s in acks (`{ ok: false, error: "ROOM_FULL" }`). The client maps them via
  `S.errors` / `errorText()`. Adding a code means updating `ErrorCode` and `S.errors`; the `satisfies`
  check enforces this.
- Tunables go in `shared/src/config.ts`, not inline.
- Audio fails silently by design (`try/catch`, no-op without Web Audio), so a broken recipe won't show up as
  an error. Test new sounds by rendering them in a browser `OfflineAudioContext`.
- Music bars are 16 space-separated tokens (`C4`, `-` hold, `.` rest; drums `k s h o .`) and every voice
  must have the same bar count. `audio/tracks.test.ts` checks this.

## Deliberate extensions to the spec

These are documented in README "Additions beyond the spec". Keep them unless you're asked to remove them:

- Snapshot fields `hostId`, `serverNow`, `lastPhaseTimedOut`.
- Events `room:leave` and `room:detached`; the newest tab for the same player wins.
- Lobby only: a disconnected player gives up their slot or nickname to a newcomer and is dropped on game start.
- Audio API extra: `setMusicMood({ fast, ducked })`.
- Room chat: `chat:send` + `Snapshot.chat` (`ChatMessage` with server `sentAt`). Kept on the `Room`, capped at
  `CHAT_HISTORY`, gone when the room is deleted. Rendered by `components/Chat.tsx` in every phase.
- Question themes: `room:setTheme` (host, LOBBY only), `Snapshot.theme`, `RoomListItem.theme`. `THEMES` in
  `config.ts`; labels in `S.themes` (`satisfies Record<Theme, string>`). `pickQuestion` filters by theme ("geral" =
  all questions) and recycles only that theme's used ids.

## Questions (`server/data/questions.json`)

- Entries: `{ id, theme, text, answer, source, checked }`. `text` must contain `___`. Answers are 1–4 words, in
  pt-BR. Ids are sequential (`q001`…) across all themes. `theme: "geral"` means the question fits no specific
  theme (nature/science/geography) and is only drawn when the room plays Geral.
- `q001`–`q030` are the spec's seed questions, copied verbatim. Don't edit them.
- `q031`–`q060` (History) and `q061`–`q186` (Esportes, Influenciadores, Música, Filmes) were added at the owner's
  request with `checked: false`. `checked` means "verified against
  the source". Never set it to `true` without actually checking the source. It is never sent to clients.
- `questions.test.ts` asserts the exact count (currently 186), at least 30 per specific theme, and no repeated
  texts or answers (across all themes). Update the count when adding questions. SPEC.md and README still say 30; that's a known gap.

## Testing

- Server logic is tested through `RoomManager` with `vi.useFakeTimers()`. Advance time to drive phases
  instead of calling private methods.
- No browser or E2E tests live in the repo. For UI checks, drive two tabs with Playwright from outside the
  repo (it isn't a dependency) against `npm run build && PORT=… npm start`.

## Deployment

The backend must be **one long-running Node process**: state is in memory, it uses WebSockets, and it can't
run as multiple instances or serverless. A restart ends all games.

- Single service: build `npm ci && npm run build`, start `npm start` (uses `$PORT`).
- Split frontend/backend:
  - Backend env `CORS_ORIGIN` (comma-separated). It's needed for the polling fallback; browsers don't apply
    CORS to WebSockets.
  - Frontend build-time env `VITE_SERVER_URL`. It's baked into the bundle, so rebuild after changing it.
  - Static hosts need an SPA fallback so `/r/ABCD` works. `client/public/_redirects` covers Netlify and
    Cloudflare Pages.
- Keep `npm ci` (not `--omit=dev`) for builds: esbuild and Vite are dev dependencies.
