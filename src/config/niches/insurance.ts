import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'insurance',
  label: 'Seguros',
  description: 'Contratação de apólice e abertura de sinistro.',
  icon: 'shield',
  priority: 2,
  enabledByDefault: true,
  examples: ['Contratação', 'Sinistro'],
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
