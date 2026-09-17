import { BIRTH, CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'credit',
  label: 'Crédito e consignado',
  description: 'Contratação de crédito, BNPL e correspondente bancário com prova de vida na assinatura.',
  icon: 'contract',
  priority: 1,
  enabledByDefault: true,
  examples: ['Consignado INSS', 'BNPL', 'Correspondente bancário'],
  subniches: ['Consignado', 'BNPL', 'Crédito pessoal', 'Correspondente bancário'],
  fields: [
    CPF, NAME, BIRTH,
    { key: 'benefit_id', label: 'Número do benefício ou matrícula', type: 'text', required: false },
  ],
  flowSteps: BASE_STEPS,
  riskRules: [
    { code: 'senior_remote', label: 'Titular com mais de 70 anos em contratação remota', weight: 20, forces: 'review' },
    { code: 'face_mismatch_registry', label: 'Rosto da contratação diferente do cadastro', weight: 50 },
  ],
  kpis: ['disputed_contracts', 'losses_prevented_brl', 'approval_by_age_band'],
  consentCopy: {
    purpose: 'concluir a contratação do crédito com segurança',
    retention: 'imagens apagadas em até 90 dias (24h na demonstração)',
  },
  compliance: ['LGPD', 'Normas do INSS para consignado'],
  seedProfile: { sessions: 800, fraudRate: 0.11, topUfs: ['SP', 'MG', 'RS', 'PE', 'CE'] },
}
export default niche
