import type { RoomListItem, Snapshot } from "@lorota/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx, setMusic, setMusicMood, soundsFor } from "./audio";
import { AudioToggles } from "./components/AudioToggles";
import { Chat } from "./components/Chat";
import { request, secondsLeft, session, socket, syncClock } from "./net";
import { GameOver } from "./screens/GameOver";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Reveal } from "./screens/Reveal";
import { Scoreboard } from "./screens/Scoreboard";
import { Voting } from "./screens/Voting";
import { Writing } from "./screens/Writing";
import { S, errorText } from "./strings";

const SFX_STAGGER_S = 0.12;

function codeFromPath(): string {
  const m = /^\/r\/([A-Za-z]{4})\/?$/.exec(window.location.pathname);
  return m ? m[1].toUpperCase() : "";
}

function setPath(path: string) {
  if (window.location.pathname !== path) window.history.replaceState(null, "", path);
}

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [notice, setNotice] = useState<string | null>(null);
  const [initialCode] = useState(codeFromPath);
  // The room we should be in; re-joined automatically on (re)connect.
  const roomRef = useRef<string | null>(initialCode && session.token(initialCode) ? initialCode : null);
  const [restoring, setRestoring] = useState(roomRef.current !== null);
  const prevRef = useRef<Snapshot | null>(null);

  const goHome = useCallback((message: string | null) => {
    roomRef.current = null;
    prevRef.current = null;
    session.setCurrent(null);
    setSnapshot(null);
    setRestoring(false);
    setNotice(message);
    setPath("/");
  }, []);

  const enterRoom = useCallback((code: string, token: string) => {
    roomRef.current = code;
    session.saveToken(code, token);
    session.setCurrent(code);
    setNotice(null);
    setPath(`/r/${code}`);
  }, []);

  useEffect(() => {
    const rejoin = async () => {
      const code = roomRef.current;
      const token = code && session.token(code);
      if (!code || !token) return;
      const res = await request<{ roomCode: string; playerToken: string }>("room:join", {
        roomCode: code,
        nickname: "",
        playerToken: token,
      });
      if (res.ok) enterRoom(res.roomCode, res.playerToken);
      else goHome(errorText(res.error));
      setRestoring(false);
    };
    const onConnect = () => {
      setConnected(true);
      prevRef.current = null; // first snapshot after a reconnect plays no effects
      void rejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (snap: Snapshot) => {
      if (roomRef.current !== snap.roomCode) return;
      syncClock(snap.serverNow);
      soundsFor(prevRef.current, snap, snap.you.id).forEach((name, i) =>
        playSfx(name, { delay: i * SFX_STAGGER_S }),
      );
      prevRef.current = snap;
      setSnapshot(snap);
    };
    const onDetached = () => goHome(S.detached);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("rooms:list", setRooms);
    socket.on("room:state", onState);
    socket.on("room:detached", onDetached);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("rooms:list", setRooms);
      socket.off("room:state", onState);
      socket.off("room:detached", onDetached);
    };
  }, [enterRoom, goHome]);

  // Music track follows the phase.
  const phase = snapshot?.phase ?? null;
  useEffect(() => {
    setMusic(phase === null || phase === "LOBBY" || phase === "GAME_OVER" ? "lobby" : "game");
  }, [phase]);

  // Clock-driven audio: ticks in the last 5 s, faster music in the last 10 s, ducking on reveal.
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  useEffect(() => {
    let lastKey = "";
    const id = setInterval(() => {
      const s = snapRef.current;
      const timed = s && (s.phase === "WRITING" || s.phase === "VOTING");
      const left = timed ? secondsLeft(s.phaseEndsAt) : 0;
      setMusicMood({ fast: !!timed && left > 0 && left <= 10, ducked: s?.phase === "REVEAL" });
      if (!timed || left < 1 || left > 5) return;
      const key = `${s.round?.number}-${s.phase}-${left}`;
      if (key === lastKey) return;
      lastKey = key;
      playSfx("tick", { final: left === 1 });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const createRoom = async (nickname: string) => {
    const res = await request<{ roomCode: string; playerToken: string }>("room:create", { nickname });
    if (!res.ok) return errorText(res.error);
    prevRef.current = null;
    enterRoom(res.roomCode, res.playerToken);
    return null;
  };

  const joinRoom = async (roomCode: string, nickname: string) => {
    const code = roomCode.trim().toUpperCase();
    const res = await request<{ roomCode: string; playerToken: string }>("room:join", {
      roomCode: code,
      nickname,
      playerToken: session.token(code) ?? undefined,
    });
    if (!res.ok) return errorText(res.error);
    prevRef.current = null;
    enterRoom(res.roomCode, res.playerToken);
    return null;
  };

  const leaveRoom = async () => {
    await request("room:leave", {});
    goHome(null);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("button")) playSfx("click");
  };

  let screen: React.ReactNode;
  if (restoring || (roomRef.current && !snapshot)) {
    screen = <p className="status-line">{S.connecting}</p>;
  } else if (!snapshot) {
    screen = (
      <Home
        rooms={rooms}
        initialCode={initialCode}
        notice={notice}
        onCreate={createRoom}
        onJoin={joinRoom}
      />
    );
  } else {
    switch (snapshot.phase) {
      case "LOBBY":
        screen = <Lobby snapshot={snapshot} onLeave={leaveRoom} />;
        break;
      case "WRITING":
        screen = <Writing key={snapshot.round?.number} snapshot={snapshot} />;
        break;
      case "VOTING":
        screen = <Voting key={snapshot.round?.number} snapshot={snapshot} />;
        break;
      case "REVEAL":
        screen = <Reveal snapshot={snapshot} />;
        break;
      case "SCOREBOARD":
        screen = <Scoreboard snapshot={snapshot} />;
        break;
      case "GAME_OVER":
        screen = <GameOver snapshot={snapshot} onLeave={leaveRoom} />;
        break;
    }
  }

  return (
    <div className="app" onClickCapture={onClickCapture}>
      <header className="topbar">
        <span className="logo">{S.appName}</span>
        <AudioToggles />
      </header>
      {!connected && <div className="banner">{snapshot ? S.reconnecting : S.connecting}</div>}
      <main className="screen">{screen}</main>
      {snapshot && !restoring && <Chat key={snapshot.roomCode} snapshot={snapshot} />}
    </div>
  );
}
