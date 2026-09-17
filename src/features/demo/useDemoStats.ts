import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DashData } from '@/features/dashboard/useDashboard'

export interface PublicDemoData extends DashData {
  organization: { name: string; niche: string; subniche?: string | null }
}

/** Painel público "Explorar sem cadastro" — mesma agregação do painel autenticado, sem exigir login (§10). */
export function useDemoStats() {
  return useQuery({
    queryKey: ['public-demo-stats'],
    staleTime: 60_000,
    queryFn: async (): Promise<PublicDemoData> => {
      const { data, error } = await supabase.rpc('public_demo_stats')
      if (error) throw error
      return data as PublicDemoData
    },
  })
}
