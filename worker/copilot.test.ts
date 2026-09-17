import { describe, expect, it } from 'vitest'
import { buildAnthropicBody, parseVerdict } from './copilot'

describe('parseVerdict', () => {
  it('aceita JSON válido', () => {
    const v = parseVerdict('{"verdict":"screen_replay","confidence":0.92,"signals":[{"code":"moire_pattern","label":"Padrão de tela","weight":0.8}],"document_face_match":"not_applicable","explanation_pt":"Há moiré. Bordas de tela visíveis. Terceira frase."}', false)
    expect(v.verdict).toBe('screen_replay')
    expect(v.signals[0].code).toBe('moire_pattern')
    expect(v.explanation_pt).toBe('Há moiré. Bordas de tela visíveis.')
  })
  it('texto fora do JSON ou esquema errado vira uncertain', () => {
    expect(parseVerdict('Claro! Aqui está: nada', false).verdict).toBe('uncertain')
    expect(parseVerdict('{"verdict":"alien","confidence":0.9}', false).reason).toBe('invalid_schema')
    expect(parseVerdict('{"verdict":"animal","confidence":7}', false).verdict).toBe('uncertain')
  })
  it('fraude com baixa confiança vira revisão', () => {
    expect(parseVerdict('{"verdict":"printed_photo","confidence":0.3,"document_face_match":"match"}', true).verdict).toBe('uncertain')
  })
  it('sem documento, comparação é not_applicable', () => {
    expect(parseVerdict('{"verdict":"real_person","confidence":0.8,"document_face_match":"mismatch"}', false).document_face_match).toBe('not_applicable')
  })
})

describe('buildAnthropicBody', () => {
  it('monta imagens com rótulo e pede só JSON', () => {
    const b = buildAnthropicBody('claude-haiku-4-5-20251001', [{ kind: 'selfie', base64: 'AAA' }])
    expect(b.temperature).toBe(0)
    expect(JSON.stringify(b.messages)).toContain('"media_type":"image/jpeg"')
  })
})

import { isSafeWebhookUrl } from './webhooks'
describe('webhook', () => {
  it('só aceita HTTPS público', () => {
    expect(isSafeWebhookUrl('https://crm.exemplo.com/hook')).toBe(true)
    expect(isSafeWebhookUrl('http://crm.exemplo.com/hook')).toBe(false)
    expect(isSafeWebhookUrl('https://localhost/hook')).toBe(false)
    expect(isSafeWebhookUrl('https://10.0.0.5/hook')).toBe(false)
  })
})
