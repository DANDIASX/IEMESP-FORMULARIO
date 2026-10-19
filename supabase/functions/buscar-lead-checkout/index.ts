import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

// Pré-preenche a etapa 1 do checkout pra quem já veio do formulário
// (link ?lead=<id>) — evita pedir nome/e-mail/telefone de novo.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: { lead_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const leadId = body.lead_id?.trim()
  if (!leadId) {
    return jsonResponse(req, { error: 'Informe o lead.' }, 400)
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('nome, email, telefone')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) {
    return jsonResponse(req, { error: 'Lead não encontrado.' }, 404)
  }

  // Só os dados necessários pra pré-preencher o checkout — nada mais do lead.
  return jsonResponse(req, { nome: lead.nome, email: lead.email, telefone: lead.telefone })
})
