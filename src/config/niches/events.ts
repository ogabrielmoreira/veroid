import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'events',
  label: 'Eventos e e-sports',
  description: 'Ingresso nominal, combate a cambismo e contas de jogadores em campeonatos.',
  icon: 'ticket',
  priority: 2,
  enabledByDefault: true,
  examples: ['Ingresso nominal', 'Campeonatos'],
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
