import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: { pedido_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const pedidoId = body.pedido_id?.trim()
  if (!pedidoId) {
    return jsonResponse(req, { error: 'Informe o pedido.' }, 400)
  }

  const { data: pedido, error } = await supabaseAdmin
    .from('pedidos')
    .select('status')
    .eq('id', pedidoId)
    .maybeSingle()

  if (error || !pedido) {
    return jsonResponse(req, { error: 'Pedido não encontrado.' }, 404)
  }

  // Só o status — nada de e-mail, valor ou outros dados do pedido.
  return jsonResponse(req, { status: pedido.status })
})
