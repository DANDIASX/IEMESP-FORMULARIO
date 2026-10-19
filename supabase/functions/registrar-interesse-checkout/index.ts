import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { encontrarOuCriarLead } from '../_shared/leads.ts'

// Chamada quando o comprador termina o passo 1 do checkout (nome/e-mail/
// telefone) e avança — cria/acha o lead e avança o estágio no CRM, assim
// quem abandona o checkout sem pagar ainda aparece no funil pra retomar.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: { nome?: string; email?: string; telefone?: string; utms?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const nome = body.nome?.trim()
  const email = body.email?.trim()
  const telefone = body.telefone?.trim()
  if (!nome || !email || !telefone) {
    return jsonResponse(req, { error: 'Preencha nome, e-mail e telefone.' }, 400)
  }

  const leadId = await encontrarOuCriarLead({ nome, email, telefone, origem: 'checkout', utms: body.utms })
  if (!leadId) {
    return jsonResponse(req, { error: 'Não foi possível registrar seu interesse. Tente novamente.' }, 500)
  }

  // Só avança o estágio se o lead ainda estiver em "novo" — nunca retrocede
  // alguém que já está mais adiante no funil (ex.: já negociando ou matriculado).
  await supabaseAdmin
    .from('leads')
    .update({ pipeline_stage: 'negociando', stage_updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('pipeline_stage', 'novo')

  return jsonResponse(req, { lead_id: leadId })
})
