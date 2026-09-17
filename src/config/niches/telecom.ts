import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'telecom',
  label: 'Telecom',
  description: 'Ativação de chip, portabilidade e troca de SIM (SIM swap).',
  icon: 'signal',
  priority: 2,
  enabledByDefault: true,
  examples: ['Ativação de chip', 'Portabilidade', 'SIM swap'],
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
