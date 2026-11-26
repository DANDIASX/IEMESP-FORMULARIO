import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarTextoTelegram } from '../_shared/notify.ts'

const GRAPH_API_VERSION = 'v23.0'
const UM_DIA_MS = 24 * 60 * 60 * 1000

// Nome do modelo aprovado pela Meta pra cada retomada — ver bot/retomadas.md pros textos.
const TEMPLATE_POR_TENTATIVA: Record<number, string> = {
  1: 'retomada_dia1',
  2: 'retomada_dia3',
  3: 'retomada_dia7',
}

async function enviarTemplateWhatsapp(paraWaId: string, templateName: string, nome: string) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId) return { ok: false, erro: 'credenciais não configuradas' }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: paraWaId,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: nome }] }],
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, erro: data }
    return { ok: true, id: data?.messages?.[0]?.id as string | undefined }
  } catch (err) {
    return { ok: false, erro: String(err) }
  }
}

// Roda 1x por dia (pg_cron). Protegida por x-cron-secret, igual resumo-diario.
// Importante: só ativar o agendamento depois dos 3 modelos (retomada_dia1/3/7)
// estarem aprovados pela Meta — antes disso, todo envio vai falhar.
Deno.serve(async (req: Request) => {
  const chaveEsperada = Deno.env.get('CRON_SECRET')
  if (!chaveEsperada || req.headers.get('x-cron-secret') !== chaveEsperada) {
    return new Response('forbidden', { status: 403 })
  }

  const { data: conversas } = await supabaseAdmin
    .from('conversas')
    .select('id, lead_id, contato_externo_id, ultima_msg_lead_em, created_at, retomadas_enviadas')
    .eq('canal', 'whatsapp')
    .eq('estado', 'bot')
    .eq('optout', false)
    .lt('retomadas_enviadas', 3)

  let enviadas = 0
  let falhas = 0

  for (const conversa of conversas ?? []) {
    // Quem já está na lista de interesse não leva retomada (pediu pra ser avisado na próxima turma).
    const { count: naListaInteresse } = await supabaseAdmin
      .from('lista_interesse')
      .select('id', { count: 'exact', head: true })
      .eq('conversa_id', conversa.id)
    if ((naListaInteresse ?? 0) > 0) continue

    const ancora = conversa.ultima_msg_lead_em ?? conversa.created_at
    const diasSemResposta = Math.floor((Date.now() - new Date(ancora).getTime()) / UM_DIA_MS)

    const proximaTentativa = conversa.retomadas_enviadas + 1
    const diasNecessarios = proximaTentativa === 1 ? 1 : proximaTentativa === 2 ? 3 : 7
    if (diasSemResposta < diasNecessarios) continue

    if (!conversa.contato_externo_id) continue

    const { data: lead } = conversa.lead_id
      ? await supabaseAdmin.from('leads').select('nome').eq('id', conversa.lead_id).maybeSingle()
      : { data: null }
    const primeiroNome = (lead?.nome ?? '').split(' ')[0] || 'tudo bem'

    const templateName = TEMPLATE_POR_TENTATIVA[proximaTentativa]
    const envio = await enviarTemplateWhatsapp(conversa.contato_externo_id, templateName, primeiroNome)

    if (!envio.ok) {
      falhas++
      await enviarTextoTelegram(
        `⚠️ Retomada (tentativa ${proximaTentativa}) falhou pra conversa ${conversa.id}: ${JSON.stringify(envio.erro)}`,
        'erros',
      )
      continue
    }

    await supabaseAdmin.from('mensagens').insert({
      conversa_id: conversa.id,
      direcao: 'saida',
      autor: 'bot',
      texto: `[retomada ${proximaTentativa} enviada — modelo ${templateName}]`,
      canal_msg_id: envio.id ?? null,
    })
    await supabaseAdmin.from('conversas').update({ retomadas_enviadas: proximaTentativa }).eq('id', conversa.id)
    enviadas++
  }

  return new Response(JSON.stringify({ ok: true, enviadas, falhas }), { headers: { 'Content-Type': 'application/json' } })
})
