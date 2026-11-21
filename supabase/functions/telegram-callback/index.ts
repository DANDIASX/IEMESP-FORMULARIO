import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarTextoTelegram } from '../_shared/notify.ts'
import { marcarLeadContatado } from '../_shared/leads.ts'

async function leadDaConversa(conversaId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('conversas').select('lead_id').eq('id', conversaId).maybeSingle()
  return data?.lead_id ?? null
}

const URL_DESTA_FUNCAO = 'https://qoxfkbytyvauhpoevaxp.supabase.co/functions/v1/telegram-callback'

async function telegramApi(metodo: string, body: unknown) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function responderCallback(callbackQueryId: string, texto: string, alerta = false) {
  await telegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text: texto, show_alert: alerta })
}

async function tratarCallback(cq: { id: string; data?: string }) {
  const partes = (cq.data ?? '').split(':')
  const [tipo, acao, id] = partes

  if (tipo === 'av') {
    const { data: aviso } = await supabaseAdmin.from('bot_avisos').select('*').eq('id', id).maybeSingle()
    if (!aviso) return responderCallback(cq.id, 'Aviso não encontrado (já pode ter sido tratado).')

    if (acao === 'assumir') {
      await supabaseAdmin.from('conversas').update({ estado: 'humano' }).eq('id', aviso.conversa_id)
      await supabaseAdmin.from('bot_avisos').update({ resolvido: true }).eq('id', id)
      return responderCallback(cq.id, 'Você assumiu a conversa. O bot não responde mais nela.')
    }

    if (acao === 'sugestao') {
      if (!aviso.sugestao_de_resposta) return responderCallback(cq.id, 'Não há sugestão registrada para esta conversa.')
      await supabaseAdmin.from('mensagens').insert({
        conversa_id: aviso.conversa_id,
        direcao: 'saida',
        autor: 'danilo',
        texto: aviso.sugestao_de_resposta,
      })
      await supabaseAdmin.from('conversas').update({ estado: 'bot' }).eq('id', aviso.conversa_id)
      await supabaseAdmin.from('bot_avisos').update({ resolvido: true }).eq('id', id)
      await marcarLeadContatado(await leadDaConversa(aviso.conversa_id))
      return responderCallback(cq.id, 'Sugestão enviada ao lead. O bot voltou a responder essa conversa.')
    }

    if (acao === 'devolver') {
      await supabaseAdmin.from('conversas').update({ estado: 'bot' }).eq('id', aviso.conversa_id)
      await supabaseAdmin.from('bot_avisos').update({ resolvido: true }).eq('id', id)
      return responderCallback(cq.id, 'Bot reativado nessa conversa.')
    }

    return responderCallback(cq.id, 'Ação desconhecida.')
  }

  if (tipo === 'rs') {
    const { data: rascunho } = await supabaseAdmin.from('rascunhos').select('*').eq('id', id).maybeSingle()
    if (!rascunho) return responderCallback(cq.id, 'Rascunho não encontrado (já pode ter sido tratado).')

    if (acao === 'enviar') {
      const blocos = String(rascunho.texto).split(/\n\n+/).filter(Boolean)
      const finais = blocos.length <= 2 ? blocos : [blocos[0], blocos.slice(1).join('\n\n')]
      for (const texto of finais) {
        await supabaseAdmin.from('mensagens').insert({ conversa_id: rascunho.conversa_id, direcao: 'saida', autor: 'bot', texto })
      }
      await supabaseAdmin.from('rascunhos').update({ status: 'enviado' }).eq('id', id)
      await marcarLeadContatado(await leadDaConversa(rascunho.conversa_id))
      return responderCallback(cq.id, 'Enviado ao lead.')
    }

    if (acao === 'assumir') {
      await supabaseAdmin.from('conversas').update({ estado: 'humano' }).eq('id', rascunho.conversa_id)
      await supabaseAdmin.from('rascunhos').update({ status: 'descartado' }).eq('id', id)
      return responderCallback(cq.id, 'Você assumiu a conversa. Rascunho descartado.')
    }

    if (acao === 'editar') {
      return responderCallback(cq.id, 'Responda esta mensagem (reply) com o texto que você quer enviar no lugar dela.', true)
    }

    return responderCallback(cq.id, 'Ação desconhecida.')
  }

  return responderCallback(cq.id, 'Ação desconhecida.')
}

async function tratarResposta(msg: { reply_to_message?: { message_id?: number }; text?: string }) {
  const replyId = msg.reply_to_message?.message_id
  const novoTexto = msg.text?.trim()
  if (!replyId || !novoTexto) return

  const { data: rascunho } = await supabaseAdmin
    .from('rascunhos')
    .select('id, conversa_id')
    .eq('telegram_message_id', replyId)
    .eq('status', 'pendente')
    .maybeSingle()

  if (!rascunho) return

  await supabaseAdmin.from('mensagens').insert({
    conversa_id: rascunho.conversa_id,
    direcao: 'saida',
    autor: 'danilo',
    texto: novoTexto,
  })
  await supabaseAdmin.from('rascunhos').update({ status: 'editado', texto: novoTexto }).eq('id', rascunho.id)
  await marcarLeadContatado(await leadDaConversa(rascunho.conversa_id))
  await enviarTextoTelegram('✏️ Mensagem editada enviada ao lead.')
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // Registro único do webhook: GET .../telegram-callback?setup=<TELEGRAM_WEBHOOK_SECRET>
  if (req.method === 'GET') {
    const setupSecret = url.searchParams.get('setup')
    const esperado = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (setupSecret && esperado && setupSecret === esperado) {
      const resultado = await telegramApi('setWebhook', {
        url: URL_DESTA_FUNCAO,
        secret_token: esperado,
        allowed_updates: ['message', 'callback_query'],
      })
      return new Response(JSON.stringify(resultado), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('ok')
  }

  if (req.method !== 'POST') return new Response('método não permitido', { status: 405 })

  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  const secretEsperado = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!secretEsperado || secretHeader !== secretEsperado) {
    return new Response('forbidden', { status: 403 })
  }

  const chatIdEsperado = Deno.env.get('TELEGRAM_CHAT_ID')

  let update: Record<string, unknown>
  try {
    update = await req.json()
  } catch {
    return new Response('ok')
  }

  if (update.callback_query) {
    const cq = update.callback_query as { id: string; data?: string; message?: { chat?: { id?: number } } }
    if (String(cq.message?.chat?.id ?? '') !== chatIdEsperado) {
      await responderCallback(cq.id, 'Não autorizado.')
      return new Response('ok')
    }
    await tratarCallback(cq)
    return new Response('ok')
  }

  if (update.message) {
    const msg = update.message as { chat?: { id?: number }; reply_to_message?: { message_id?: number }; text?: string }
    if (String(msg.chat?.id ?? '') !== chatIdEsperado) return new Response('ok')
    if (msg.reply_to_message) await tratarResposta(msg)
    return new Response('ok')
  }

  return new Response('ok')
})
