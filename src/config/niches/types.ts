export type NicheSlug =
  | 'fintech' | 'credit' | 'agro' | 'automotive'
  | 'real-estate' | 'telecom' | 'marketplace' | 'insurance'
  | 'crypto' | 'health' | 'events' | 'education' | 'betting'

export type FlowStep = 'intro' | 'consent' | 'tutorial' | 'capture' | 'document' | 'form' | 'review' | 'done'

export type FieldType = 'cpf' | 'cnpj' | 'text' | 'date' | 'cep' | 'currency' | 'number' | 'select' | 'phone'

export interface NicheField {
  key: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
}

export interface RiskRule {
  code: string
  label: string
  /** Peso somado ao Score de Risco (0–100) quando a regra dispara. */
  weight: number
  /** Decisão mínima forçada pela regra, independente do score. */
  forces?: 'review'
}

export interface NicheConfig {
  slug: NicheSlug
  label: string
  description: string
  /** Nome do ícone do conjunto base (§2.11) */
  icon: 'bank' | 'contract' | 'leaf' | 'car' | 'home' | 'signal' | 'store' | 'shield' | 'coin' | 'health' | 'ticket' | 'book' | 'lock'
  priority: 1 | 2 | 'restricted'
  enabledByDefault: boolean
  examples: string[]
  subniches?: string[]
  fields: NicheField[]
  flowSteps: FlowStep[]
  riskRules: RiskRule[]
  kpis: string[]
  consentCopy: { purpose: string; retention: string }
  compliance?: string[]
  seedProfile?: { sessions: number; fraudRate: number; topUfs: string[] }
}

export const BASE_STEPS: FlowStep[] = ['intro', 'consent', 'tutorial', 'capture', 'form', 'review', 'done']
export const WITH_DOCUMENT: FlowStep[] = ['intro', 'consent', 'tutorial', 'capture', 'document', 'form', 'review', 'done']

export const CPF: NicheField = { key: 'cpf', label: 'CPF', type: 'cpf', required: true }
export const NAME: NicheField = { key: 'name', label: 'Nome completo', type: 'text', required: true }
export const BIRTH: NicheField = { key: 'birth_date', label: 'Data de nascimento', type: 'date', required: true }
