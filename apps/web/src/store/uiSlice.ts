import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Theme = 'light' | 'dark'

interface UiState {
  theme: Theme
  mobileNavOpen: boolean
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('finpilot-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable */
  }
  return 'light'
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: initialTheme(), mobileNavOpen: false } as UiState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload
    },
    toggleMobileNav(state) {
      state.mobileNavOpen = !state.mobileNavOpen
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false
    },
  },
})

export const { setTheme, toggleMobileNav, closeMobileNav } = uiSlice.actions
export default uiSlice.reducer
