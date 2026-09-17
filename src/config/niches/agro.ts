import { CPF, NAME, BASE_STEPS, type NicheConfig } from './types'

const niche: NicheConfig = {
  slug: 'agro',
  label: 'Agronegócio',
  description: 'Crédito rural e CPR digital, cooperativas, tradings, revendas de insumos e fidelidade do produtor.',
  icon: 'leaf',
  priority: 1,
  enabledByDefault: true,
  examples: ['CPR digital', 'Cooperativa', 'Compra de café'],
  subniches: ['Crédito rural e CPR digital', 'Cooperativa', 'Trading e compra de grãos', 'Revenda de insumos', 'Fidelidade do produtor'],
  fields: [
    CPF, NAME,
    { key: 'state_registration', label: 'Inscrição estadual de produtor rural', type: 'text', required: true },
    { key: 'car', label: 'CAR (Cadastro Ambiental Rural)', type: 'text', required: false },
    { key: 'property_uf', label: 'UF da propriedade', type: 'select', required: true },
    { key: 'property_city', label: 'Município da propriedade', type: 'text', required: true },
    { key: 'main_crop', label: 'Cultura principal', type: 'select', required: true, options: ['Soja', 'Milho', 'Café', 'Cana', 'Algodão', 'Pecuária', 'Outra'] },
    { key: 'area_ha', label: 'Área (ha)', type: 'number', required: false },
  ],
  flowSteps: BASE_STEPS,
  riskRules: [
    { code: 'far_from_property', label: 'Sessão muito distante da propriedade (sinal, não bloqueio)', weight: 10 },
    { code: 'car_missing_credit', label: 'CAR ausente em operação de crédito', weight: 20, forces: 'review' },
    { code: 'same_face_multi_cpf', label: 'Mesmo rosto em CPFs diferentes', weight: 50 },
  ],
  kpis: ['operations_under_48h', 'volume_by_crop', 'map_by_uf', 'loyalty_eligible_producers'],
  consentCopy: {
    purpose: 'liberar sua operação com segurança',
    retention: 'imagens apagadas em até 90 dias (24h na demonstração)',
  },
  compliance: ['LGPD', 'Crédito rural (MCR)', 'Conformidade ambiental'],
  seedProfile: { sessions: 800, fraudRate: 0.07, topUfs: ['MT', 'GO', 'MG', 'PR', 'MS'] },
}
export default niche
