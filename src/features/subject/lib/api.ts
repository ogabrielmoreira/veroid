import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export interface StoredSession { session_id: string; secret: string; savedAt: number }

const key = (token: string) => `veroid.s.${token.slice(0, 10)}`
const MAX_AGE = 6 * 3600_000

/** Guarda só o identificador e o segredo da sessão (nenhum dado pessoal) para retomar se a página fechar. */
export function loadStoredSession(token: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(token))
    if (!raw) return null
    const s = JSON.parse(raw) as StoredSession
    if (Date.now() - s.savedAt > MAX_AGE) { localStorage.removeItem(key(token)); return null }
    return s
  } catch { return null }
}
export function saveStoredSession(token: string, s: Omit<StoredSession, 'savedAt'>) {
  try { localStorage.setItem(key(token), JSON.stringify({ ...s, savedAt: Date.now() })) } catch { /* modo privado */ }
}
export function clearStoredSession(token: string) {
  try { localStorage.removeItem(key(token)); sessionStorage.removeItem(`${key(token)}.form`) } catch { /* ignora */ }
}
/** Rascunho do formulário: sessionStorage (some ao fechar a aba; nunca localStorage). */
export function loadFormDraft(token: string): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(`${key(token)}.form`) ?? '{}') } catch { return {} }
}
export function saveFormDraft(token: string, data: Record<string, string>) {
  try { sessionStorage.setItem(`${key(token)}.form`, JSON.stringify(data)) } catch { /* ignora */ }
}

export class SubjectApi {
  constructor(public token: string, public sessionId: string, public secret: string) {}

  static async start(token: string, device: Record<string, string>) {
    const { data, error } = await supabase.rpc('start_subject_session', { p_token: token, p_device: device })
    if (error) throw error
    const d = data as { session_id: string; secret: string }
    saveStoredSession(token, d)
    return new SubjectApi(token, d.session_id, d.secret)
  }

  async resume() {
    const { data, error } = await supabase.rpc('resume_subject_session', { p_token: this.token, p_session_id: this.sessionId, p_secret: this.secret })
    if (error) throw error
    return data as { status: string; current_step: string | null; consented: boolean; media: string[] }
  }

  /** Eventos de funil: falha silenciosa, nunca bloqueia o titular. */
  event(type: string, payload: Record<string, unknown> = {}) {
    void supabase.rpc('log_subject_event', { p_token: this.token, p_session_id: this.sessionId, p_secret: this.secret, p_type: type, p_payload: payload })
      .then(({ error }) => { if (error && import.meta.env.DEV) console.warn('[event]', type, error.message) })
  }

  async consent(biometric: boolean, marketing: boolean, version: string) {
    const { error } = await supabase.rpc('record_subject_consent', {
      p_token: this.token, p_session_id: this.sessionId, p_secret: this.secret, p_biometric: biometric, p_marketing: marketing, p_version: version,
    })
    if (error) throw error
  }

  async upload(kind: 'selfie' | 'doc_front' | 'doc_back', blob: Blob) {
    const { data: path, error } = await supabase.rpc('register_subject_media', { p_token: this.token, p_session_id: this.sessionId, p_secret: this.secret, p_kind: kind })
    if (error) throw error
    const up = await supabase.storage.from('media').upload(path as string, blob, { contentType: 'image/jpeg', upsert: false })
    if (up.error) throw up.error
  }

  async submit(data: Record<string, string>, browserSignals: string[]) {
    const { error } = await supabase.rpc('submit_subject_session', {
      p_token: this.token, p_session_id: this.sessionId, p_secret: this.secret, p_data: data, p_browser_signals: browserSignals,
    })
    if (error) throw error
    // Copiloto (Claude Vision) no Worker: dispara e esquece. Sem chave configurada, a análise fica só nas regras.
    void fetch(`${env.basePath}/api/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: this.token, session_id: this.sessionId, secret: this.secret }),
      keepalive: true,
    }).catch(() => undefined)
  }
}

export async function deviceInfo(): Promise<Record<string, string>> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const screenStr = `${screen.width}x${screen.height}@${window.devicePixelRatio}`
  const raw = [navigator.userAgent, screenStr, tz, navigator.language, navigator.hardwareConcurrency ?? ''].join('|')
  let fingerprint = ''
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    fingerprint = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { /* contexto sem subtle crypto */ }
  // Sinal fraco (§3.6): hash simples, não identifica pessoa.
  return { fingerprint, locale: navigator.language, user_agent: navigator.userAgent.slice(0, 300), tz, screen: screenStr }
}

export function subjectErrorKey(e: unknown): string {
  const m = (e as { message?: string })?.message ?? ''
  if (m.includes('link_closed')) return 'subject.errors.linkClosed'
  if (m.includes('session_limit')) return 'subject.errors.sessionLimit'
  if (m.includes('session_submitted')) return 'subject.errors.alreadySubmitted'
  if (m.includes('session_not_found')) return 'subject.errors.sessionLost'
  if (m.includes('invalid_cpf')) return 'subject.form.errors.cpf'
  if (m.includes('missing_field')) return 'subject.errors.missingField'
  if (m.includes('selfie_required')) return 'subject.errors.selfieRequired'
  if (m.includes('document_required')) return 'subject.errors.documentRequired'
  if (m.toLowerCase().includes('fetch') || m.toLowerCase().includes('network')) return 'errors.network'
  return 'errors.generic'
}
