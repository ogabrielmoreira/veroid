import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import type { NicheSlug } from '@/config/niches'
import { supabase } from '@/lib/supabase'

export type OrgRole = 'owner' | 'analyst' | 'viewer'

export interface Organization {
  id: string
  name: string
  cnpj: string | null
  website: string | null
  size: string | null
  niche: NicheSlug
  subniche: string | null
  brand_kit: Record<string, unknown>
  settings: Record<string, unknown>
  created_at: string
}

export interface Membership {
  role: OrgRole
  created_at: string
  organization: Organization
}

export function useMemberships() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['memberships', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('role, created_at, organization:organizations(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Membership[]
    },
  })
}

export interface AuditEntry {
  id: number
  action: string
  target: string | null
  created_at: string
}

export function useAuditLog(organizationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['audit', organizationId],
    enabled: Boolean(organizationId) && enabled,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, target, created_at')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data ?? []
    },
  })
}
