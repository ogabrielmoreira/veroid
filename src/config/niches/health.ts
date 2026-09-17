import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'health',
  label: 'Saúde e telemedicina',
  description: 'Identidade do paciente antes de consulta e prescrição.',
  icon: 'health',
  priority: 2,
  enabledByDefault: true,
  examples: ['Teleconsulta', 'Prescrição'],
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
