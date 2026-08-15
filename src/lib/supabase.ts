import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://missing-env.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-env-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas. Verifique as variáveis de ambiente do deploy.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
