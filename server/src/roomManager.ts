// Authoritative room and game state. Owns every timer. Knows nothing about sockets:
// it reports changes through callbacks and the socket layer turns them into events.
import { randomUUID } from "node:crypto";
import {
  EMPTY_ROOM_TTL_SECONDS,
  LOW_PLAYERS_TIMEOUT_SECONDS,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  REVEAL_SECONDS_PER_OPTION,
  ROUNDS_PER_GAME,
  SCOREBOARD_SECONDS,
  VOTING_SECONDS,
  WRITING_SECONDS,
  charLength,
  normalize,
} from "@lorota/shared";
import type { ErrorCode, Phase, RevealedOption, RoomListItem, Snapshot } from "@lorota/shared";
import { buildOptions, buildReveal, randomId, resolveAnswers, scoreRound } from "./game";
import type { Option, Rng } from "./game";
import type { Question } from "./questions";

export interface Player {
  id: string;
  token: string;
  nickname: string;
  connected: boolean;
  score: number;
  roundGain: number;
  joinOrder: number;
}

export interface Round {
  number: number;
  question: Question;
  submitted: Map<string, string>;
  drafts: Map<string, string>;
  answers: Map<string, string> | null;
  options: Option[] | null;
  votes: Map<string, string>;
  reveal: RevealedOption[] | null;
  revealCount: number;
  gains: Map<string, number> | null;
}

export interface Room {
  code: string;
  createdSeq: number;
  hostId: string;
  players: Player[];
  phase: Phase;
  round: Round | null;
  phaseEndsAt: number | null;
  lastPhaseTimedOut: boolean;
  usedQuestionIds: Set<string>;
  nextJoinOrder: number;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  lowPlayersTimer: ReturnType<typeof setTimeout> | null;
  emptyTimer: ReturnType<typeof setTimeout> | null;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

export interface RoomManagerOptions {
  questions: Question[];
  rng?: Rng;
  onRoomChange?: (room: Room) => void;
  onListChange?: (list: RoomListItem[]) => void;
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
const GAME_PHASES: Phase[] = ["WRITING", "VOTING", "REVEAL", "SCOREBOARD"];

const fail = (error: ErrorCode) => ({ ok: false as const, error });

export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nick = raw.replace(/\s+/g, " ").trim();
  const len = charLength(nick);
  return len >= 1 && len <= MAX_NICKNAME_LENGTH ? nick : null;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly questions: Question[];
  private readonly rng: Rng;
  private readonly onRoomChange: (room: Room) => void;
  private readonly onListChange: (list: RoomListItem[]) => void;
  private roomSeq = 0;
  private lastListJson = "[]";

  constructor(opts: RoomManagerOptions) {
    this.questions = opts.questions;
    this.rng = opts.rng ?? Math.random;
    this.onRoomChange = opts.onRoomChange ?? (() => {});
    this.onListChange = opts.onListChange ?? (() => {});
  }

  // ---------- room membership ----------

  createRoom(rawNickname: unknown): Result<{ room: Room; player: Player }> {
    const nickname = cleanNickname(rawNickname);
    if (!nickname) return fail("INVALID_NICKNAME");
    const room: Room = {
      code: this.newCode(),
      createdSeq: ++this.roomSeq,
      hostId: "",
      players: [],
      phase: "LOBBY",
      round: null,
      phaseEndsAt: null,
      lastPhaseTimedOut: false,
      usedQuestionIds: new Set(),
      nextJoinOrder: 0,
      phaseTimer: null,
      lowPlayersTimer: null,
      emptyTimer: null,
    };
    const player = this.addPlayer(room, nickname);
    room.hostId = player.id;
    this.rooms.set(room.code, room);
    this.notify(room);
    return { ok: true, room, player };
  }

  joinRoom(
    rawCode: unknown,
    rawNickname: unknown,
    token?: unknown,
  ): Result<{ room: Room; player: Player; reattached: boolean }> {
    if (typeof rawCode !== "string") return fail("INVALID_PAYLOAD");
    const room = this.rooms.get(rawCode.trim().toUpperCase());
    if (!room) return fail("ROOM_NOT_FOUND");

    if (typeof token === "string" && token) {
      const existing = room.players.find((p) => p.token === token);
      if (existing) {
        existing.connected = true;
        this.afterConnectionChange(room);
        return { ok: true, room, player: existing, reattached: true };
      }
    }

    if (room.phase !== "LOBBY") return fail("GAME_STARTED");
    const nickname = cleanNickname(rawNickname);
    if (!nickname) return fail("INVALID_NICKNAME");
    const connected = room.players.filter((p) => p.connected);
    if (connected.length >= MAX_PLAYERS) return fail("ROOM_FULL");
    const key = nickname.toLocaleLowerCase("pt-BR");
    const sameNick = room.players.find((p) => p.nickname.toLocaleLowerCase("pt-BR") === key);
    if (sameNick?.connected) return fail("NICKNAME_TAKEN");
    // In the lobby, disconnected players give way to people who are actually here.
    if (sameNick) this.removePlayer(room, sameNick.id);
    if (room.players.length >= MAX_PLAYERS) {
      const ghost = room.players.find((p) => !p.connected);
      if (ghost) this.removePlayer(room, ghost.id);
    }

    const player = this.addPlayer(room, nickname);
    this.afterConnectionChange(room);
    return { ok: true, room, player, reattached: false };
  }

  disconnect(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player || !player.connected) return;
    player.connected = false;
    this.afterConnectionChange(room);
  }

  /** Explicit leave: removes the player from a lobby, otherwise counts as a disconnect. */
  leave(code: string, playerId: string): Result {
    const room = this.rooms.get(code);
    if (!room || !room.players.some((p) => p.id === playerId)) return fail("NOT_IN_ROOM");
    if (room.phase !== "LOBBY") {
      this.disconnect(code, playerId);
      return { ok: true };
    }
    this.removePlayer(room, playerId);
    if (room.players.length === 0) this.deleteRoom(room);
    else this.afterConnectionChange(room);
    return { ok: true };
  }

  // ---------- game actions ----------

  startGame(code: string, playerId: string): Result {
    const room = this.rooms.get(code);
    if (!room || !this.isMember(room, playerId)) return fail("NOT_IN_ROOM");
    if (room.hostId !== playerId) return fail("NOT_HOST");
    if (room.phase !== "LOBBY") return fail("WRONG_PHASE");
    if (this.connectedCount(room) < MIN_PLAYERS) return fail("NOT_ENOUGH_PLAYERS");
    room.players = room.players.filter((p) => p.connected);
    for (const p of room.players) {
      p.score = 0;
      p.roundGain = 0;
    }
    room.round = null;
    this.startRound(room);
    return { ok: true };
  }

  draft(code: string, playerId: string, text: unknown): Result {
    const room = this.rooms.get(code);
    if (!room || !this.isMember(room, playerId)) return fail("NOT_IN_ROOM");
    if (typeof text !== "string") return fail("INVALID_PAYLOAD");
    if (room.phase !== "WRITING" || !room.round) return fail("WRONG_PHASE");
    if (room.round.submitted.has(playerId)) return fail("ALREADY_SUBMITTED");
    room.round.drafts.set(playerId, normalize(text));
    return { ok: true };
  }

  submitLie(code: string, playerId: string, text: unknown): Result {
    const room = this.rooms.get(code);
    if (!room || !this.isMember(room, playerId)) return fail("NOT_IN_ROOM");
    if (typeof text !== "string") return fail("INVALID_PAYLOAD");
    if (room.phase !== "WRITING" || !room.round) return fail("WRONG_PHASE");
    if (room.round.submitted.has(playerId)) return fail("ALREADY_SUBMITTED");
    room.round.submitted.set(playerId, normalize(text));
    if (this.everyoneConnected(room, (p) => room.round!.submitted.has(p.id))) this.endWriting(room, false);
    else this.notify(room);
    return { ok: true };
  }

  vote(code: string, playerId: string, optionId: unknown): Result {
    const room = this.rooms.get(code);
    if (!room || !this.isMember(room, playerId)) return fail("NOT_IN_ROOM");
    if (typeof optionId !== "string") return fail("INVALID_PAYLOAD");
    const round = room.round;
    if (room.phase !== "VOTING" || !round?.options) return fail("WRONG_PHASE");
    if (round.votes.has(playerId)) return fail("ALREADY_VOTED");
    if (!round.options.some((o) => o.id === optionId)) return fail("INVALID_OPTION");
    round.votes.set(playerId, optionId);
    if (this.everyoneConnected(room, (p) => round.votes.has(p.id))) this.endVoting(room, false);
    else this.notify(room);
    return { ok: true };
  }

  playAgain(code: string, playerId: string): Result {
    const room = this.rooms.get(code);
    if (!room || !this.isMember(room, playerId)) return fail("NOT_IN_ROOM");
    if (room.hostId !== playerId) return fail("NOT_HOST");
    if (room.phase !== "GAME_OVER") return fail("WRONG_PHASE");
    this.clearPhaseTimer(room);
    room.phase = "LOBBY";
    room.round = null;
    room.phaseEndsAt = null;
    room.lastPhaseTimedOut = false;
    for (const p of room.players) {
      p.score = 0;
      p.roundGain = 0;
    }
    this.notify(room);
    return { ok: true };
  }

  // ---------- views ----------

  listRooms(): RoomListItem[] {
    const items = [...this.rooms.values()]
      .filter((r) => this.connectedCount(r) > 0)
      .sort((a, b) => b.createdSeq - a.createdSeq)
      .map((r) => ({
        roomCode: r.code,
        hostNickname: r.players.find((p) => p.id === r.hostId)?.nickname ?? "",
        playerCount: this.connectedCount(r),
        maxPlayers: MAX_PLAYERS,
        state: r.phase === "LOBBY" ? ("LOBBY" as const) : ("PLAYING" as const),
      }));
    const joinable = (i: RoomListItem) => i.state === "LOBBY" && i.playerCount < i.maxPlayers;
    return [...items.filter(joinable), ...items.filter((i) => !joinable(i))];
  }

  snapshot(room: Room, playerId: string): Snapshot {
    const { phase, round } = room;
    const inGame = phase !== "LOBBY" && round !== null;
    const showGain = phase === "SCOREBOARD" || phase === "GAME_OVER";
    let revealed: RevealedOption[] = [];
    if (round?.reveal && phase === "REVEAL") revealed = round.reveal.slice(0, round.revealCount);
    else if (round?.reveal && phase === "SCOREBOARD") revealed = round.reveal;
    return {
      roomCode: room.code,
      phase,
      you: { id: playerId, isHost: room.hostId === playerId },
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        connected: p.connected,
        score: p.score,
        roundGain: showGain ? p.roundGain : 0,
        hasSubmitted: phase === "WRITING" && !!round?.submitted.has(p.id),
        hasVoted: phase === "VOTING" && !!round?.votes.has(p.id),
      })),
      round: inGame ? { number: round.number, total: ROUNDS_PER_GAME } : null,
      question: inGame ? round.question.text : null,
      phaseEndsAt: room.phaseEndsAt,
      yourAnswer: inGame ? (round.answers?.get(playerId) ?? round.submitted.get(playerId) ?? null) : null,
      options: inGame && round.options ? round.options.map((o) => ({ id: o.id, text: o.text })) : null,
      yourVote: inGame ? (round.votes.get(playerId) ?? null) : null,
      revealed,
      serverNow: Date.now(),
      lastPhaseTimedOut: room.lastPhaseTimedOut,
    };
  }

  /** Re-broadcast a room (used by the socket layer after attaching a socket). */
  notify(room: Room): void {
    if (this.rooms.has(room.code)) this.onRoomChange(room);
    this.emitListIfChanged();
  }

  // ---------- phase machine ----------

  private startRound(room: Room): void {
    const number = (room.round?.number ?? 0) + 1;
    for (const p of room.players) p.roundGain = 0;
    room.round = {
      number,
      question: this.pickQuestion(room),
      submitted: new Map(),
      drafts: new Map(),
      answers: null,
      options: null,
      votes: new Map(),
      reveal: null,
      revealCount: 0,
      gains: null,
    };
    this.enterPhase(room, "WRITING", WRITING_SECONDS * 1000, false, () => this.endWriting(room, true));
  }

  private endWriting(room: Room, timedOut: boolean): void {
    const round = room.round!;
    const ids = room.players.map((p) => p.id);
    round.answers = resolveAnswers(ids, round.submitted, round.drafts);
    round.options = buildOptions(ids, round.answers, round.question.answer, this.rng);
    this.enterPhase(room, "VOTING", VOTING_SECONDS * 1000, timedOut, () => this.endVoting(room, true));
  }

  private endVoting(room: Room, timedOut: boolean): void {
    const round = room.round!;
    round.reveal = buildReveal(round.options!, round.votes);
    round.gains = scoreRound(round.options!, round.votes);
    round.revealCount = 1;
    const step = REVEAL_SECONDS_PER_OPTION * 1000;
    const next = () => {
      if (round.revealCount < round.reveal!.length) {
        round.revealCount++;
        room.phaseTimer = setTimeout(next, step);
        this.notify(room);
      } else {
        this.toScoreboard(room);
      }
    };
    this.enterPhase(room, "REVEAL", step * round.reveal.length, timedOut, next, step);
  }

  private toScoreboard(room: Room): void {
    const round = room.round!;
    for (const p of room.players) {
      p.roundGain = round.gains?.get(p.id) ?? 0;
      p.score += p.roundGain;
    }
    this.enterPhase(room, "SCOREBOARD", SCOREBOARD_SECONDS * 1000, false, () => {
      if (round.number >= ROUNDS_PER_GAME) this.gameOver(room);
      else this.startRound(room);
    });
  }

  private gameOver(room: Room): void {
    this.clearPhaseTimer(room);
    this.clearLowPlayersTimer(room);
    room.phase = "GAME_OVER";
    room.phaseEndsAt = null;
    room.lastPhaseTimedOut = false;
    this.notify(room);
  }

  /**
   * Switches phase and arms its timer. `firstTimerMs` lets REVEAL fire its first step
   * before the whole phase duration (used for the per-option cadence).
   */
  private enterPhase(
    room: Room,
    phase: Phase,
    durationMs: number,
    timedOut: boolean,
    onTimer: () => void,
    firstTimerMs = durationMs,
  ): void {
    this.clearPhaseTimer(room);
    room.phase = phase;
    room.phaseEndsAt = Date.now() + durationMs;
    room.lastPhaseTimedOut = timedOut;
    room.phaseTimer = setTimeout(onTimer, firstTimerMs);
    this.notify(room);
  }

  // ---------- connection bookkeeping ----------

  private afterConnectionChange(room: Room): void {
    const connected = room.players.filter((p) => p.connected);
    const host = room.players.find((p) => p.id === room.hostId);
    if ((!host || !host.connected) && connected.length > 0) {
      room.hostId = [...connected].sort((a, b) => a.joinOrder - b.joinOrder)[0].id;
    }

    if (connected.length === 0) {
      if (!room.emptyTimer) {
        room.emptyTimer = setTimeout(() => this.deleteRoom(room), EMPTY_ROOM_TTL_SECONDS * 1000);
      }
    } else if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
    }

    this.checkLowPlayers(room);

    // Phases never wait for disconnected players.
    const round = room.round;
    if (round && room.phase === "WRITING" && this.everyoneConnected(room, (p) => round.submitted.has(p.id))) {
      this.endWriting(room, false);
    } else if (round && room.phase === "VOTING" && this.everyoneConnected(room, (p) => round.votes.has(p.id))) {
      this.endVoting(room, false);
    } else {
      this.notify(room);
    }
  }

  private checkLowPlayers(room: Room): void {
    const low = GAME_PHASES.includes(room.phase) && this.connectedCount(room) < MIN_PLAYERS;
    if (low && !room.lowPlayersTimer) {
      room.lowPlayersTimer = setTimeout(() => {
        room.lowPlayersTimer = null;
        this.gameOver(room);
      }, LOW_PLAYERS_TIMEOUT_SECONDS * 1000);
    } else if (!low) {
      this.clearLowPlayersTimer(room);
    }
  }

  private deleteRoom(room: Room): void {
    this.clearPhaseTimer(room);
    this.clearLowPlayersTimer(room);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
    this.rooms.delete(room.code);
    this.emitListIfChanged();
  }

  // ---------- helpers ----------

  private addPlayer(room: Room, nickname: string): Player {
    const player: Player = {
      id: randomId(this.rng, 12),
      token: randomUUID(),
      nickname,
      connected: true,
      score: 0,
      roundGain: 0,
      joinOrder: room.nextJoinOrder++,
    };
    room.players.push(player);
    return player;
  }

  private removePlayer(room: Room, playerId: string): void {
    room.players = room.players.filter((p) => p.id !== playerId);
  }

  private isMember(room: Room, playerId: string): boolean {
    return room.players.some((p) => p.id === playerId);
  }

  private connectedCount(room: Room): number {
    return room.players.filter((p) => p.connected).length;
  }

  /** True when there is at least one connected player and all of them satisfy `done`. */
  private everyoneConnected(room: Room, done: (p: Player) => boolean): boolean {
    const connected = room.players.filter((p) => p.connected);
    return connected.length > 0 && connected.every(done);
  }

  private pickQuestion(room: Room): Question {
    let pool = this.questions.filter((q) => !room.usedQuestionIds.has(q.id));
    if (pool.length === 0) {
      room.usedQuestionIds.clear();
      pool = this.questions;
    }
    const q = pool[Math.floor(this.rng() * pool.length)];
    room.usedQuestionIds.add(q.id);
    return q;
  }

  private newCode(): string {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(this.rng() * CODE_LETTERS.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }

  private clearPhaseTimer(room: Room): void {
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }

  private clearLowPlayersTimer(room: Room): void {
    if (room.lowPlayersTimer) clearTimeout(room.lowPlayersTimer);
    room.lowPlayersTimer = null;
  }

  private emitListIfChanged(): void {
    const list = this.listRooms();
    const json = JSON.stringify(list);
    if (json === this.lastListJson) return;
    this.lastListJson = json;
    this.onListChange(list);
  }
}
