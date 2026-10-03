// Socket connection, per-room session tokens and server clock offset.
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@lorota/shared";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

// Backend URL when the client is hosted separately (e.g. https://api.example.com).
// Unset = same origin, which is how dev (Vite proxy) and the single-process deploy work.
const SERVER_URL: string | undefined = import.meta.env.VITE_SERVER_URL || undefined;
// WebSocket first; fall back to HTTP long-polling where WebSockets are blocked.
const SOCKET_OPTIONS = { transports: ["websocket", "polling"], tryAllTransports: true };

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = SERVER_URL
  ? io(SERVER_URL, SOCKET_OPTIONS)
  : io(SOCKET_OPTIONS);

/** Emits an event with an ack, as a promise. Times out as a generic error. */
export function request<T extends object = object>(event: keyof ClientToServerEvents, payload: object): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket
      .timeout(8000)
      .emit(event as "game:start", payload, (err: Error | null, res: Ack) => {
        resolve(err ? { ok: false, error: "INVALID_PAYLOAD" } : (res as Ack<T>));
      });
  });
}

// ---- session storage: one token per room, plus the room we're currently in ----

const tokenKey = (code: string) => `lorota:token:${code}`;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const session = {
  token: (code: string) => safe(() => sessionStorage.getItem(tokenKey(code)), null),
  saveToken: (code: string, token: string) => safe(() => sessionStorage.setItem(tokenKey(code), token), undefined),
  current: () => safe(() => sessionStorage.getItem("lorota:room"), null),
  setCurrent: (code: string | null) =>
    safe(() => (code ? sessionStorage.setItem("lorota:room", code) : sessionStorage.removeItem("lorota:room")), undefined),
  nickname: () => safe(() => localStorage.getItem("lorota:nickname") ?? "", ""),
  saveNickname: (nick: string) => safe(() => localStorage.setItem("lorota:nickname", nick), undefined),
};

// ---- server clock ----

let clockOffset = 0;

export function syncClock(serverNow: number): void {
  clockOffset = serverNow - Date.now();
}

export function serverNow(): number {
  return Date.now() + clockOffset;
}

export function secondsLeft(phaseEndsAt: number | null): number {
  if (phaseEndsAt === null) return 0;
  return Math.max(0, Math.ceil((phaseEndsAt - serverNow()) / 1000));
}
