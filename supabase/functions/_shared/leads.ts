import { supabaseAdmin } from './supabaseAdmin.ts'
import { escapeLike } from './pricing.ts'

type DadosLead = {
  nome: string
  email: string
  telefone: string
  origem: string
  utms?: Record<string, unknown>
}

// Acha o lead pelo e-mail (sem diferenciar maiúsculas/minúsculas) ou cria um novo.
export async function encontrarOuCriarLead(dados: DadosLead): Promise<string | null> {
  const { data: leadExistente } = await supabaseAdmin
    .from('leads')
    .select('id')
    .ilike('email', escapeLike(dados.email))
    .maybeSingle()

  if (leadExistente?.id) return leadExistente.id

  const { data: novoLead, error } = await supabaseAdmin
    .from('leads')
    .insert([{
      tipo: 'b2c',
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      origem: dados.origem,
      consentimento_lgpd: true,
      utm_source: dados.utms?.utm_source ?? null,
      utm_medium: dados.utms?.utm_medium ?? null,
      utm_campaign: dados.utms?.utm_campaign ?? null,
      utm_content: dados.utms?.utm_content ?? null,
      utm_term: dados.utms?.utm_term ?? null,
      gclid: dados.utms?.gclid ?? null,
      fbclid: dados.utms?.fbclid ?? null,
      first_landing_page: dados.utms?.first_landing_page ?? null,
      referrer: dados.utms?.referrer ?? null,
    }])
    .select('id')
    .single()

  if (error || !novoLead) {
    console.error('Erro ao criar lead:', error)
    return null
  }
  return novoLead.id
}
