/**
 * Copiloto Antifraude — camada 2 (Claude Vision).
 * Funções puras para montar o pedido e validar a resposta; o I/O fica em analyze.ts.
 */

export const VERDICTS = ['real_person', 'screen_replay', 'printed_photo', 'mask_or_doll', 'animal', 'object_or_no_face', 'multiple_faces', 'uncertain'] as const
export type Verdict = (typeof VERDICTS)[number]
export const DOC_MATCH = ['match', 'mismatch', 'not_applicable', 'uncertain'] as const

export interface AiVerdict {
  verdict: Verdict
  confidence: number
  signals: Array<{ code: string; label: string; weight: number }>
  document_face_match: (typeof DOC_MATCH)[number]
  explanation_pt: string
  model?: string
  reason?: string
}

export const SYSTEM_PROMPT = `Você é um analista antifraude de verificação de identidade (KYC) num protótipo de demonstração.
Recebe a selfie capturada no navegador e, quando houver, frente e verso de um documento brasileiro.
Avalie apenas o que está visível. Não identifique a pessoa, não estime raça, etnia, religião ou saúde.
Procure: padrão moiré, bordas ou reflexo de tela (screen_replay); textura de papel, dobras ou bordas de foto impressa (printed_photo);
máscara, boneco ou manequim (mask_or_doll); animal; objeto ou ausência de rosto; mais de um rosto.
Se houver documento, compare o rosto da selfie com a foto do documento apenas quanto a compatibilidade visual.
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, no formato:
{"verdict":"real_person|screen_replay|printed_photo|mask_or_doll|animal|object_or_no_face|multiple_faces|uncertain","confidence":0.0,"signals":[{"code":"snake_case","label":"frase curta em português","weight":0.0}],"document_face_match":"match|mismatch|not_applicable|uncertain","explanation_pt":"até 2 frases em português"}
Use "uncertain" quando a imagem não permitir concluir. confidence e weight entre 0 e 1.`

export function uncertain(reason: string): AiVerdict {
  return { verdict: 'uncertain', confidence: 0, signals: [], document_face_match: 'uncertain', explanation_pt: 'Análise por IA indisponível; a sessão segue para revisão manual.', reason }
}

/** Valida e normaliza a resposta do modelo. Qualquer desvio vira "uncertain" (§7). */
export function parseVerdict(text: string, hasDocument: boolean): AiVerdict {
  const match = text.trim().match(/\{[\s\S]*\}$/)
  if (!match) return uncertain('invalid_json')
  let raw: Record<string, unknown>
  try { raw = JSON.parse(match[0]) } catch { return uncertain('invalid_json') }

  const verdict = VERDICTS.includes(raw.verdict as Verdict) ? (raw.verdict as Verdict) : null
  const confidence = typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : null
  if (!verdict || confidence === null) return uncertain('invalid_schema')

  const signals = Array.isArray(raw.signals)
    ? raw.signals
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .slice(0, 8)
        .map((s) => ({
          code: String(s.code ?? '').replace(/[^a-z0-9_]/gi, '').slice(0, 40) || 'signal',
          label: String(s.label ?? '').slice(0, 120),
          weight: Math.min(1, Math.max(0, Number(s.weight) || 0)),
        }))
    : []

  const docRaw = raw.document_face_match as string
  const document_face_match = !hasDocument ? 'not_applicable' : DOC_MATCH.includes(docRaw as (typeof DOC_MATCH)[number]) ? (docRaw as AiVerdict['document_face_match']) : 'uncertain'
  const explanation_pt = String(raw.explanation_pt ?? '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 400)

  // Baixa confiança num veredito de fraude não acusa ninguém: vira revisão
  const finalVerdict: Verdict = verdict !== 'real_person' && verdict !== 'uncertain' && confidence < 0.5 ? 'uncertain' : verdict
  return { verdict: finalVerdict, confidence, signals, document_face_match, explanation_pt }
}

export function buildAnthropicBody(model: string, images: Array<{ kind: string; base64: string }>) {
  const content: unknown[] = []
  for (const img of images) {
    content.push({ type: 'text', text: img.kind === 'selfie' ? 'Selfie:' : img.kind === 'doc_front' ? 'Documento (frente):' : 'Documento (verso):' })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 } })
  }
  content.push({ type: 'text', text: 'Analise e responda só com o JSON.' })
  return { model, max_tokens: 600, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: 'user', content }] }
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}
