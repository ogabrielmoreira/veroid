import { BIRTH, CPF, NAME, WITH_DOCUMENT, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'fintech',
  label: 'Fintech e pagamentos',
  description: 'Abertura de conta em banco digital e instituição de pagamento (Pix).',
  icon: 'bank',
  priority: 1,
  enabledByDefault: true,
  examples: ['Banco digital', 'Conta de pagamento', 'Carteira Pix'],
  subniches: ['Banco digital', 'Instituição de pagamento', 'Adquirência'],
  fields: [
    CPF, NAME, BIRTH,
    { key: 'cep', label: 'CEP', type: 'cep', required: true },
    { key: 'declared_income', label: 'Renda mensal declarada', type: 'currency', required: false },
  ],
  flowSteps: WITH_DOCUMENT,
  riskRules: [
    { code: 'cpf_name_mismatch', label: 'CPF divergente do nome', weight: 30 },
    { code: 'underage', label: 'Idade menor que 18 anos', weight: 40, forces: 'review' },
    { code: 'device_multi_cpf', label: 'Mesmo dispositivo em várias sessões com CPFs diferentes', weight: 25 },
    { code: 'screen_replay', label: 'Selfie feita de uma tela', weight: 45 },
  ],
  kpis: ['auto_approval_rate', 'mule_accounts_prevented', 'time_to_first_transaction'],
  consentCopy: {
    purpose: 'abrir sua conta com segurança',
    retention: 'imagens apagadas em até 90 dias (24h na demonstração)',
  },
  compliance: ['Res. CMN 4.753/2019', 'PLD-FT', 'LGPD'],
  seedProfile: { sessions: 800, fraudRate: 0.09, topUfs: ['SP', 'RJ', 'MG', 'BA', 'PR'] },
}
export default niche
