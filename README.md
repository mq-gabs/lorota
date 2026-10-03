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
