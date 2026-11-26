import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarTextoTelegram } from '../_shared/notify.ts'
import { normalizarTelefone } from '../_shared/leads.ts'
import { enviarMensagemWhatsapp } from '../_shared/whatsapp.ts'

const GRAPH_API_VERSION = 'v23.0'
const BOT_RESPONDER_URL = 'https://qoxfkbytyvauhpoevaxp.supabase.co/functions/v1/bot-responder'

function resolveServiceRoleKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys)
      if (parsed?.default) return parsed.default
    } catch {
      // ignora, cai no fallback abaixo
    }
  }
  return Deno.env.get('PROJECT_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

async function chamarBotResponder(conversaId: string) {
  try {
    await fetch(BOT_RESPONDER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resolveServiceRoleKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: conversaId }),
    })
  } catch (err) {
    console.error('Erro ao chamar bot-responder:', err)
  }
}

async function verificarAssinatura(req: Request, corpoBruto: string): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET não configurado — recusando POST por segurança.')
    return false
  }
  const assinaturaHeader = req.headers.get('X-Hub-Signature-256')
  if (!assinaturaHeader?.startsWith('sha256=')) return false

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assinaturaBytes = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpoBruto))
  const assinaturaCalculada = Array.from(new Uint8Array(assinaturaBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const recebida = assinaturaHeader.slice('sha256='.length)
  if (recebida.length !== assinaturaCalculada.length) return false
  // comparação em tempo constante
  let diff = 0
  for (let i = 0; i < recebida.length; i++) diff |= recebida.charCodeAt(i) ^ assinaturaCalculada.charCodeAt(i)
  return diff === 0
}

async function encontrarOuCriarLeadPorTelefone(telefoneNormalizado: string, nomePerfil: string | null): Promise<string | null> {
  const { data: leads } = await supabaseAdmin.from('leads').select('id, telefone')
  const existente = (leads ?? []).find((l) => l.telefone && normalizarTelefone(l.telefone) === telefoneNormalizado)
  if (existente) return existente.id

  const { data: novo, error } = await supabaseAdmin
    .from('leads')
    .insert({
      tipo: 'b2c',
      nome: nomePerfil ?? 'Lead do WhatsApp',
      telefone: telefoneNormalizado,
      origem: 'whatsapp',
      consentimento_lgpd: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar lead a partir do WhatsApp:', error)
    return null
  }
  return novo?.id ?? null
}

async function encontrarOuCriarConversa(contatoExternoId: string, leadId: string | null) {
  const { data: existente } = await supabaseAdmin
    .from('conversas')
    .select('*')
    .eq('canal', 'whatsapp')
    .eq('contato_externo_id', contatoExternoId)
    .maybeSingle()

  if (existente) return { conversa: existente, novaConversa: false }

  const { data: nova } = await supabaseAdmin
    .from('conversas')
    .insert({ canal: 'whatsapp', contato_externo_id: contatoExternoId, lead_id: leadId, estado: 'bot', modo: 'automatico' })
    .select('*')
    .single()

  return { conversa: nova, novaConversa: true }
}

async function baixarEGuardarMidia(mediaId: string, conversaId: string): Promise<string | null> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!token) return null
  try {
    const resInfo = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const info = await resInfo.json()
    if (!info?.url) return null

    const resArquivo = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } })
    const bytes = new Uint8Array(await resArquivo.arrayBuffer())
    const extensao = (info.mime_type ?? '').includes('pdf') ? 'pdf' : (info.mime_type ?? '').split('/')[1] ?? 'bin'
    const caminho = `recebidos/${conversaId}/${mediaId}.${extensao}`

    await supabaseAdmin.storage.from('bot-arquivos').upload(caminho, bytes, { contentType: info.mime_type, upsert: true })
    const { data: signed } = await supabaseAdmin.storage.from('bot-arquivos').createSignedUrl(caminho, 60 * 60 * 24 * 7)
    return signed?.signedUrl ?? caminho
  } catch (err) {
    console.error('Erro ao baixar mídia do WhatsApp:', err)
    return null
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const modo = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (modo === 'subscribe' && token && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 })
    }

    // Inscreve o app pra receber eventos da WABA — passo separado da URL de callback,
    // chamado uma vez (ou de novo, se trocar de WABA): GET .../whatsapp-webhook?subscribe_app=<WHATSAPP_VERIFY_TOKEN>
    const subscribeSecret = url.searchParams.get('subscribe_app')
    if (subscribeSecret && subscribeSecret === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      const wabaId = Deno.env.get('WHATSAPP_WABA_ID')
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const resultado = await res.json()
      return new Response(JSON.stringify(resultado), { headers: { 'Content-Type': 'application/json' } })
    }

    // Diagnóstico: lista quem está de fato inscrito nessa WABA.
    const checkSecret = url.searchParams.get('check_subscription')
    if (checkSecret && checkSecret === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      const wabaId = Deno.env.get('WHATSAPP_WABA_ID')
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const resultado = await res.json()
      return new Response(JSON.stringify(resultado), { headers: { 'Content-Type': 'application/json' } })
    }

    // Reenvia mensagens que ficaram sem canal_msg_id (falharam na hora, ex.: token vencido).
    const resendSecret = url.searchParams.get('resend_pending')
    const conversaIdResend = url.searchParams.get('conversa_id')
    if (resendSecret && resendSecret === Deno.env.get('WHATSAPP_VERIFY_TOKEN') && conversaIdResend) {
      const { data: conversa } = await supabaseAdmin
        .from('conversas')
        .select('contato_externo_id')
        .eq('id', conversaIdResend)
        .maybeSingle()

      const { data: pendentes } = await supabaseAdmin
        .from('mensagens')
        .select('id, texto')
        .eq('conversa_id', conversaIdResend)
        .eq('direcao', 'saida')
        .is('canal_msg_id', null)
        .order('criado_em')

      const resultados = []
      for (const msg of pendentes ?? []) {
        if (!conversa?.contato_externo_id || !msg.texto) continue
        const envio = await enviarMensagemWhatsapp(conversa.contato_externo_id, msg.texto)
        if (envio.ok) await supabaseAdmin.from('mensagens').update({ canal_msg_id: envio.id }).eq('id', msg.id)
        resultados.push({ id: msg.id, envio })
      }
      return new Response(JSON.stringify(resultados), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response('forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('método não permitido', { status: 405 })

  const corpoBruto = await req.text()
  if (!(await verificarAssinatura(req, corpoBruto))) {
    return new Response('forbidden', { status: 403 })
  }

  let payload: {
    entry?: {
      changes?: {
        field?: string
        value?: {
          metadata?: { display_phone_number?: string; phone_number_id?: string }
          contacts?: { profile?: { name?: string }; wa_id?: string }[]
          messages?: {
            id: string
            from: string
            timestamp?: string
            type: string
            text?: { body?: string }
            image?: { id: string; mime_type?: string }
            document?: { id: string; mime_type?: string; filename?: string }
          }[]
          statuses?: {
            id: string
            status: string
            recipient_id?: string
            errors?: { code?: number; title?: string; message?: string }[]
          }[]
        }
      }[]
    }[]
  }

  try {
    payload = JSON.parse(corpoBruto)
  } catch {
    return new Response('ok')
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const valor = change.value

      // Status de entrega das mensagens que a gente mandou — só avisa quando falha de verdade.
      for (const status of valor?.statuses ?? []) {
        if (status.status !== 'failed') continue
        const erro = status.errors?.[0]
        await enviarTextoTelegram(
          `🔴 WhatsApp: mensagem ${status.id} falhou.\nMotivo: ${erro?.title ?? '-'}\n${erro?.message ?? ''}`,
          'erros',
        )
      }

      if (!valor?.messages) continue
      const numeroNegocio = valor.metadata?.display_phone_number ? normalizarTelefone(valor.metadata.display_phone_number) : null

      for (const msg of valor.messages ?? []) {
        // Idempotência: Meta reenvia webhooks às vezes.
        const { data: jaExiste } = await supabaseAdmin.from('mensagens').select('id').eq('canal_msg_id', msg.id).maybeSingle()
        if (jaExiste) continue

        // "contacts[0].wa_id" é sempre o CLIENTE da conversa, mesmo quando quem escreveu
        // a mensagem (msg.from) foi o Danilo pelo app do celular (eco da coexistência).
        const contato = valor.contacts?.[0]
        const telefoneCliente = contato?.wa_id ? normalizarTelefone(contato.wa_id) : normalizarTelefone(msg.from)
        const ehEcoDoDanilo = numeroNegocio !== null && normalizarTelefone(msg.from) === numeroNegocio

        const leadId = await encontrarOuCriarLeadPorTelefone(telefoneCliente, contato?.profile?.name ?? null)
        const { conversa, novaConversa } = await encontrarOuCriarConversa(telefoneCliente, leadId)
        if (!conversa) continue

        let texto: string | null = null
        let midiaUrl: string | null = null
        if (msg.type === 'text') {
          texto = msg.text?.body ?? null
        } else if (msg.type === 'image' && msg.image) {
          midiaUrl = await baixarEGuardarMidia(msg.image.id, conversa.id)
          texto = '[imagem recebida]'
        } else if (msg.type === 'document' && msg.document) {
          midiaUrl = await baixarEGuardarMidia(msg.document.id, conversa.id)
          texto = `[documento recebido${msg.document.filename ? `: ${msg.document.filename}` : ''}]`
        } else {
          texto = `[mensagem do tipo "${msg.type}" não suportada ainda]`
        }

        if (ehEcoDoDanilo) {
          // Antes de inserir a mensagem dele, vê há quanto tempo a conversa estava parada —
          // decide se isso é uma retomada (conversa dormente, bot assume direto) ou uma
          // interrupção de verdade (conversa ativa, aí sim pausa).
          let horasParada = Infinity
          if (!novaConversa) {
            const { data: ultimaMsg } = await supabaseAdmin
              .from('mensagens')
              .select('criado_em')
              .eq('conversa_id', conversa.id)
              .order('criado_em', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (ultimaMsg) horasParada = (Date.now() - new Date(ultimaMsg.criado_em).getTime()) / (60 * 60 * 1000)
          }

          await supabaseAdmin.from('mensagens').insert({
            conversa_id: conversa.id,
            direcao: 'saida',
            autor: 'danilo',
            texto,
            midia_url: midiaUrl,
            canal_msg_id: msg.id,
          })

          const { data: config } = await supabaseAdmin
            .from('bot_config')
            .select('horas_pausa_quando_humano')
            .eq('ativo', true)
            .order('versao', { ascending: false })
            .limit(1)
            .maybeSingle()
          const horas = config?.horas_pausa_quando_humano ?? 12

          // Primeira mensagem de uma conversa nova, ou retomada de uma conversa que já
          // estava com o bot e ficou parada por mais tempo que a janela de pausa = o
          // Danilo abrindo/reabrindo contato de propósito pra entregar pro bot.
          // Se a conversa já estava "humano" ou "pausado" por decisão (ex.: Danilo pediu
          // pra manter manual com um lead específico), isso não muda sozinho com o tempo —
          // só pausa de novo, esperando o "Religar bot" no CRM.
          if (novaConversa || (conversa.estado === 'bot' && horasParada >= horas)) {
            await supabaseAdmin.from('conversas').update({ estado: 'bot' }).eq('id', conversa.id)
            continue
          }
          const pausadoAte = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString()
          await supabaseAdmin.from('conversas').update({ estado: 'humano', pausado_ate: pausadoAte }).eq('id', conversa.id)
          continue
        }

        await supabaseAdmin.from('mensagens').insert({
          conversa_id: conversa.id,
          direcao: 'entrada',
          autor: 'lead',
          texto,
          midia_url: midiaUrl,
          canal_msg_id: msg.id,
        })
        await supabaseAdmin.from('conversas').update({ ultima_msg_lead_em: new Date().toISOString() }).eq('id', conversa.id)

        if (midiaUrl) {
          await enviarTextoTelegram(`📎 Lead enviou um arquivo pelo WhatsApp. Conversa: ${conversa.id}`)
        }

        await chamarBotResponder(conversa.id)
      }
    }
  }

  return new Response('ok')
})
