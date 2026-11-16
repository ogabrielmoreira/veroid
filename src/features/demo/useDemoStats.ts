import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DashData } from '@/features/dashboard/useDashboard'
import { env } from '@/lib/env'
import { demoSnapshot } from './demoSnapshot'

export interface PublicDemoData extends DashData {
  organization: { name: string; niche: string; subniche?: string | null }
}

/** Painel público "Explorar sem cadastro" — mesma agregação do painel autenticado, sem exigir login (§10). */
export function useDemoStats() {
  return useQuery({
    queryKey: ['public-demo-stats'],
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<PublicDemoData> => {
      if (env.maintenance || !env.isConfigured) return demoSnapshot
      try {
        const { data, error } = await supabase.rpc('public_demo_stats').abortSignal(AbortSignal.timeout(5000))
        if (error || !data) return demoSnapshot
        return data as PublicDemoData
      } catch {
        // Backend indisponível: o painel continua navegável com o snapshot fictício.
        return demoSnapshot
      }
    },
  })
}
