import {
  CHAT_HISTORY,
  EMPTY_ROOM_TTL_SECONDS,
  MAX_CHAT_LENGTH,
  REVEAL_SECONDS_PER_OPTION,
  ROUNDS_PER_GAME,
  SCOREBOARD_SECONDS,
  VOTING_SECONDS,
  WRITING_SECONDS,
} from "@lorota/shared";
import type { RoomListItem, Theme } from "@lorota/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "./questions";
import { RoomManager } from "./roomManager";
import type { Room } from "./roomManager";

// q0..q9 are History, q10..q12 Sports.
const QUESTIONS: Question[] = Array.from({ length: 13 }, (_, i) => ({
  id: `q${i}`,
  text: `Pergunta secreta ${i} ___.`,
  answer: `verdade${i}xyz`,
  source: "x",
  checked: true,
  theme: (i < 10 ? "historia" : "esportes") as Theme,
}));

function setup(n = 3) {
  const lists: RoomListItem[][] = [];
  const m = new RoomManager({ questions: QUESTIONS, onListChange: (l) => lists.push(l) });
  const created = m.createRoom("Ana");
  if (!created.ok) throw new Error(created.error);
  const room = created.room;
  const ids = [created.player.id];
  for (const nick of ["Bia", "Caio", "Duda"].slice(0, n - 1)) {
    const j = m.joinRoom(room.code, nick);
    if (!j.ok) throw new Error(j.error);
    ids.push(j.player.id);
  }
  return { m, room, ids, lists };
}

function start(m: RoomManager, room: Room, hostId: string) {
  const r = m.startGame(room.code, hostId);
  expect(r).toEqual({ ok: true });
}

const optionIds = (room: Room) => room.round!.options!.map((o) => o.id);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("joining", () => {
  it("validates nicknames, uniqueness, capacity and phase", () => {
    const { m, room, ids } = setup(4);
    expect(m.joinRoom(room.code, "Eva")).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(m.joinRoom("ZZZZ", "Eva")).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    m.disconnect(room.code, ids[3]);
    expect(m.joinRoom(room.code, "ana")).toEqual({ ok: false, error: "NICKNAME_TAKEN" });
    expect(m.joinRoom(room.code, "")).toEqual({ ok: false, error: "INVALID_NICKNAME" });
    expect(m.joinRoom(room.code, "x".repeat(17))).toEqual({ ok: false, error: "INVALID_NICKNAME" });
    expect(m.joinRoom(room.code.toLowerCase(), "Eva").ok).toBe(true);
    expect(room.players).toHaveLength(4);

    const other = setup(2);
    start(other.m, other.room, other.ids[0]);
    expect(other.m.joinRoom(other.room.code, "Eva")).toEqual({ ok: false, error: "GAME_STARTED" });
  });

  it("reattaches a known token in any phase", () => {
    const { m, room, ids } = setup(3);
    start(m, room, ids[0]);
    const token = room.players[1].token;
    m.disconnect(room.code, ids[1]);
    expect(room.players[1].connected).toBe(false);
    const r = m.joinRoom(room.code, "whatever", token);
    expect(r.ok && r.player.id).toBe(ids[1]);
    expect(room.players[1].connected).toBe(true);
  });

  it("passes host to the earliest-joined connected player", () => {
    const { m, room, ids } = setup(3);
    m.disconnect(room.code, ids[0]);
    expect(room.hostId).toBe(ids[1]);
    expect(m.snapshot(room, ids[1]).you.isHost).toBe(true);
  });

  it("only the host can start, with at least 2 connected", () => {
    const { m, room, ids } = setup(2);
    expect(m.startGame(room.code, ids[1])).toEqual({ ok: false, error: "NOT_HOST" });
    m.disconnect(room.code, ids[1]);
    expect(m.startGame(room.code, ids[0])).toEqual({ ok: false, error: "NOT_ENOUGH_PLAYERS" });
  });
});

describe("phase machine", () => {
  it("advances early when everyone has acted", () => {
    const { m, room, ids } = setup(3);
    start(m, room, ids[0]);
    expect(room.phase).toBe("WRITING");
    expect(room.round!.number).toBe(1);
    m.submitLie(room.code, ids[0], "a");
    m.submitLie(room.code, ids[1], "b");
    expect(room.phase).toBe("WRITING");
    m.submitLie(room.code, ids[2], "c");
    expect(room.phase).toBe("VOTING");
    expect(room.lastPhaseTimedOut).toBe(false);
    for (const id of ids) m.vote(room.code, id, optionIds(room)[0]);
    expect(room.phase).toBe("REVEAL");
  });

  it("advances on timeout and through reveal, scoreboard and next round", () => {
    const { m, room, ids } = setup(2);
    start(m, room, ids[0]);
    vi.advanceTimersByTime(WRITING_SECONDS * 1000);
    expect(room.phase).toBe("VOTING");
    expect(room.lastPhaseTimedOut).toBe(true);
    vi.advanceTimersByTime(VOTING_SECONDS * 1000);
    expect(room.phase).toBe("REVEAL");
    expect(room.round!.revealCount).toBe(1);
    vi.advanceTimersByTime(REVEAL_SECONDS_PER_OPTION * 1000);
    expect(room.round!.revealCount).toBe(2);
    vi.advanceTimersByTime(REVEAL_SECONDS_PER_OPTION * 1000 * 2);
    expect(room.phase).toBe("SCOREBOARD");
    vi.advanceTimersByTime(SCOREBOARD_SECONDS * 1000);
    expect(room.phase).toBe("WRITING");
    expect(room.round!.number).toBe(2);
  });

  it("goes to GAME_OVER after the last round, with no repeated questions", () => {
    const { m, room, ids } = setup(2);
    start(m, room, ids[0]);
    const seen = new Set<string>();
    for (let r = 1; r <= ROUNDS_PER_GAME; r++) {
      expect(room.round!.number).toBe(r);
      seen.add(room.round!.question.id);
      for (const id of ids) m.submitLie(room.code, id, "x");
      for (const id of ids) m.vote(room.code, id, optionIds(room)[0]);
      vi.advanceTimersByTime(REVEAL_SECONDS_PER_OPTION * 1000 * 3);
      expect(room.phase).toBe("SCOREBOARD");
      vi.advanceTimersByTime(SCOREBOARD_SECONDS * 1000);
    }
    expect(room.phase).toBe("GAME_OVER");
    expect(seen.size).toBe(ROUNDS_PER_GAME);

    expect(m.playAgain(room.code, ids[1])).toEqual({ ok: false, error: "NOT_HOST" });
    expect(m.playAgain(room.code, ids[0])).toEqual({ ok: true });
    expect(room.phase).toBe("LOBBY");
    expect(room.players.every((p) => p.score === 0)).toBe(true);
  });

  it("uses the last draft on timeout, or empty", () => {
    const { m, room, ids } = setup(3);
    start(m, room, ids[0]);
    m.draft(room.code, ids[0], "rascunho velho");
    m.draft(room.code, ids[0], "rascunho novo!");
    m.submitLie(room.code, ids[1], "enviada");
    vi.advanceTimersByTime(WRITING_SECONDS * 1000);
    const answers = room.round!.answers!;
    expect(answers.get(ids[0])).toBe("RASCUNHO NOVO");
    expect(answers.get(ids[1])).toBe("ENVIADA");
    expect(answers.get(ids[2])).toBe("");
    expect(room.round!.options).toHaveLength(4);
  });

  it("does not wait for disconnected players", () => {
    const { m, room, ids } = setup(3);
    start(m, room, ids[0]);
    m.submitLie(room.code, ids[0], "a");
    m.submitLie(room.code, ids[1], "b");
    m.disconnect(room.code, ids[2]);
    expect(room.phase).toBe("VOTING");
    expect(room.round!.options).toHaveLength(4);
  });

  it("rejects invalid actions without changing anything", () => {
    const { m, room, ids } = setup(2);
    expect(m.submitLie(room.code, ids[0], "x")).toEqual({ ok: false, error: "WRONG_PHASE" });
    start(m, room, ids[0]);
    expect(m.vote(room.code, ids[0], "x")).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(m.submitLie(room.code, ids[0], 42)).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(m.submitLie(room.code, "intruso", "x")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    m.submitLie(room.code, ids[0], "primeira");
    expect(m.submitLie(room.code, ids[0], "segunda")).toEqual({ ok: false, error: "ALREADY_SUBMITTED" });
    expect(room.round!.submitted.get(ids[0])).toBe("PRIMEIRA");
    m.submitLie(room.code, ids[1], "");
    expect(m.vote(room.code, ids[0], "nope")).toEqual({ ok: false, error: "INVALID_OPTION" });
    m.vote(room.code, ids[0], optionIds(room)[0]);
    expect(m.vote(room.code, ids[0], optionIds(room)[1])).toEqual({ ok: false, error: "ALREADY_VOTED" });
  });

  it("ends the game after 60 s with fewer than 2 connected", () => {
    const { m, room, ids } = setup(2);
    start(m, room, ids[0]);
    m.disconnect(room.code, ids[1]);
    vi.advanceTimersByTime(59_000);
    expect(room.phase).not.toBe("GAME_OVER");
    vi.advanceTimersByTime(1_000);
    expect(room.phase).toBe("GAME_OVER");
  });

  it("applies points only when the reveal ends", () => {
    const { m, room, ids } = setup(2);
    start(m, room, ids[0]);
    m.submitLie(room.code, ids[0], "a");
    m.submitLie(room.code, ids[1], "b");
    const truthId = room.round!.options!.find((o) => o.kind === "TRUTH")!.id;
    m.vote(room.code, ids[0], truthId);
    m.vote(room.code, ids[1], truthId);
    expect(m.snapshot(room, ids[0]).players[0]).toMatchObject({ score: 0, roundGain: 0 });
    vi.advanceTimersByTime(REVEAL_SECONDS_PER_OPTION * 1000 * 3);
    expect(m.snapshot(room, ids[0]).players[0]).toMatchObject({ score: 1000, roundGain: 1000 });
  });
});

describe("themes", () => {
  it("only the host picks a valid theme, and only in the lobby", () => {
    const { m, room, ids, lists } = setup(2);
    expect(room.theme).toBe("geral");
    expect(m.setTheme(room.code, ids[1], "esportes")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(m.setTheme(room.code, ids[0], "culinaria")).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(m.setTheme(room.code, ids[0], "esportes")).toEqual({ ok: true });
    expect(m.snapshot(room, ids[1]).theme).toBe("esportes");
    expect(lists.at(-1)![0].theme).toBe("esportes");
    start(m, room, ids[0]);
    expect(m.setTheme(room.code, ids[0], "historia")).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("draws only from the room's theme, recycling it when used up", () => {
    const { m, room, ids } = setup(2);
    m.setTheme(room.code, ids[0], "esportes");
    start(m, room, ids[0]);
    const seen: string[] = [];
    for (let r = 1; r <= 4; r++) {
      seen.push(room.round!.question.id);
      vi.advanceTimersByTime((WRITING_SECONDS + VOTING_SECONDS + REVEAL_SECONDS_PER_OPTION * 3 + SCOREBOARD_SECONDS) * 1000);
    }
    expect(seen.every((id) => ["q10", "q11", "q12"].includes(id))).toBe(true);
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
  });
});

describe("snapshot secrecy", () => {
  it("leaks no truth, authors, votes or drafts before REVEAL", () => {
    const { m, room, ids } = setup(3);
    start(m, room, ids[0]);
    const truth = room.round!.question.answer.toUpperCase();
    m.draft(room.code, ids[1], "rascunho bia");
    m.submitLie(room.code, ids[2], "lorota caio");

    const writing = JSON.stringify(m.snapshot(room, ids[0]));
    expect(writing).not.toContain(truth);
    expect(writing).not.toContain("RASCUNHO BIA");
    expect(writing).not.toContain("LOROTA CAIO");
    const s = m.snapshot(room, ids[0]);
    expect(s.players.find((p) => p.id === ids[2])!.hasSubmitted).toBe(true);
    expect(s.options).toBeNull();
    expect(s.yourAnswer).toBeNull();
    expect(m.snapshot(room, ids[2]).yourAnswer).toBe("LOROTA CAIO");

    vi.advanceTimersByTime(WRITING_SECONDS * 1000);
    m.vote(room.code, ids[1], optionIds(room)[0]);
    const voting = m.snapshot(room, ids[0]);
    const json = JSON.stringify(voting);
    expect(voting.revealed).toEqual([]);
    expect(voting.yourVote).toBeNull();
    expect(json).not.toMatch(/TRUTH|LIE|authorId|voterIds/);
    expect(voting.options!.every((o) => Object.keys(o).sort().join() === "id,text")).toBe(true);
    // Option texts are present (including the normalized truth) but carry no kind or author.
    expect(voting.options!.map((o) => o.text)).toContain(truth);
    expect(m.snapshot(room, ids[1]).yourVote).toBe(optionIds(room)[0]);
    expect(voting.players.find((p) => p.id === ids[1])!.hasVoted).toBe(true);
    // Chat carries only what players typed in the chat.
    m.sendChat(room.code, ids[1], "oi");
    const chat = m.snapshot(room, ids[0]).chat;
    expect(chat.map((c) => c.text)).toEqual(["oi"]);
    expect(chat.every((c) => Object.keys(c).sort().join() === "authorId,id,nickname,sentAt,text")).toBe(true);

    vi.advanceTimersByTime(VOTING_SECONDS * 1000);
    expect(room.phase).toBe("REVEAL");
    expect(m.snapshot(room, ids[0]).revealed).toHaveLength(1);
    vi.advanceTimersByTime(REVEAL_SECONDS_PER_OPTION * 1000);
    expect(m.snapshot(room, ids[0]).revealed).toHaveLength(2);
  });
});

describe("chat", () => {
  it("stores messages with author and send time, in any phase", () => {
    const { m, room, ids } = setup(2);
    vi.setSystemTime(new Date("2026-10-05T12:34:00Z"));
    expect(m.sendChat(room.code, ids[0], "  oi   gente ")).toEqual({ ok: true });
    start(m, room, ids[0]);
    expect(m.sendChat(room.code, ids[1], "boa sorte")).toEqual({ ok: true });
    const chat = m.snapshot(room, ids[1]).chat;
    expect(chat.map((c) => [c.nickname, c.text])).toEqual([
      ["Ana", "oi gente"],
      ["Bia", "boa sorte"],
    ]);
    expect(chat[0].authorId).toBe(ids[0]);
    expect(chat[0].sentAt).toBe(Date.parse("2026-10-05T12:34:00Z"));
    expect(chat[0].id).not.toBe(chat[1].id);
  });

  it("rejects empty, too long, malformed and non-member messages", () => {
    const { m, room, ids } = setup(2);
    expect(m.sendChat(room.code, ids[0], "   ")).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(m.sendChat(room.code, ids[0], "a".repeat(MAX_CHAT_LENGTH + 1))).toEqual({
      ok: false,
      error: "INVALID_PAYLOAD",
    });
    expect(m.sendChat(room.code, ids[0], 42)).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(m.sendChat(room.code, "nobody", "oi")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expect(m.sendChat(room.code, ids[0], "a".repeat(MAX_CHAT_LENGTH))).toEqual({ ok: true });
    expect(room.chat).toHaveLength(1);
  });

  it("keeps only the most recent messages", () => {
    const { m, room, ids } = setup(2);
    for (let i = 0; i < CHAT_HISTORY + 5; i++) m.sendChat(room.code, ids[i % 2], `msg ${i}`);
    const chat = m.snapshot(room, ids[0]).chat;
    expect(chat).toHaveLength(CHAT_HISTORY);
    expect(chat[0].text).toBe("msg 5");
    expect(chat.at(-1)!.text).toBe(`msg ${CHAT_HISTORY + 4}`);
  });

  it("is discarded with the room", () => {
    const { m, room, ids } = setup(2);
    m.sendChat(room.code, ids[0], "oi");
    for (const id of ids) m.disconnect(room.code, id);
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_SECONDS * 1000);
    expect(m.rooms.has(room.code)).toBe(false);
    expect(m.sendChat(room.code, ids[0], "alguém?")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    const again = m.createRoom("Ana");
    if (!again.ok) throw new Error(again.error);
    expect(m.snapshot(again.room, again.player.id).chat).toEqual([]);
  });
});

describe("room list", () => {
  it("reflects create, join, leave, start and delete", () => {
    const { m, room, ids, lists } = setup(1);
    expect(lists.at(-1)).toEqual([
      { roomCode: room.code, hostNickname: "Ana", playerCount: 1, maxPlayers: 4, state: "LOBBY", theme: "geral" },
    ]);
    const j = m.joinRoom(room.code, "Bia");
    expect(lists.at(-1)![0].playerCount).toBe(2);
    m.leave(room.code, j.ok ? j.player.id : "");
    expect(lists.at(-1)![0].playerCount).toBe(1);
    m.joinRoom(room.code, "Caio");
    start(m, room, ids[0]);
    expect(lists.at(-1)![0].state).toBe("PLAYING");
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(WRITING_SECONDS * 1000);
      expect(m.listRooms()[0].state).toBe("PLAYING");
    }

    m.disconnect(room.code, room.players[0].id);
    m.disconnect(room.code, room.players[1].id);
    expect(lists.at(-1)).toEqual([]); // hidden with nobody connected
    expect(m.rooms.has(room.code)).toBe(true);
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(m.rooms.has(room.code)).toBe(false);
  });

  it("orders joinable rooms first, newest first within each group", () => {
    const m = new RoomManager({ questions: QUESTIONS });
    const a = m.createRoom("A");
    const b = m.createRoom("B");
    const c = m.createRoom("C");
    if (!a.ok || !b.ok || !c.ok) throw new Error();
    for (const n of ["x", "y", "z"]) m.joinRoom(a.room.code, n); // A full
    m.joinRoom(b.room.code, "y");
    m.startGame(b.room.code, b.player.id); // B playing
    const d = m.createRoom("D");
    if (!d.ok) throw new Error();
    expect(m.listRooms().map((r) => r.hostNickname)).toEqual(["D", "C", "B", "A"]);
  });
});
