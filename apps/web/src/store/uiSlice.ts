import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type ThemePreference = 'light' | 'dark' | 'system'

interface UiState {
  theme: ThemePreference
  systemDark: boolean
  paletteOpen: boolean
}

function initialTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem('finpilot-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function initialSystemDark(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: initialTheme(), systemDark: initialSystemDark(), paletteOpen: false } as UiState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload
    },
    setSystemDark(state, action: PayloadAction<boolean>) {
      state.systemDark = action.payload
    },
    setPaletteOpen(state, action: PayloadAction<boolean>) {
      state.paletteOpen = action.payload
    },
  },
})

export const { setTheme, setSystemDark, setPaletteOpen } = uiSlice.actions
export default uiSlice.reducer

/** The theme actually applied: the explicit choice, or the operating system's when set to "system". */
export const selectResolvedTheme = (s: { ui: UiState }): 'light' | 'dark' =>
  s.ui.theme === 'system' ? (s.ui.systemDark ? 'dark' : 'light') : s.ui.theme
