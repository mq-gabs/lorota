import { MAX_CHAT_LENGTH } from "@lorota/shared";
import type { Snapshot } from "@lorota/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { request, toLocalTime } from "../net";
import { S, errorText } from "../strings";

/** Room chat, shown under every in-room screen. Messages come from the snapshot. */
export function Chat({ snapshot }: { snapshot: Snapshot }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);
  const { chat } = snapshot;
  const lastId = chat.at(-1)?.id;

  // Follow new messages unless the reader scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const res = await request("chat:send", { text });
    setBusy(false);
    if (res.ok) {
      setText("");
      setError(null);
      stickToBottom.current = true;
    } else {
      setError(errorText(res.error));
    }
  };

  return (
    <section className="card chat">
      <h2>{S.chat}</h2>
      {chat.length === 0 ? (
        <p className="empty">{S.chatEmpty}</p>
      ) : (
        <ol
          ref={listRef}
          className="chat-list"
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {chat.map((m) => (
            <li key={m.id} className={m.authorId === snapshot.you.id ? "mine" : ""}>
              <span className="chat-meta">
                <span className="chat-name">{m.nickname}</span>
                <time dateTime={new Date(m.sentAt).toISOString()}>{S.chatTime(toLocalTime(m.sentAt))}</time>
              </span>
              <span className="chat-text">{m.text}</span>
            </li>
          ))}
        </ol>
      )}
      <form className="chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-input">
          {S.chatLabel}
        </label>
        <input
          id="chat-input"
          className="chat-input"
          value={text}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={S.chatPlaceholder}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn small" disabled={busy || !text.trim()}>
          {S.send}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
