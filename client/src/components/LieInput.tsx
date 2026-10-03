import { DRAFT_DEBOUNCE_MS, MAX_LIE_LENGTH, charLength, formatLive, normalize } from "@lorota/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { S } from "../strings";

interface Props {
  onDraft: (text: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

/** Answer input that shows exactly what others will see while you type (spec 2.3). */
export function LieInput({ onDraft, onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const [caretTick, setCaretTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const caret = useRef<number | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && caret.current !== null && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [caretTick]);

  useEffect(() => () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
  }, []);

  const apply = (raw: string, rawCaret: number | null) => {
    const formatted = formatLive(raw);
    // Caret goes where the formatted text-before-the-caret ends.
    caret.current = rawCaret === null ? formatted.length : Math.min(formatLive(raw.slice(0, rawCaret)).length, formatted.length);
    setValue(formatted);
    setCaretTick((t) => t + 1);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => onDraft(formatted), DRAFT_DEBOUNCE_MS);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftTimer.current) clearTimeout(draftTimer.current);
    onSubmit(value);
  };

  return (
    <form className="lie-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="lie">
        {S.lieLabel}
      </label>
      <input
        id="lie"
        ref={inputRef}
        className="lie-input"
        value={value}
        placeholder={S.liePlaceholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        disabled={disabled}
        autoFocus
        onChange={(e) => {
          const raw = e.target.value;
          if (composing.current || (e.nativeEvent as InputEvent).isComposing) {
            setValue(raw); // don't break dead keys / IME mid-composition
            return;
          }
          apply(raw, e.target.selectionStart);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          apply(e.currentTarget.value, e.currentTarget.selectionStart);
        }}
      />
      <div className="lie-row">
        <span className="counter">
          {charLength(normalize(value))}/{MAX_LIE_LENGTH}
        </span>
        <button type="submit" className="btn primary" disabled={disabled}>
          {S.send}
        </button>
      </div>
    </form>
  );
}
