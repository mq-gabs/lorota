# LOROTA — build spec (v1)

LOROTA is a casual web multiplayer game for 2 to 4 players per room. No accounts, no install: a player creates a room, and others join from the public room list or an invite link.

**Language:** this spec is in English, but everything the player sees must be in Brazilian Portuguese: all UI text, error messages, questions and answers. Set `<html lang="pt-BR">` and the page title to `LOROTA`.

## 1. The game in one paragraph

Each round shows an obscure trivia question. Every player writes a fake answer (a "lorota") that sounds true. The game then shows all the players' answers mixed with the real one, and each player picks the one they believe is real. Players score for picking the truth and for every other player who picks their lorota. After a fixed number of rounds, the highest score wins.

## 2. Rules

### 2.1 Room

- 2 to 4 players. A 5th person trying to join gets "Sala cheia".
- All rooms are public and appear in the room list (section 5, screen 1).
- The creator is the host. Only the host can start the game, and only with at least 2 players connected.
- Nobody can join once a game has started. Existing players can reconnect (see section 7).
- Nickname: 1 to 16 characters, unique within the room.

### 2.2 Round flow

Phases, in order: `LOBBY` → `WRITING` → `VOTING` → `REVEAL` → `SCOREBOARD` → next round, or `GAME_OVER` after the last round.

**WRITING (40 s)**

- All players see the question and type one answer (max 40 characters).
- The input formats the text live as the player types, so they see exactly what the others will see (see 2.3).
- ANY answer is accepted. Nothing is ever rejected:
  - An empty answer is valid and will be shown as an empty option.
  - An answer identical to the real answer is valid and will be shown as its own option.
  - An answer identical to another player's is valid. Both are kept as separate options. Never merge.
- The submit button is always enabled, including when the input is empty.
- Once submitted, an answer is final.
- While typing, the client sends the current text as a draft (debounced about 300 ms). If the timer expires before a player submits, the server uses their last draft as their answer. With no draft, their answer is empty.
- The phase ends when every connected player has submitted or the timer expires.

**VOTING (20 s)**

- Options shown = one answer per player + the real answer, in random order. The order is the same for all players.
- Option count is therefore always players + 1: 3 options with 2 players, 5 options with 4 players. Every player in the room has exactly one option every round, even if empty or disconnected.
- All options, including the real answer, are displayed in normalized form (see 2.3) so the real answer cannot be spotted by its formatting.
- An empty option is rendered as a blank button of normal size and is selectable like any other.
- Each player picks exactly one option. A pick is final.
- A player MAY pick their own answer. It scores nothing (see 2.4).
- The phase ends when every connected player has voted or the timer expires. A player who did not vote scores nothing from voting.

**REVEAL (auto-advancing, about 4 s per option)**

- Options are revealed one at a time: player answers first, ordered from fewest votes to most votes (ties keep the voting-screen order), then the real answer last.
- For each player answer show: the text (blank if empty), "escrita por <apelido>", the nicknames of everyone who picked it, and the points its author earned from it.
- For the real answer show "A VERDADE", the nicknames of everyone who picked it, and the points each earned.
- Identical-looking options are revealed separately, each with its own author and voters. This includes a player answer that is identical to the real answer.

**SCOREBOARD (5 s)**

- Ranked list of players with total score and points gained this round. Then the next round starts automatically.

**GAME_OVER**

- Final ranking. Tied players share the same position.
- Host sees "Jogar de novo", which returns everyone to `LOBBY` with scores reset.

### 2.3 Text formatting

Two functions in `/shared`, used by both client and server.

`formatLive(text)` — applied to the input on every change while typing:

1. Unicode normalize to NFC.
2. Convert to uppercase (`toLocaleUpperCase('pt-BR')`).
3. Remove apostrophes (`'` and `’`). Replace every other character that is not a letter, digit or space with a space (`/[^\p{L}\p{N} ]/gu`).
4. Collapse repeated spaces into one and remove leading spaces. Keep a single trailing space so the player can type the next word.
5. Truncate to `MAX_LIE_LENGTH`.

`normalize(text)` = `formatLive(text)` followed by removing the trailing space. This is the final form stored and displayed.

Accented letters are kept. Examples: `"não sei!"` → `NÃO SEI`, `"guarda-chuva"` → `GUARDA CHUVA`, `"d'água"` → `DÁGUA`, `"!!!"` → empty.

Input behavior on the client:

- The input's value is always the `formatLive` output, so the player never sees lowercase or punctuation.
- Keep the caret position stable when formatting changes the text.
- Do not format during IME or dead-key composition (`isComposing`), or accents typed as `´` + `a` will break. Format on `compositionend`.
- Disable autocapitalize and autocorrect on the input.

The server never trusts the client: it runs `normalize` on every submitted answer and draft. The real answer from the questions file goes through `normalize` too before display.

### 2.4 Scoring

- Picking the real answer: `TRUTH_POINTS = 1000`.
- Each OTHER player who picks your answer: `FOOL_POINTS = 500` to you.
- Picking your own answer: 0 points for you, and it does not count as fooling anyone.
- With identical answers, each copy scores independently: only the author of the copy that was actually picked gets the points.
- A player answer identical to the real answer is still a player answer. Picking it gives the picker nothing and gives its author `FOOL_POINTS`. Only the real option gives `TRUTH_POINTS`.

Example, 4 players (A, B, C, D): A picks the truth, B picks A's answer, C picks A's answer, D picks D's own answer. Result: A = 1000 + 500 + 500 = 2000. B = 0, C = 0, D = 0.

### 2.5 Game length

`ROUNDS_PER_GAME = 8`. Questions are drawn at random with no repeats inside a room until the pool is exhausted.

## 3. Tech stack

- Node.js 20+, TypeScript everywhere.
- Server: Express + Socket.IO. All game state in memory. No database.
- Client: React + Vite. Plain CSS, no UI framework.
- Tests: Vitest.
- Monorepo with npm workspaces: `/server`, `/client`, `/shared` (config, types and the formatting functions, used by both sides).
- In production the server serves the built client, so the whole game runs as one process on one port.

Scripts at the root: `npm run dev` (server and client with hot reload), `npm run build`, `npm start`, `npm test`.

## 4. Architecture

The server is authoritative. Clients send intents; the server validates, updates state and owns every timer.

### State sync

After any state change in a room, the server sends each player in it a full snapshot tailored to that player (`room:state`). The client renders purely from the latest snapshot. This also makes reconnection trivial: a reconnecting player just receives the current snapshot.

Clients on the home screen receive the public room list (`rooms:list`) when they connect and again whenever it changes: room created or deleted, player count changed, or state changed between lobby and playing.

### Secrecy rules (must hold)

- The real answer is never sent to any client before `REVEAL`.
- Authors of answers and who voted for what are never sent before `REVEAL`.
- During `WRITING` a client only learns WHICH players have submitted, not what they wrote. Drafts are never sent to other clients.
- During `VOTING` a client only learns which players have voted.
- In `REVEAL`, the snapshot only contains the options revealed so far.
- The room list exposes only the fields in `RoomListItem` below.

### Events

Client → server (each uses a Socket.IO ack returning `{ ok: true }` or `{ ok: false, error }`):

- `room:create { nickname }` → `{ roomCode, playerToken }`
- `room:join { roomCode, nickname, playerToken? }` → `{ playerToken }`
- `game:start {}` (host only)
- `lie:draft { text }` (no ack needed)
- `lie:submit { text }`
- `vote:submit { optionId }`
- `game:playAgain {}` (host only)

Server → client:

- `rooms:list` with `RoomListItem[]`, to sockets that are not in a room.
- `room:state` with the `Snapshot`, to sockets in a room.

### Types

```ts
interface RoomListItem {
  roomCode: string;
  hostNickname: string;
  playerCount: number; // connected players
  maxPlayers: number; // 4
  state: "LOBBY" | "PLAYING"; // PLAYING = any phase other than LOBBY
}

type Phase =
  | "LOBBY"
  | "WRITING"
  | "VOTING"
  | "REVEAL"
  | "SCOREBOARD"
  | "GAME_OVER";

interface Snapshot {
  roomCode: string;
  phase: Phase;
  you: { id: string; isHost: boolean };
  players: {
    id: string;
    nickname: string;
    connected: boolean;
    score: number;
    roundGain: number; // points gained in the current round, 0 before REVEAL ends
    hasSubmitted: boolean; // WRITING
    hasVoted: boolean; // VOTING
  }[];
  round: { number: number; total: number } | null;
  question: string | null; // from WRITING onward
  phaseEndsAt: number | null; // server epoch ms, for the countdown
  yourAnswer: string | null; // your own submitted answer, normalized
  options: { id: string; text: string }[] | null; // VOTING onward, normalized and shuffled; text may be ''
  yourVote: string | null; // optionId
  revealed: {
    // REVEAL onward, grows one entry at a time
    optionId: string;
    kind: "LIE" | "TRUTH";
    authorId: string | null; // null for TRUTH
    voterIds: string[];
    pointsEach: number; // per voter for TRUTH, per fooled player for LIE
  }[];
}
```

### Questions

`/server/data/questions.json`, an array of:

```json
{
  "id": "q001",
  "text": "Em 1923, o jóquei Frank Hayes venceu uma corrida em Nova York mesmo estando ___.",
  "answer": "morto",
  "source": "https://en.wikipedia.org/wiki/Frank_Hayes_(jockey)",
  "checked": true
}
```

- Questions and answers are written in Brazilian Portuguese.
- Answers should be short (1 to 4 words) and the question obscure enough that players are unlikely to know it.
- The 30 seed questions are listed in section 11. Copy them into this file exactly as written: same wording, same answers, same sources, same `checked` values. Do not rewrite them and do not invent additional questions.
- `checked` records whether the fact was verified against the source when the list was written. It is for the owner's review and is never sent to clients.

### Config

All tunables in `/shared/config.ts`: `MIN_PLAYERS = 2`, `MAX_PLAYERS = 4`, `ROUNDS_PER_GAME = 8`, `WRITING_SECONDS = 40`, `VOTING_SECONDS = 20`, `REVEAL_SECONDS_PER_OPTION = 4`, `SCOREBOARD_SECONDS = 5`, `TRUTH_POINTS = 1000`, `FOOL_POINTS = 500`, `MAX_LIE_LENGTH = 40`, `MAX_NICKNAME_LENGTH = 16`.

## 5. Screens

Mobile first. Everything must be usable at 360 px wide and look fine on desktop. All UI strings live in one file (`/client/src/strings.ts`). Use informal Brazilian Portuguese. The strings quoted below are the expected wording.

1. **Início / Salas** (`/`) — the home screen is also the room list.
   - "Seu apelido" field.
   - "Criar sala" button.
   - "Código da sala" field with "Entrar" button, for joining by code.
   - "Salas abertas": a live list of ALL current rooms. Each row shows the room code, "Sala de <apelido do dono>", the player count as "2/4", and the state as "No lobby" or "Jogando".
   - A row has an "Entrar" button only when the room is in the lobby and not full. Rooms that are playing or full are still listed, without the button (full lobby rooms show "Sala cheia").
   - Order: joinable rooms first, then full or playing rooms; newest first within each group.
   - Empty list: "Nenhuma sala por aqui. Crie a primeira!"
   - Creating or joining without a nickname focuses the nickname field with "Escolha um apelido".
   - The list updates in real time without a refresh.
   - Opening `/r/<CODE>` shows the same screen with the room code prefilled.
2. **Lobby** — room code, "Copiar link de convite" button, player list (host marked "dono da sala"), "Começar jogo" for the host (disabled under 2 players), "Esperando o dono da sala começar" for the others.
3. **Escrita** — "Rodada 3 de 8", the question, countdown, text input with live formatting (2.3) and character counter, placeholder "Escreva sua lorota", "Enviar" button. After submitting: the player's own answer as sent, "Esperando os outros jogadores", and a per-player submitted indicator.
4. **Votação** — the question, "Qual é a verdade?", countdown, the options as large tappable buttons. After voting: the chosen option stays highlighted, plus a per-player voted indicator.
5. **Revelação** — question on top; options appear one at a time with "escrita por <apelido>" or "A VERDADE", then "Quem caiu: <apelidos>" or "Ninguém caiu nessa", and the points.
6. **Placar** — ranked list with total and "+N" for the round.
7. **Fim de jogo** — final ranking, winner highlighted, "Jogar de novo" for the host.

Error messages: "Sala cheia", "Sala não encontrada", "O jogo já começou", "Esse apelido já está em uso".

Countdowns are computed from `phaseEndsAt`, not from a local timer started on render.

Every screen shows two small toggles in a top corner, "Música" and "Efeitos" (see section 6).

## 6. Sound effects and music

The game ships with sound from v1. The tone is light and playful, like a TV quiz show.

### How audio is produced

- All audio is synthesized in code with the Web Audio API. No audio files, so there is nothing to license or download.
- Everything lives in one module, `/client/src/audio/`, exposing `playSfx(name)`, `setMusic(track | null)`, `setMusicEnabled(bool)` and `setSfxEnabled(bool)`. The rest of the client never touches the Web Audio API directly, so recorded audio files can replace the synth later without changing other code.
- Music is an original composition written as note data for a small step sequencer: bass, lead and a noise-based percussion voice, scheduled ahead of time against `AudioContext.currentTime` so the loop stays in tempo. Do not imitate any existing song.

### Music

| Track   | Where it plays                      | Character                                     |
| ------- | ----------------------------------- | --------------------------------------------- |
| `lobby` | Início, Lobby, Fim de jogo          | Relaxed, about 100 BPM, 8 to 16 bar loop      |
| `game`  | Escrita, Votação, Revelação, Placar | More driving, about 120 BPM, 8 to 16 bar loop |

- Loops must repeat with no audible gap or click.
- In the last 10 s of Escrita and Votação, the `game` track speeds up by about 15 %.
- During Revelação the music drops to about 30 % of its normal volume so the reveal sounds stand out, then returns for the Placar.
- Changing tracks uses a short crossfade (about 300 ms).

### Sound effects

| Name            | Trigger                                               | Sound                               |
| --------------- | ----------------------------------------------------- | ----------------------------------- |
| `click`         | Any button press                                      | Short soft tap                      |
| `join`          | A player enters the room                              | Rising two-note blip                |
| `leave`         | A player disconnects                                  | Falling two-note blip               |
| `start`         | Host starts the game                                  | Short upbeat flourish               |
| `roundStart`    | A new question appears                                | Quick "whoosh" plus chime           |
| `submit`        | You send your answer                                  | Confirming pop                      |
| `otherDone`     | Another player submits or votes                       | Very soft blip                      |
| `tick`          | Each of the last 5 s of Escrita and Votação           | Clock tick, the last one higher     |
| `timeUp`        | A phase ends by timeout                               | Short buzzer                        |
| `vote`          | You pick an option                                    | Confirming pop, lower than `submit` |
| `revealOption`  | Each option appears in Revelação                      | Drum hit                            |
| `gotFooled`     | A revealed lorota is the one you picked               | Comic descending slide              |
| `fooledSomeone` | Your lorota is revealed with at least one other voter | Cheeky rising arpeggio              |
| `truth`         | The real answer is revealed                           | Short fanfare                       |
| `correct`       | The real answer is revealed and you picked it         | Bright chime after the fanfare      |
| `points`        | Placar appears                                        | Coin-like count-up                  |
| `win`           | Fim de jogo, you are in first place                   | Full victory jingle                 |
| `gameOver`      | Fim de jogo, you are not in first place               | Shorter, neutral jingle             |

### Rules

- Browsers block audio until the user interacts with the page. Create or resume the `AudioContext` on the first tap or click (in practice "Criar sala" or "Entrar"). Never show an error if audio is blocked.
- Game sounds are triggered by comparing the previous snapshot with the new one, in one pure function `soundsFor(prev, next, myId)` that returns the list of effects to play. This keeps every player in sync with the server and makes the logic testable.
- The first snapshot after a page load or reconnect plays no effects, only the right music track, so refreshing does not replay old sounds.
- `tick` is driven by `phaseEndsAt`.
- No sound may reveal hidden information. Effects that depend on who wrote or picked what are played only in Revelação.
- Default levels: music 0.25, effects 0.6, through one master gain each.
- The "Música" and "Efeitos" toggles are on by default and remembered in `localStorage` (wrapped in try/catch; the game works without it).
- Music pauses when the tab is hidden and resumes when it is visible again.
- If the Web Audio API is unavailable, the audio module becomes a no-op and the game works normally.

## 7. Connections and edge cases

- Room code: 4 uppercase letters, excluding I and O. Unique among live rooms.
- `playerToken` is a random id stored in `sessionStorage` per room. Joining with a known token re-attaches the socket to the existing player, in any phase.
- A disconnected player stays in the game, shown as disconnected. Phases never wait for disconnected players. Their answer for the round is their last draft, or empty.
- If the host disconnects, the earliest-joined connected player becomes host.
- If fewer than 2 players are connected during a game for 60 s straight, the game ends and goes to `GAME_OVER`.
- A room with no connected players is hidden from the room list and deleted after 5 minutes.
- Every client message is validated on the server: correct phase, sender belongs to the room, payload types and lengths, one submitted answer and one vote per player per round, `optionId` exists. Invalid messages get an error ack and change nothing. Answer CONTENT is never a reason to reject.

## 8. Out of scope for v1

Accounts, private or password-protected rooms, matchmaking, chat, spectators, persistence across server restarts, profanity filter, custom question packs, languages other than Portuguese, recorded audio files, volume sliders, animations beyond simple transitions.

## 9. Tests and acceptance

Unit tests (Vitest), at minimum:

- `formatLive` and `normalize`: the examples in 2.3; a single trailing space survives `formatLive` and is removed by `normalize`; leading and repeated spaces are removed; truncation at 40; emoji input.
- Scoring: the example in 2.4; self-vote scores 0; identical answers score separately; picking a player's copy of the real answer gives the author `FOOL_POINTS` and the picker nothing; non-voters score nothing.
- Option building: one option per player plus the truth; count is always players + 1; empty answers and answers equal to the truth are kept; nothing is merged; the truth appears exactly once as kind `TRUTH`.
- Timeout: a player who did not submit gets their last draft; with no draft, an empty answer.
- Phase machine: early advance when everyone has acted; advance on timeout; last round goes to `GAME_OVER`.
- Snapshot secrecy: no real answer, authors, votes or other players' drafts in snapshots before `REVEAL`.
- Room list: reflects create, join, leave, start and delete; state is `PLAYING` for every phase other than `LOBBY`.
- `soundsFor(prev, next, myId)`: correct effects for each phase change, for submit and vote events, and for each reveal case (`gotFooled`, `fooledSomeone`, `truth`, `correct`); returns nothing when `prev` is null.
- Questions file: exactly 30 entries, unique ids, every entry has non-empty `text`, `answer` and `source`, and every `text` contains `___`.

Manual acceptance checklist:

- [ ] Every piece of text on every screen is in Portuguese.
- [ ] Two browser tabs can create, join, and play a full 8-round game.
- [ ] The home screen lists all rooms with player count and state, and updates live when another tab creates, joins or starts a room.
- [ ] A room that is playing or full cannot be joined from the list, by code, or by link.
- [ ] While typing an answer, the input shows uppercase text without punctuation, and accents can still be typed.
- [ ] An empty answer can be submitted and appears as a blank, selectable option.
- [ ] Typing the real answer is accepted and appears as a separate option next to the real one.
- [ ] Two identical answers show as two separate options, each revealed with its own author.
- [ ] A player can pick their own answer and gets 0 points for it.
- [ ] Letting the timer run out while typing uses the text typed so far.
- [ ] Reveal shows the author and the voters of every option, with the truth last.
- [ ] Refreshing the page mid-round returns the player to the same room and phase.
- [ ] The game is playable on a 360 px wide phone screen.
- [ ] Music starts after the first click, changes between lobby and game, and loops without a gap.
- [ ] Each effect in section 6 plays at its trigger, and the reveal effects match what happened to that player.
- [ ] "Música" and "Efeitos" toggles work independently and are remembered after a refresh.
- [ ] Refreshing mid-game restores the music without replaying earlier effects.
- [ ] All 30 questions from section 11 are in the game, word for word.

## 10. Build order

1. `/shared`: config, types, `formatLive` and `normalize`, with tests.
2. Server game logic as pure functions (option building, scoring, phase transitions), with tests.
3. Socket layer: rooms, tokens, room list, snapshots, timers.
4. Seed questions: copy section 11 into `/server/data/questions.json`.
5. Client screens, in the order listed in section 5.
6. Audio module: `soundsFor` with tests, then effects, then the two music loops.
7. Run the manual checklist with two to four tabs and fix what fails.

## 11. Seed questions (30)

Copy these into `/server/data/questions.json` with ids `q001` to `q030`, in this order. "Checked" = yes means the fact was verified against the listed source when this list was written; no means it is a well-documented fact that was not re-checked and should be reviewed by the owner before launch.

| #   | Pergunta (`text`)                                                                                                  | Resposta (`answer`) | Fonte (`source`)                                                                                                                  | Checked |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Em 1923, o jóquei Frank Hayes venceu uma corrida em Nova York mesmo estando \_\_\_.                                | morto               | https://en.wikipedia.org/wiki/Frank_Hayes_(jockey)                                                                                | yes     |
| 2   | Em 1518, em Estrasburgo, dezenas de pessoas passaram semanas sem conseguir parar de \_\_\_.                        | dançar              | https://en.wikipedia.org/wiki/Dancing_plague_of_1518                                                                              | yes     |
| 3   | Em 1919, uma onda gigante de \_\_\_ invadiu as ruas de Boston e matou 21 pessoas.                                  | melaço              | https://en.wikipedia.org/wiki/Great_Molasses_Flood                                                                                | yes     |
| 4   | No ano de 897, o papa Estêvão VI levou a julgamento o \_\_\_ do papa Formoso.                                      | cadáver             | https://en.wikipedia.org/wiki/Cadaver_Synod                                                                                       | yes     |
| 5   | As fezes do vombate, um marsupial australiano, têm formato de \_\_\_.                                              | cubo                | https://en.wikipedia.org/wiki/Wombat                                                                                              | yes     |
| 6   | Parte das cinzas do químico Fredric Baur foi enterrada dentro de sua invenção mais famosa: a \_\_\_.               | lata de Pringles    | https://en.wikipedia.org/wiki/Fredric_Baur                                                                                        | yes     |
| 7   | O animal nacional da Escócia é o \_\_\_.                                                                           | unicórnio           | https://en.wikipedia.org/wiki/National_symbols_of_Scotland                                                                        | yes     |
| 8   | De 1900 a 1920, o \_\_\_ foi uma modalidade dos Jogos Olímpicos.                                                   | cabo de guerra      | Wikipedia (en): Tug of war at the Summer Olympics                                                                                 | no      |
| 9   | Fundada em 1889, a Nintendo começou fabricando \_\_\_.                                                             | cartas de baralho   | Wikipedia (en): History of Nintendo                                                                                               | no      |
| 10  | O plástico-bolha foi inventado em 1957 para ser vendido como \_\_\_.                                               | papel de parede     | https://www.smithsonianmag.com/innovation/accidental-invention-bubble-wrap-180971325/                                             | yes     |
| 11  | Antes de fazer carros esportivos, a Lamborghini fabricava \_\_\_.                                                  | tratores            | Wikipedia (en): Lamborghini Trattori                                                                                              | no      |
| 12  | Na maratona olímpica de 1904, o primeiro a cruzar a linha de chegada tinha feito parte do percurso de \_\_\_.      | carro               | https://en.wikipedia.org/wiki/Frederick_Lorz                                                                                      | yes     |
| 13  | Nos anos 1940, um frango chamado Mike viveu 18 meses sem \_\_\_.                                                   | cabeça              | Wikipedia (en): Mike the Headless Chicken                                                                                         | no      |
| 14  | Em 1962, escolas da Tanganica (atual Tanzânia) fecharam por causa de uma epidemia de \_\_\_.                       | riso                | Wikipedia (en): Tanganyika laughter epidemic                                                                                      | no      |
| 15  | Em 1925, o golpista Victor Lustig "vendeu" a \_\_\_ para um comerciante de sucata.                                 | Torre Eiffel        | Wikipedia (en): Victor Lustig                                                                                                     | no      |
| 16  | Em 1967, o primeiro-ministro da Austrália, Harold Holt, desapareceu para sempre enquanto \_\_\_.                   | nadava              | Wikipedia (en): Disappearance of Harold Holt                                                                                      | no      |
| 17  | Em 1386, na cidade francesa de Falaise, um \_\_\_ foi julgado e enforcado por assassinato.                         | porco               | https://en.wikipedia.org/wiki/Animal_trial                                                                                        | yes     |
| 18  | Apesar do nome, o chapéu-panamá é originário do \_\_\_.                                                            | Equador             | Wikipedia (en): Panama hat                                                                                                        | no      |
| 19  | Em 1965, o astronauta John Young levou escondido para o espaço um \_\_\_.                                          | sanduíche           | Wikipedia (en): Gemini 3                                                                                                          | no      |
| 20  | O primeiro item vendido no eBay, em 1995, estava quebrado. Era uma \_\_\_.                                         | caneta laser        | https://time.com/4018841/first-item-sold-listed-ebay/                                                                             | yes     |
| 21  | A primeira webcam do mundo, criada na Universidade de Cambridge, servia para vigiar uma \_\_\_.                    | cafeteira           | Wikipedia (en): Trojan Room coffee pot                                                                                            | no      |
| 22  | O rei Carlos VI da França acreditava que seu corpo era feito de \_\_\_.                                            | vidro               | https://en.wikipedia.org/wiki/Glass_delusion                                                                                      | yes     |
| 23  | Thimphu, capital do Butão, é conhecida por ser uma capital sem nenhum \_\_\_.                                      | semáforo            | https://www.bhutanwiki.org/articles/thimphu                                                                                       | yes     |
| 24  | No campeonato mundial de carregar a esposa, na Finlândia, o prêmio é o peso da esposa em \_\_\_.                   | cerveja             | https://en.wikipedia.org/wiki/Wife-carrying                                                                                       | yes     |
| 25  | Em 1959, um \_\_\_ recebeu cerca de 100 mil votos para vereador em São Paulo.                                      | rinoceronte         | https://pt.wikipedia.org/wiki/Rinoceronte_Cacareco                                                                                | yes     |
| 26  | Entre 1961 e 1963, Brasil e França quase entraram em guerra por causa da pesca de \_\_\_.                          | lagosta             | https://en.wikipedia.org/wiki/Lobster_War                                                                                         | yes     |
| 27  | Em 1928, Henry Ford fundou uma cidade na Amazônia para produzir \_\_\_.                                            | borracha            | Wikipedia (pt): Fordlândia                                                                                                        | no      |
| 28  | Para pagar a viagem às Olimpíadas de 1932, os atletas brasileiros tinham de vender \_\_\_ nos portos pelo caminho. | café                | https://agenciabrasil.ebc.com.br/geral/noticia/2016-02/familia-do-homem-de-ferro-dos-jogos-de-1932-cobra-reconhecimento-do-atleta | yes     |
| 29  | Em março de 1969, a capital do Brasil foi transferida por três dias para \_\_\_.                                   | Curitiba            | https://www.gazetadopovo.com.br/politica/parana/curitiba-ja-foi-a-capital-do-brasil-por-tres-dias-48zj4cby49uxdh9f6ycemrfle/      | yes     |
| 30  | A Ilha da Queimada Grande, no litoral de São Paulo, é fechada ao público por causa de suas milhares de \_\_\_.     | cobras              | https://en.wikipedia.org/wiki/Ilha_da_Queimada_Grande                                                                             | yes     |
