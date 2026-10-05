export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const ROUNDS_PER_GAME = 8;
export const WRITING_SECONDS = 40;
export const VOTING_SECONDS = 20;
export const REVEAL_SECONDS_PER_OPTION = 4;
export const SCOREBOARD_SECONDS = 5;
export const TRUTH_POINTS = 1000;
export const FOOL_POINTS = 500;
export const MAX_LIE_LENGTH = 40;
export const MAX_NICKNAME_LENGTH = 16;

/** Game ends if fewer than MIN_PLAYERS are connected mid-game for this long. */
export const LOW_PLAYERS_TIMEOUT_SECONDS = 60;
/** A room with no connected players is deleted after this long. */
export const EMPTY_ROOM_TTL_SECONDS = 5 * 60;
/** Raw text payloads longer than this are rejected as malformed (before normalizing). */
export const MAX_RAW_TEXT_LENGTH = 500;
/** Debounce for sending drafts while typing. */
export const DRAFT_DEBOUNCE_MS = 300;
/** Chat: max message length (code points) and how many recent messages a room keeps. */
export const MAX_CHAT_LENGTH = 200;
export const CHAT_HISTORY = 50;
