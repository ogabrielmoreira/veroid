import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'crypto',
  label: 'Cripto e ativos virtuais',
  description: 'Onboarding de VASPs sob a Lei 14.478/2022.',
  icon: 'coin',
  priority: 2,
  enabledByDefault: true,
  examples: ['Exchange', 'Custódia'],
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
