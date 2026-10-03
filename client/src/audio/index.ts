// The only module that touches the Web Audio API. Swapping the synth for recorded
// files later only means changing this folder. Everything here fails silently.
import { Sequencer } from "./music";
import { playRecipe } from "./sfx";
import type { SfxOptions } from "./sfx";
import type { SfxName } from "./soundsFor";
import { TRACKS } from "./tracks";
import type { TrackName } from "./tracks";

export type { SfxName } from "./soundsFor";
export { soundsFor } from "./soundsFor";
export type { TrackName } from "./tracks";

const MUSIC_LEVEL = 0.25;
const SFX_LEVEL = 0.6;
const DUCK_LEVEL = 0.3;
const CROSSFADE_S = 0.3;
const FAST_TEMPO = 1.15;
const STORAGE_MUSIC = "lorota:music";
const STORAGE_SFX = "lorota:sfx";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // storage unavailable: the setting just isn't remembered
  }
}

const AudioCtor: typeof AudioContext | undefined =
  typeof window === "undefined"
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let duckBus: GainNode | null = null;
let sfxBus: GainNode | null = null;

let musicEnabled = readFlag(STORAGE_MUSIC);
let sfxEnabled = readFlag(STORAGE_SFX);
let wantedTrack: TrackName | null = null;
let playingTrack: TrackName | null = null;
let sequencer: Sequencer | null = null;
let fast = false;
let ducked = false;

function ensureContext(): AudioContext | null {
  if (ctx || !AudioCtor) return ctx;
  try {
    ctx = new AudioCtor();
    musicBus = ctx.createGain();
    musicBus.gain.value = musicEnabled ? MUSIC_LEVEL : 0;
    duckBus = ctx.createGain();
    duckBus.gain.value = ducked ? DUCK_LEVEL : 1;
    duckBus.connect(musicBus).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function running(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

/** Starts / switches / stops the sequencer to match the wanted state. */
function syncMusic(): void {
  const c = running();
  const target = c && musicEnabled ? wantedTrack : null;
  if (target === playingTrack) return;
  sequencer?.stop(CROSSFADE_S);
  sequencer = null;
  playingTrack = target;
  if (c && target && duckBus) {
    sequencer = new Sequencer(c, duckBus, TRACKS[target]);
    sequencer.tempoScale = fast ? FAST_TEMPO : 1;
    sequencer.start(CROSSFADE_S);
  }
}

function unlock(): void {
  const c = ensureContext();
  if (!c) return;
  if (c.state !== "running" && !document.hidden) {
    c.resume().then(syncMusic, () => {});
  } else {
    syncMusic();
  }
}

if (typeof window !== "undefined") {
  // Browsers only allow audio after a user gesture.
  for (const ev of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
  // Suspending freezes currentTime, so the sequencer pauses in place and resumes in tempo.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().then(syncMusic, () => {});
  });
}

export function playSfx(name: SfxName, opts?: SfxOptions & { delay?: number }): void {
  const c = running();
  if (!c || !sfxEnabled || !sfxBus) return;
  try {
    playRecipe(c, sfxBus, name, c.currentTime + 0.01 + (opts?.delay ?? 0), opts);
  } catch {
    // never let audio break the game
  }
}

export function setMusic(track: TrackName | null): void {
  wantedTrack = track;
  try {
    syncMusic();
  } catch {
    // ignore
  }
}

export function setMusicEnabled(on: boolean): void {
  musicEnabled = on;
  writeFlag(STORAGE_MUSIC, on);
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, ctx.currentTime, 0.05);
  syncMusic();
}

export function setSfxEnabled(on: boolean): void {
  sfxEnabled = on;
  writeFlag(STORAGE_SFX, on);
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

/** Speeds the music up (last seconds of a timed phase) and/or ducks it (reveal). */
export function setMusicMood(mood: { fast: boolean; ducked: boolean }): void {
  fast = mood.fast;
  if (sequencer) sequencer.tempoScale = fast ? FAST_TEMPO : 1;
  if (mood.ducked !== ducked) {
    ducked = mood.ducked;
    if (duckBus && ctx) duckBus.gain.setTargetAtTime(ducked ? DUCK_LEVEL : 1, ctx.currentTime, 0.1);
  }
}
