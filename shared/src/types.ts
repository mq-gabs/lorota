export interface RoomListItem {
  roomCode: string;
  hostNickname: string;
  playerCount: number; // connected players
  maxPlayers: number; // 4
  state: "LOBBY" | "PLAYING"; // PLAYING = any phase other than LOBBY
}

export type Phase =
  | "LOBBY"
  | "WRITING"
  | "VOTING"
  | "REVEAL"
  | "SCOREBOARD"
  | "GAME_OVER";

export interface SnapshotPlayer {
  id: string;
  nickname: string;
  connected: boolean;
  score: number;
  roundGain: number; // points gained in the current round, 0 before REVEAL ends
  hasSubmitted: boolean; // WRITING
  hasVoted: boolean; // VOTING
}

export interface RevealedOption {
  optionId: string;
  kind: "LIE" | "TRUTH";
  authorId: string | null; // null for TRUTH
  voterIds: string[];
  pointsEach: number; // per voter for TRUTH, per fooled player for LIE
}

/** Extension: a room chat message. Lives only as long as the room. */
export interface ChatMessage {
  id: string;
  authorId: string;
  nickname: string; // kept so messages survive the author leaving the lobby
  text: string;
  sentAt: number; // server epoch ms
}

export interface Snapshot {
  roomCode: string;
  phase: Phase;
  you: { id: string; isHost: boolean };
  players: SnapshotPlayer[];
  round: { number: number; total: number } | null;
  question: string | null; // from WRITING onward
  phaseEndsAt: number | null; // server epoch ms, for the countdown
  yourAnswer: string | null; // your own submitted answer, normalized
  options: { id: string; text: string }[] | null; // VOTING onward, normalized and shuffled; text may be ''
  yourVote: string | null; // optionId
  revealed: RevealedOption[]; // REVEAL onward, grows one entry at a time
  /** Extension: the host's player id, so every client can mark "dono da sala". */
  hostId: string;
  /** Extension: server epoch ms when this snapshot was built, lets the client correct clock skew. */
  serverNow: number;
  /** Extension: true when the current phase began because the previous phase's timer ran out. */
  lastPhaseTimedOut: boolean;
  /** Extension: the room's most recent chat messages, oldest first. */
  chat: ChatMessage[];
}

export type ErrorCode =
  | "ROOM_FULL"
  | "ROOM_NOT_FOUND"
  | "GAME_STARTED"
  | "NICKNAME_TAKEN"
  | "INVALID_NICKNAME"
  | "NOT_IN_ROOM"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "WRONG_PHASE"
  | "ALREADY_SUBMITTED"
  | "ALREADY_VOTED"
  | "INVALID_OPTION"
  | "INVALID_PAYLOAD";

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

export interface ClientToServerEvents {
  "room:create": (p: { nickname: string }, ack: (r: Ack<{ roomCode: string; playerToken: string }>) => void) => void;
  "room:join": (
    p: { roomCode: string; nickname: string; playerToken?: string },
    ack: (r: Ack<{ roomCode: string; playerToken: string }>) => void,
  ) => void;
  /** Extension: leave the current room and go back to the room list. */
  "room:leave": (p: object, ack: (r: Ack) => void) => void;
  "game:start": (p: object, ack: (r: Ack) => void) => void;
  "lie:draft": (p: { text: string }) => void;
  "lie:submit": (p: { text: string }, ack: (r: Ack) => void) => void;
  "vote:submit": (p: { optionId: string }, ack: (r: Ack) => void) => void;
  "game:playAgain": (p: object, ack: (r: Ack) => void) => void;
  /** Extension: send a chat message to the room (any phase). */
  "chat:send": (p: { text: string }, ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  "rooms:list": (rooms: RoomListItem[]) => void;
  "room:state": (snapshot: Snapshot) => void;
  /** Extension: this socket was detached from its room (same player opened elsewhere). */
  "room:detached": () => void;
}
