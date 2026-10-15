import { createClient } from 'npm:@supabase/supabase-js@2'

// SUPABASE_URL é injetada automaticamente pelo Supabase em toda Edge Function.
// Este projeto já usa o sistema novo de chaves: a secret key (equivalente ao
// antigo service_role) vem num dicionário JSON em SUPABASE_SECRET_KEYS,
// também injetado automaticamente. PROJECT_SERVICE_ROLE_KEY (a service_role
// key legada) fica como alternativa, caso o dicionário não esteja disponível.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

function resolveServiceRoleKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys)
      if (parsed?.default) return parsed.default
    } catch (err) {
      console.error('Falha ao interpretar SUPABASE_SECRET_KEYS:', err)
    }
  }
  return Deno.env.get('PROJECT_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

export const supabaseAdmin = createClient(supabaseUrl, resolveServiceRoleKey())
