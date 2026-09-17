import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(env.supabaseUrl || 'https://invalid.local', env.supabaseKey || 'missing', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
