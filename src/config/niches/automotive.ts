import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'automotive',
  label: 'Automotivo',
  description: 'Revendas, financiamento de veículos, locadoras, vistoria e marketplaces de carros.',
  icon: 'car',
  priority: 1,
  enabledByDefault: true,
  examples: ['Sinal de compra', 'Locação', 'Vistoria'],
  subniches: ['Revenda e concessionária', 'Financiamento', 'Locadora', 'Vistoria', 'Marketplace de carros'],
  fields: [
    CPF, NAME,
    { key: 'cnh_number', label: 'Número da CNH', type: 'text', required: true },
    { key: 'cnh_category', label: 'Categoria da CNH', type: 'select', required: true, options: ['A', 'B', 'AB', 'C', 'D', 'E'] },
    { key: 'plate', label: 'Placa ou chassi do veículo', type: 'text', required: false },
    { key: 'deposit_amount', label: 'Valor do sinal', type: 'currency', required: false },
  ],
  flowSteps: BASE_STEPS,
  riskRules: [
    { code: 'high_deposit_no_history', label: 'Sinal acima do limite e titular sem histórico (PLD)', weight: 25, forces: 'review' },
    { code: 'cnh_expired_rental', label: 'CNH vencida em locação', weight: 35, forces: 'review' },
  ],
  kpis: ['verified_deals', 'verified_value_brl', 'fraud_by_type'],
  consentCopy: {
    purpose: 'seguir com a negociação do veículo',
    retention: 'imagens apagadas em até 90 dias (24h na demonstração)',
  },
  compliance: ['LGPD', 'PLD-FT'],
  seedProfile: { sessions: 800, fraudRate: 0.08, topUfs: ['SP', 'PR', 'SC', 'RJ', 'GO'] },
}
export default niche
