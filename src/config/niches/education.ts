import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'education',
  label: 'Educação a distância',
  description: 'Confirmar que quem faz a prova é o aluno.',
  icon: 'book',
  priority: 2,
  enabledByDefault: true,
  examples: ['Prova online', 'Certificação'],
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
