import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'marketplace',
  label: 'Marketplaces e plataformas',
  description: 'Motoristas, entregadores, prestadores e vendedores, com reverificação periódica.',
  icon: 'store',
  priority: 2,
  enabledByDefault: true,
  examples: ['Motoristas', 'Entregadores', 'Vendedores'],
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
