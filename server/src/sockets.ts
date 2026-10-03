// Socket.IO glue: maps sockets to players, validates payload shape, forwards intents
// to the RoomManager and pushes tailored snapshots / the room list back out.
import { MAX_RAW_TEXT_LENGTH } from "@lorota/shared";
import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@lorota/shared";
import type { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import type { Question } from "./questions";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const HOME = "home"; // Socket.IO room of sockets that are on the room list screen

interface Session {
  roomCode: string;
  playerId: string;
}

const isObject = (p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null;
const isText = (t: unknown): t is string => typeof t === "string" && t.length <= MAX_RAW_TEXT_LENGTH;

export function attachSockets(io: IO, questions: Question[]): RoomManager {
  const sessions = new Map<string, Session>(); // socket.id -> session
  const socketOf = new Map<string, ClientSocket>(); // player id -> socket

  const manager = new RoomManager({
    questions,
    onRoomChange: (room) => {
      for (const p of room.players) socketOf.get(p.id)?.emit("room:state", manager.snapshot(room, p.id));
    },
    onListChange: (list) => io.to(HOME).emit("rooms:list", list),
  });

  const detach = (socket: ClientSocket) => {
    const s = sessions.get(socket.id);
    if (!s) return null;
    sessions.delete(socket.id);
    if (socketOf.get(s.playerId) === socket) socketOf.delete(s.playerId);
    socket.join(HOME);
    return s;
  };

  const attach = (socket: ClientSocket, roomCode: string, playerId: string) => {
    const previous = socketOf.get(playerId);
    if (previous && previous !== socket) {
      // Same player opened in another tab: the newest connection wins.
      detach(previous);
      previous.emit("room:detached");
      previous.emit("rooms:list", manager.listRooms());
    }
    sessions.set(socket.id, { roomCode, playerId });
    socketOf.set(playerId, socket);
    socket.leave(HOME);
  };

  // Sent after the ack, so the client knows its room before the first snapshot arrives.
  const sendState = (socket: ClientSocket, roomCode: string, playerId: string) => {
    const room = manager.rooms.get(roomCode);
    if (room) socket.emit("room:state", manager.snapshot(room, playerId));
  };

  /** Leaves whatever room this socket is in before it creates or joins another. */
  const leaveCurrent = (socket: ClientSocket) => {
    const s = detach(socket);
    if (s) manager.leave(s.roomCode, s.playerId);
  };

  io.on("connection", (socket) => {
    socket.join(HOME);
    socket.emit("rooms:list", manager.listRooms());

    const reply = <T extends object>(ack: unknown, result: Ack<T>) => {
      if (typeof ack === "function") ack(result);
    };
    const session = () => sessions.get(socket.id);
    const notInRoom = { ok: false as const, error: "NOT_IN_ROOM" as const };

    socket.on("room:create", (p, ack) => {
      if (!isObject(p)) return reply(ack, { ok: false, error: "INVALID_PAYLOAD" });
      leaveCurrent(socket);
      const r = manager.createRoom(p.nickname);
      if (!r.ok) return reply(ack, r);
      attach(socket, r.room.code, r.player.id);
      reply(ack, { ok: true, roomCode: r.room.code, playerToken: r.player.token });
      sendState(socket, r.room.code, r.player.id);
    });

    socket.on("room:join", (p, ack) => {
      if (!isObject(p)) return reply(ack, { ok: false, error: "INVALID_PAYLOAD" });
      const current = session();
      const r = manager.joinRoom(p.roomCode, p.nickname, p.playerToken);
      if (!r.ok) return reply(ack, r);
      if (current && current.playerId !== r.player.id) {
        detach(socket);
        manager.leave(current.roomCode, current.playerId);
      }
      attach(socket, r.room.code, r.player.id);
      reply(ack, { ok: true, roomCode: r.room.code, playerToken: r.player.token });
      sendState(socket, r.room.code, r.player.id);
    });

    socket.on("room:leave", (_p, ack) => {
      const s = session();
      if (!s) return reply(ack, notInRoom);
      leaveCurrent(socket);
      socket.emit("rooms:list", manager.listRooms());
      reply(ack, { ok: true });
    });

    socket.on("game:start", (_p, ack) => {
      const s = session();
      reply(ack, s ? manager.startGame(s.roomCode, s.playerId) : notInRoom);
    });

    socket.on("lie:draft", (p) => {
      const s = session();
      if (s && isObject(p) && isText(p.text)) manager.draft(s.roomCode, s.playerId, p.text);
    });

    socket.on("lie:submit", (p, ack) => {
      const s = session();
      if (!s) return reply(ack, notInRoom);
      if (!isObject(p) || !isText(p.text)) return reply(ack, { ok: false, error: "INVALID_PAYLOAD" });
      reply(ack, manager.submitLie(s.roomCode, s.playerId, p.text));
    });

    socket.on("vote:submit", (p, ack) => {
      const s = session();
      if (!s) return reply(ack, notInRoom);
      if (!isObject(p) || typeof p.optionId !== "string") return reply(ack, { ok: false, error: "INVALID_PAYLOAD" });
      reply(ack, manager.vote(s.roomCode, s.playerId, p.optionId));
    });

    socket.on("game:playAgain", (_p, ack) => {
      const s = session();
      reply(ack, s ? manager.playAgain(s.roomCode, s.playerId) : notInRoom);
    });

    socket.on("disconnect", () => {
      const s = sessions.get(socket.id);
      sessions.delete(socket.id);
      if (!s || socketOf.get(s.playerId) !== socket) return;
      socketOf.delete(s.playerId);
      manager.disconnect(s.roomCode, s.playerId);
    });
  });

  return manager;
}
