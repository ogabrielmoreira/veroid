import type { PublicDemoData } from './useDemoStats'

/**
 * Snapshot estático do painel de demonstração (dados 100% fictícios, gerados com semente fixa).
 * Permite explorar o painel sem backend — usado no modo de manutenção ou quando o Supabase não responde.
 */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(): PublicDemoData {
  const r = rng(20260)
  const sent = 842
  const opened = 731
  const camera = 668
  const captured = 624
  const submitted = 603
  const approved = 497

  // 13 semanas de sinais de fraude por tipo (termina na semana corrente)
  const types = ['screen', 'printed', 'no_face', 'face_mismatch', 'device', 'data', 'liveness']
  const weight = [1.0, 0.7, 0.55, 0.45, 0.35, 0.3, 0.25]
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 12 * 7)
  const fraud_types: PublicDemoData['fraud_types'] = []
  for (let w = 0; w < 13; w++) {
    const d = new Date(monday); d.setDate(d.getDate() + w * 7)
    const week = d.toISOString().slice(0, 10)
    types.forEach((type, i) => fraud_types.push({ week, type, n: Math.round(weight[i] * (2 + r() * 5)) }))
  }

  const histogram = [4, 6, 9, 14, 22, 31, 52, 118, 205, 142].map((n, i) => ({ bucket: i * 10, n }))

  const ufs: Array<[string, number]> = [['SP', 238], ['RJ', 96], ['MG', 84], ['PR', 52], ['RS', 49], ['BA', 41], ['SC', 33], ['GO', 28], ['PE', 27], ['CE', 24], ['DF', 22], ['ES', 17], ['PA', 15], ['MT', 12], ['MS', 9], ['AM', 8], ['MA', 7], ['PB', 6], ['RN', 6], ['AL', 5], ['PI', 4], ['SE', 4], ['TO', 3], ['RO', 3], ['AC', 2], ['AP', 1], ['RR', 1]]
  const by_uf = ufs.map(([uf, n]) => ({ uf, n, high: Math.round(n * (0.06 + r() * 0.14)) }))

  const heatmap: PublicDemoData['heatmap'] = []
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const day = dow >= 6 ? 0.45 : 1
      const peak = Math.exp(-((hour - 14) ** 2) / 38) + 0.55 * Math.exp(-((hour - 20) ** 2) / 10)
      const n = Math.round(day * peak * (5 + r() * 5))
      if (n > 0) heatmap.push({ dow, hour, n })
    }
  }

  return {
    organization: { name: 'Banco Aurora', niche: 'fintech', subniche: null },
    niche: 'fintech',
    kpis: { verifications: sent, auto_approval_rate: 82.4, approval_rate: 90.7, fraud_blocked: 64, losses_prevented: 389500, avg_completion_seconds: 94, pending_review: 18, qualified: 212 },
    previous: { verifications: 764, auto_approval_rate: 79.1, fraud_blocked: 71, avg_completion_seconds: 108 },
    funnel: [
      { step: 'sent', n: sent }, { step: 'opened', n: opened }, { step: 'camera', n: camera, denied: 36 },
      { step: 'captured', n: captured }, { step: 'submitted', n: submitted }, { step: 'approved', n: approved },
    ],
    fraud_types,
    trend: [],
    histogram,
    by_uf,
    heatmap,
    devices: {
      os: [{ k: 'Android', n: 421 }, { k: 'iOS', n: 318 }, { k: 'Windows', n: 74 }, { k: 'macOS', n: 29 }],
      browser: [{ k: 'Chrome', n: 466 }, { k: 'Safari', n: 301 }, { k: 'Samsung Internet', n: 48 }, { k: 'Firefox', n: 27 }],
    },
    niche_breakdown: [],
  }
}

export const demoSnapshot: PublicDemoData = build()
