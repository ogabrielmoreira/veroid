import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Period = '7d' | '30d' | '90d'
export interface DashFilters { period: Period; channel: string; band: string; decision: string }

export interface DashData {
  kpis: { verifications: number; auto_approval_rate: number | null; approval_rate: number | null; fraud_blocked: number; losses_prevented: number; avg_completion_seconds: number | null; pending_review: number; qualified: number }
  previous: { verifications: number; auto_approval_rate: number | null; fraud_blocked: number; avg_completion_seconds: number | null }
  funnel: Array<{ step: 'sent' | 'opened' | 'camera' | 'captured' | 'submitted' | 'approved'; n: number; denied?: number }>
  fraud_types: Array<{ week: string; type: string; n: number }>
  trend: Array<{ day: string; verifications: number; high: number }>
  histogram: Array<{ bucket: number; n: number }>
  by_uf: Array<{ uf: string; n: number; high: number }>
  heatmap: Array<{ dow: number; hour: number; n: number }>
  devices: { os: Array<{ k: string; n: number }>; browser: Array<{ k: string; n: number }> }
  niche_breakdown: Array<{ k: string; n: number; approved: number }>
  niche: string
}

export const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }

export function useDashboard(orgId: string, f: DashFilters) {
  return useQuery({
    queryKey: ['dashboard', orgId, f],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async (): Promise<DashData> => {
      const to = new Date()
      to.setMinutes(to.getMinutes() + 5)
      const from = new Date(to.getTime() - PERIOD_DAYS[f.period] * 864e5)
      const filters = Object.fromEntries(Object.entries({ channel: f.channel, band: f.band, decision: f.decision }).filter(([, v]) => v))
      const { data, error } = await supabase.rpc('dashboard_stats', { p_organization_id: orgId, p_from: from.toISOString(), p_to: to.toISOString(), p_filters: filters })
      if (error) throw error
      return data as DashData
    },
  })
}
