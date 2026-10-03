import { MAX_NICKNAME_LENGTH } from "@lorota/shared";
import type { RoomListItem } from "@lorota/shared";
import { useRef, useState } from "react";
import { session } from "../net";
import { S } from "../strings";

interface Props {
  rooms: RoomListItem[];
  initialCode: string;
  notice: string | null;
  onCreate: (nickname: string) => Promise<string | null>;
  onJoin: (roomCode: string, nickname: string) => Promise<string | null>;
}

export function Home({ rooms, initialCode, notice, onCreate, onJoin }: Props) {
  const [nickname, setNickname] = useState(session.nickname);
  const [code, setCode] = useState(initialCode);
  const [nickError, setNickError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const withNickname = async (action: (nick: string) => Promise<string | null>) => {
    const nick = nickname.trim();
    if (!nick) {
      setNickError(S.chooseNickname);
      nickRef.current?.focus();
      return;
    }
    session.saveNickname(nick);
    setBusy(true);
    setError(null);
    const err = await action(nick);
    setBusy(false);
    if (err) setError(err);
  };

  const joinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return void withNickname(async () => null);
    if (code.trim().length !== 4) {
      setError(S.enterRoomCode);
      codeRef.current?.focus();
      return;
    }
    void withNickname((nick) => onJoin(code, nick));
  };

  return (
    <div className="home">
      <p className="tagline">{S.tagline}</p>

      <section className="card">
        <label className="field">
          <span>{S.nicknameLabel}</span>
          <input
            ref={nickRef}
            value={nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            placeholder={S.nicknamePlaceholder}
            autoComplete="nickname"
            aria-invalid={!!nickError}
            onChange={(e) => {
              setNickname(e.target.value);
              if (e.target.value.trim()) setNickError(null);
            }}
          />
        </label>
        {nickError && <p className="field-error">{nickError}</p>}

        <button type="button" className="btn primary wide" disabled={busy} onClick={() => withNickname(onCreate)}>
          {S.createRoom}
        </button>

        <form className="code-row" onSubmit={joinByCode}>
          <label className="field">
            <span>{S.roomCodeLabel}</span>
            <input
              ref={codeRef}
              value={code}
              maxLength={4}
              placeholder={S.roomCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
              className="code-input"
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
            />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {S.join}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>{S.openRooms}</h2>
        {rooms.length === 0 ? (
          <p className="empty">{S.noRooms}</p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => {
              const full = r.playerCount >= r.maxPlayers;
              const joinable = r.state === "LOBBY" && !full;
              return (
                <li key={r.roomCode} className={joinable ? "" : "closed"}>
                  <div className="room-info">
                    <span className="room-code">{r.roomCode}</span>
                    <span className="room-host">{S.roomOf(r.hostNickname)}</span>
                    <span className="room-meta">
                      {S.playerCount(r.playerCount, r.maxPlayers)} ·{" "}
                      {r.state === "LOBBY" ? S.inLobby : S.playing}
                    </span>
                  </div>
                  {joinable ? (
                    <button
                      type="button"
                      className="btn small"
                      disabled={busy}
                      onClick={() => withNickname((nick) => onJoin(r.roomCode, nick))}
                    >
                      {S.join}
                    </button>
                  ) : (
                    r.state === "LOBBY" && <span className="tag">{S.errors.ROOM_FULL}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
