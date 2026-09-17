/** Utilitários de cor: contraste WCAG e geração de escala 50–900 em OKLCH (§6). */

export type Hex = `#${string}`
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type ScaleStep = (typeof SCALE_STEPS)[number]
export type Scale = Record<ScaleStep, string>

export function normalizeHex(v: string): string | null {
  const s = v.trim().replace(/^#?/, '#')
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map((c) => c + c).join('')).toUpperCase()
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase()
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? '#000000'
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

const toLinear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const fromLinear = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/* ---- OKLCH ---- */
function rgbToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.sqrt(A * A + B * B)
  const H = (Math.atan2(B, A) * 180) / Math.PI
  return [L, C, H < 0 ? H + 360 : H]
}

function oklchToRgbRaw(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180
  const A = C * Math.cos(h)
  const B = C * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function oklchToHex(L: number, C: number, H: number): string {
  // reduz croma até caber no gamut sRGB
  let c = C
  for (let i = 0; i < 24; i++) {
    const rgb = oklchToRgbRaw(L, c, H)
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return rgbToHex(rgb.map(fromLinear) as [number, number, number])
    c *= 0.9
  }
  return rgbToHex(oklchToRgbRaw(L, 0, H).map(fromLinear) as [number, number, number])
}

// Luminosidade-alvo por passo (calibrada na escala indigo do DS) e fator de croma nos extremos
const L_TARGET: Record<ScaleStep, number> = { 50: 0.968, 100: 0.925, 200: 0.85, 300: 0.745, 400: 0.64, 500: 0.535, 600: 0.465, 700: 0.4, 800: 0.335, 900: 0.25 }
const C_FACTOR: Record<ScaleStep, number> = { 50: 0.12, 100: 0.25, 200: 0.5, 300: 0.75, 400: 0.92, 500: 1, 600: 1, 700: 0.92, 800: 0.8, 900: 0.62 }

export function generateScale(base: string): Scale {
  const [, C, H] = rgbToOklch(base)
  const chroma = Math.max(C, 0.02)
  const out = {} as Scale
  for (const step of SCALE_STEPS) out[step] = oklchToHex(L_TARGET[step], chroma * C_FACTOR[step], H)
  return out
}

export interface ContrastCheck {
  ratio: number
  passes: boolean
  /** Passo mais próximo da escala que passa, quando a cor original falha */
  suggestion?: { step: ScaleStep; hex: string; ratio: number }
}

/**
 * Testa `color` contra `against` com mínimo `min` (4.5 texto / 3 UI).
 * Se falhar, sugere o passo da escala gerada mais próximo em luminosidade que passa.
 */
export function checkContrast(color: string, against: string, min = 4.5): ContrastCheck {
  const ratio = contrastRatio(color, against)
  if (ratio >= min) return { ratio, passes: true }
  const scale = generateScale(color)
  const baseL = rgbToOklch(color)[0]
  const candidates = SCALE_STEPS.map((step) => ({ step, hex: scale[step], ratio: contrastRatio(scale[step], against) }))
    .filter((c) => c.ratio >= min)
    .sort((a, b) => Math.abs(rgbToOklch(a.hex)[0] - baseL) - Math.abs(rgbToOklch(b.hex)[0] - baseL))
  return { ratio, passes: false, suggestion: candidates[0] }
}

export function formatRatio(r: number) {
  return `${(Math.floor(r * 100) / 100).toFixed(2)}:1`
}
