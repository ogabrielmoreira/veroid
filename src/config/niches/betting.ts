import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'betting',
  label: 'Apostas reguladas',
  description: 'Template técnico (Lei 14.790/2023). Desligado por padrão e fora da vitrine.',
  icon: 'lock',
  priority: 'restricted',
  enabledByDefault: false,
  examples: ['Template técnico'],
  fields: [CPF, NAME],
  flowSteps: BASE_STEPS,
  riskRules: [],
  kpis: ['verifications', 'auto_approval_rate'],
  consentCopy: {
    purpose: 'concluir seu cadastro com segurança',
    retention: 'imagens apagadas em até 90 dias (24h na demonstração)',
  },
}
export default niche
