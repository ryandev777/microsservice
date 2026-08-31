import { useSoundStore } from '@/stores/soundStore'

/**
 * All sound effects are synthesized via the Web Audio API instead of shipping
 * audio files — avoids bundling binary assets for a handful of short beeps
 * and keeps the game's audio license-free.
 */
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  return audioCtx
}

interface ToneOptions {
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone(freq: number, duration: number, { type = 'sine', gain = 0.15, delay = 0 }: ToneOptions = {}) {
  if (useSoundStore.getState().muted) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)

  gainNode.gain.setValueAtTime(0, t0)
  gainNode.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export const sounds = {
  /** Short confirming blip when a bet is placed. */
  bet: () => tone(440, 0.12, { type: 'triangle', gain: 0.12 }),
  /** Ascending three-note chime for a cash out / win. */
  win: () => {
    tone(523.25, 0.15, { type: 'sine', gain: 0.18 })
    tone(659.25, 0.15, { type: 'sine', gain: 0.16, delay: 0.08 })
    tone(783.99, 0.28, { type: 'sine', gain: 0.16, delay: 0.16 })
  },
  /** Descending low thud for a crash / loss. */
  crash: () => {
    tone(180, 0.35, { type: 'sawtooth', gain: 0.2 })
    tone(90, 0.45, { type: 'sawtooth', gain: 0.18, delay: 0.05 })
  },
}
