# LOROTA

Casual multiplayer bluffing trivia for 2–4 players, in Brazilian Portuguese. See [SPEC.md](SPEC.md).

## Running

Requires Node.js 20+.

```sh
npm install
npm run dev      # server on :3000 (tsx watch) + client on :5173 (Vite, proxies /socket.io)
npm test         # Vitest: shared, server and client unit tests
npm run build    # builds client/dist and server/dist
npm start        # production: one process on $PORT (default 3000) serving the built client
npm run typecheck
```

Open http://localhost:5173 in dev (or http://localhost:3000 after `build` + `start`). Use two or more tabs (or
private windows) to play against yourself.

## Layout

- `shared/` config (`config.ts`), types, `formatLive` / `normalize`, ranking. Shipped as TypeScript and bundled into
  both sides.
- `server/` Express + Socket.IO. `game.ts` holds the pure rules (options, scoring, reveal order),
  `roomManager.ts` the room state, phase machine and every timer, `sockets.ts` the socket glue.
  Questions live in `server/data/questions.json`.
- `client/` React + Vite. Screens in `src/screens/`, all UI text in `src/strings.ts`, all Web Audio in
  `src/audio/` (`soundsFor` diffs snapshots into effects; music is note data in `tracks.ts` played by a step
  sequencer in `music.ts`).

## Additions beyond the spec

Small extensions that the spec's types didn't cover:

- `Snapshot.hostId`: the lobby marks the host for everyone, and `you.isHost` alone can't do that.
- `Snapshot.serverNow`: lets the client correct clock skew so countdowns computed from `phaseEndsAt` are accurate.
- `Snapshot.lastPhaseTimedOut`: lets `soundsFor` play `timeUp` deterministically.
- `room:leave` event + "Sair da sala" button (lobby and game over).
- `room:detached` event: if the same player opens the room in another tab, the newest tab wins and the old one
  returns to the room list.
- Error acks carry a code (e.g. `ROOM_FULL`); the client maps codes to the Portuguese messages in `strings.ts`.
- In the lobby, a disconnected player gives up their slot or nickname to someone new joining, and is dropped when
  the game starts.
- Audio module also exposes `setMusicMood({ fast, ducked })` for the last-10-seconds speed-up and reveal ducking.

## Deploying

The server keeps all game state in memory, so the backend must be **one long-running Node process** (WebSockets,
no serverless functions, no multiple instances). Restarting it ends all live games.

### Option A: one service (simplest)

Any Node host (Render, Railway, Fly.io, a VPS):

- Build: `npm ci && npm run build`
- Start: `npm start` (listens on `$PORT`)

The server serves the client, so there's no CORS or URL config.

### Option B: separate frontend and backend

Both are built from the repo root, because the client and server import the `shared` workspace.

**Backend** (Render web service, Railway, Fly.io, VPS):

- Build: `npm ci && npm run build -w server`
- Start: `npm start`
- Env: `CORS_ORIGIN=https://your-frontend.example.com` (comma-separated for several, e.g. a preview URL)
- Health check: `GET /health`

**Frontend** (any static host: Netlify, Cloudflare Pages, Vercel):

- Root directory: repo root
- Build: `npm ci && npm run build -w client`
- Output directory: `client/dist`
- Env at build time: `VITE_SERVER_URL=https://your-backend.example.com` (baked into the bundle; rebuild after changing it)
- SPA fallback so invite links like `/r/ABCD` load the app: `client/public/_redirects` already handles Netlify and
  Cloudflare Pages. On Vercel, add a rewrite of `/(.*)` to `/index.html`.
