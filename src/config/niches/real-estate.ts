import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'real-estate',
  label: 'Imobiliário e locação',
  description: 'Inquilino, fiador e proprietário, com assinatura de contrato por prova de vida.',
  icon: 'home',
  priority: 2,
  enabledByDefault: true,
  examples: ['Locação', 'Fiador', 'Compra e venda'],
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
