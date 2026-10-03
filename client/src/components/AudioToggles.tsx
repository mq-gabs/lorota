import { useState } from "react";
import { isMusicEnabled, isSfxEnabled, setMusicEnabled, setSfxEnabled } from "../audio";
import { S } from "../strings";

export function AudioToggles() {
  const [music, setMusic] = useState(isMusicEnabled);
  const [sfx, setSfx] = useState(isSfxEnabled);
  return (
    <div className="audio-toggles">
      <button
        type="button"
        className={`toggle ${music ? "on" : "off"}`}
        aria-pressed={music}
        onClick={() => {
          setMusicEnabled(!music);
          setMusic(!music);
        }}
      >
        <span className="dot" aria-hidden="true" /> {S.music}
      </button>
      <button
        type="button"
        className={`toggle ${sfx ? "on" : "off"}`}
        aria-pressed={sfx}
        onClick={() => {
          setSfxEnabled(!sfx);
          setSfx(!sfx);
        }}
      >
        <span className="dot" aria-hidden="true" /> {S.effects}
      </button>
    </div>
  );
}
