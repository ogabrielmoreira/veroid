export type Theme = 'light' | 'dark'
const KEY = 'veroid.theme'

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage indisponível */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* ignora */ }
}
