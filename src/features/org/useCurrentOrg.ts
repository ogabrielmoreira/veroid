import { useMemberships, type Membership } from './useMemberships'

const KEY = 'veroid.org'

export function getStoredOrgId(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function setStoredOrgId(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* ignora */ }
}

/** Organização ativa: a escolhida por último (se ainda for membro) ou a primeira. */
export function useCurrentOrg(): { membership: Membership | undefined; memberships: Membership[]; isLoading: boolean } {
  const { data, isLoading } = useMemberships()
  const list = data ?? []
  const stored = getStoredOrgId()
  const membership = list.find((m) => m.organization.id === stored) ?? list[0]
  return { membership, memberships: list, isLoading }
}
