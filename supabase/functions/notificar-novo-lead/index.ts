import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarNotificacaoTelegram } from '../_shared/notify.ts'

// Chamada pelo navegador depois de um cadastro direto na tabela leads
// (formulário público), já que o front não pode chamar o Telegram direto
// (exporia o token do bot). Os cadastros feitos pelas outras Edge Functions
// (checkout) chamam enviarNotificacaoTelegram() direto, sem passar por aqui.
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
    .select('nome, telefone, email, produto_interesse, origem, utm_source')
    .eq('id', leadId)
    .maybeSingle()

  if (lead) {
    await enviarNotificacaoTelegram(lead)
  }

  return jsonResponse(req, { ok: true })
})
