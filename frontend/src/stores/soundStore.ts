import { create } from 'zustand'

const STORAGE_KEY = 'crash-game:sound-muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

interface SoundState {
  muted: boolean
  toggleMuted: () => void
}

export const useSoundStore = create<SoundState>((set, get) => ({
  muted: readMuted(),
  toggleMuted: () => {
    const next = !get().muted
    set({ muted: next })
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // localStorage unavailable (private mode, etc.) — mute state just won't persist
    }
  },
}))
