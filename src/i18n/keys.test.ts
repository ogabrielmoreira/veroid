import { describe, expect, it } from 'vitest'
import en from './en.json'
import ptBR from './pt-BR.json'

/** Paridade de chaves entre os idiomas (§11): nenhuma tela pode ficar sem tradução num dos dois. */
function flatten(o: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) return flatten(v as Record<string, unknown>, path)
    return [path]
  })
}

describe('i18n', () => {
  it('pt-BR e en têm exatamente as mesmas chaves', () => {
    const a = new Set(flatten(ptBR))
    const b = new Set(flatten(en))
    const onlyPt = [...a].filter((k) => !b.has(k))
    const onlyEn = [...b].filter((k) => !a.has(k))
    expect(onlyPt, `chaves só em pt-BR: ${onlyPt.join(', ')}`).toHaveLength(0)
    expect(onlyEn, `chaves só em en: ${onlyEn.join(', ')}`).toHaveLength(0)
  })

  it('nenhum valor de string fica vazio', () => {
    for (const [name, dict] of [['pt-BR', ptBR], ['en', en]] as const) {
      const empties = flatten(dict).filter((path) => {
        const value = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], dict)
        return typeof value === 'string' && value.trim() === ''
      })
      expect(empties, `${name} tem valores vazios em: ${empties.join(', ')}`).toHaveLength(0)
    }
  })
})
