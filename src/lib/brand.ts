import type { CSSProperties } from 'react'
import { generateScale, normalizeHex, SCALE_STEPS } from './color'

export const FONT_OPTIONS = [
  'Libre Franklin', 'Geist', 'Plus Jakarta Sans', 'IBM Plex Sans', 'Work Sans', 'Figtree', 'Manrope', 'Atkinson Hyperlegible',
] as const
export type FontOption = (typeof FONT_OPTIONS)[number]

export type RadiusSet = 'straight' | 'soft' | 'rounded'
export const RADIUS_SETS: Record<RadiusSet, { sm: number; md: number; lg: number }> = {
  straight: { sm: 0, md: 2, lg: 6 },
  soft: { sm: 4, md: 6, lg: 12 },
  rounded: { sm: 8, md: 12, lg: 20 },
}

export interface BrandKit {
  primary?: string
  secondary?: string
  accent?: string
  font_display?: FontOption
  font_text?: FontOption
  radius?: RadiusSet
  tone?: 'formal' | 'friendly'
  logo_light_url?: string
  logo_dark_url?: string
}

export const DEFAULT_BRAND: Required<Omit<BrandKit, 'logo_light_url' | 'logo_dark_url'>> = {
  primary: '#232C6B',
  secondary: '#3742A8',
  accent: '#4756C9',
  font_display: 'Libre Franklin',
  font_text: 'Geist',
  radius: 'soft',
  tone: 'friendly',
}

export function resolveBrand(kit: BrandKit | null | undefined) {
  const k = { ...DEFAULT_BRAND, ...(kit ?? {}) }
  return {
    ...k,
    primary: normalizeHex(k.primary) ?? DEFAULT_BRAND.primary,
    secondary: normalizeHex(k.secondary) ?? DEFAULT_BRAND.secondary,
    accent: normalizeHex(k.accent) ?? DEFAULT_BRAND.accent,
  }
}

/**
 * CSS variables do tenant (§6): escala 50–900 a partir da primária, primária = cor escolhida,
 * destaque = accent, raio do conjunto. Tokens semânticos de risco nunca são tocados.
 */
export function brandCssVars(kit: BrandKit | null | undefined): CSSProperties {
  const b = resolveBrand(kit)
  const scale = generateScale(b.primary)
  const accentScale = generateScale(b.accent)
  const r = RADIUS_SETS[b.radius]
  const vars: Record<string, string> = {
    '--brand-primary-light': b.primary,
    '--brand-accent-light': b.accent,
    '--brand-secondary': b.secondary,
    '--radius-sm': `${r.sm}px`,
    '--radius-md': `${r.md}px`,
    '--radius-lg': `${r.lg}px`,
    '--font-display': `'${b.font_display}', system-ui, sans-serif`,
    '--font-text': `'${b.font_text}', system-ui, sans-serif`,
  }
  for (const step of SCALE_STEPS) vars[`--brand-${step}`] = scale[step]
  vars['--brand-500'] = accentScale[500]
  return vars as CSSProperties
}

/** Carrega do Google Fonts só as famílias aprovadas que ainda não estão na página. */
export function loadBrandFonts(fonts: Array<string | undefined>) {
  const wanted = [...new Set(fonts.filter((f): f is FontOption => FONT_OPTIONS.includes(f as FontOption)))]
  for (const family of wanted) {
    const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
    document.head.appendChild(link)
  }
}
