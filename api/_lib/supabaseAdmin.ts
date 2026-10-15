import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. Verifique as variáveis de ambiente do deploy.')
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://missing-env.supabase.co',
  serviceRoleKey || 'missing-key'
)
