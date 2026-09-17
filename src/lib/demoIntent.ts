// Fase 8 — carrega a intenção de "Criar conta demo" da landing até o onboarding
// (cadastro → confirmação de e-mail → onboarding pode passar por páginas diferentes,
// então usamos localStorage em vez de router state, que não sobrevive a esse trajeto).
const KEY = 'veroid_demo_intent'

export function markDemoIntent() {
  try { localStorage.setItem(KEY, '1') } catch { /* localStorage indisponível: segue sem demo */ }
}

export function hasDemoIntent(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function clearDemoIntent() {
  try { localStorage.removeItem(KEY) } catch { /* nada a fazer */ }
}
