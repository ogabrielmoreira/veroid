import agro from './agro'
import automotive from './automotive'
import betting from './betting'
import credit from './credit'
import crypto from './crypto'
import education from './education'
import events from './events'
import fintech from './fintech'
import health from './health'
import insurance from './insurance'
import marketplace from './marketplace'
import realEstate from './real-estate'
import telecom from './telecom'
import type { NicheConfig, NicheSlug } from './types'

export type { NicheConfig, NicheSlug } from './types'

/** Criar um nicho novo = criar um arquivo e registrar aqui. */
export const NICHES: Record<NicheSlug, NicheConfig> = {
  fintech, credit, agro, automotive,
  'real-estate': realEstate, telecom, marketplace, insurance, crypto, health, events, education,
  betting,
}

export const FEATURED_NICHES = Object.values(NICHES).filter((n) => n.priority === 1)
export const TEMPLATE_NICHES = Object.values(NICHES).filter((n) => n.priority === 2 && n.enabledByDefault)

/** Payload enviado para public.create_organization(p_flow) */
export function flowPayload(n: NicheConfig) {
  return {
    name: `Fluxo padrão · ${n.label}`,
    steps: n.flowSteps,
    fields: n.fields,
    risk_rules: n.riskRules,
  }
}
