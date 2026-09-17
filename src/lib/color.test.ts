import { describe, expect, it } from 'vitest'
import { checkContrast, contrastRatio, generateScale, normalizeHex } from './color'

describe('contraste', () => {
  it('preto x branco = 21', () => expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1))
  it('primária do DS passa AA contra branco', () => expect(checkContrast('#232C6B', '#FFFFFF').passes).toBe(true))
  it('#9198B5 não é cor de texto (≈3:1)', () => expect(checkContrast('#9198B5', '#FFFFFF').passes).toBe(false))
  it('amarelo claro falha e recebe sugestão que passa', () => {
    const c = checkContrast('#F5C400', '#FFFFFF')
    expect(c.passes).toBe(false)
    expect(c.suggestion).toBeDefined()
    expect(contrastRatio(c.suggestion!.hex, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('escala', () => {
  it('gera 10 passos do mais claro ao mais escuro', () => {
    const s = generateScale('#0A7C5A')
    const steps = Object.values(s)
    expect(steps).toHaveLength(10)
    for (let i = 1; i < steps.length; i++) expect(contrastRatio(steps[i], '#FFFFFF')).toBeGreaterThan(contrastRatio(steps[i - 1], '#FFFFFF'))
  })
  it('900 da escala tem contraste AA com branco e 50 com a tinta', () => {
    const s = generateScale('#E4572E')
    expect(contrastRatio(s[800], '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(s[50], '#10142B')).toBeGreaterThanOrEqual(4.5)
  })
  it('normaliza hex', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC')
    expect(normalizeHex('#12ab9f')).toBe('#12AB9F')
    expect(normalizeHex('xyz')).toBeNull()
  })
})
