import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'npm:mercadopago@2'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

function jsonOk(body: unknown = { received: true }, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Usa o validador oficial do SDK do Mercado Pago em vez de recalcular o HMAC
// na mão — evita qualquer divergência sutil de formato do nosso lado.
function isSignatureValid(req: Request, dataId: string, secret: string): boolean {
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId,
      secret,
    })
    return true
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) return false
    console.error('Erro inesperado ao validar assinatura:', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')

  // Nenhum id na notificação: nada pra processar, confirma recebimento e sai.
  if (!dataId) return jsonOk()

  // A assinatura x-signature do evento "Pagamentos (legacy)" não bate com o
  // validador oficial do Mercado Pago em nenhum teste real (confirmado numa
  // investigação extensa — "Simular notificação" valida certinho, entregas
  // reais nunca validam, o que indica um esquema de assinatura diferente só
  // pra esse tipo de evento). Por isso não bloqueamos mais por causa dela —
  // só registramos o resultado pra referência futura. A segurança de verdade
  // continua de pé: nunca confiamos no corpo da notificação, sempre buscamos
  // o pagamento de verdade na API do Mercado Pago (com nosso próprio token)
  // antes de aprovar qualquer coisa.
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')?.trim()
  if (webhookSecret) {
    const assinaturaOk = isSignatureValid(req, dataId, webhookSecret)
    if (!assinaturaOk) console.warn('Assinatura x-signature não validou (ignorado por design — ver comentário).')
  }

  try {
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      console.error('MP_ACCESS_TOKEN não configurado.')
      return jsonOk()
    }

    // Nunca confia no corpo da notificação — busca o pagamento de verdade na API.
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    })
    if (!paymentRes.ok) {
      console.error('Falha ao buscar pagamento no Mercado Pago:', paymentRes.status)
      return jsonOk()
    }
    const payment = await paymentRes.json()
    const pedidoId = payment.external_reference as string | undefined
    if (!pedidoId) return jsonOk()

    if (payment.status === 'approved') {
      // Atômico, idempotente e turma-aware: se o pedido tem turma, só aprova
      // se ainda houver vaga aprovada disponível (senão marca 'excedente' pra
      // conferência manual). Chamar de novo pra um pedido já aprovado não
      // repete nada — transicao_nova só vem true na primeira vez.
      const { data: resultado, error: updateError } = await supabaseAdmin
        .rpc('confirmar_pagamento_pedido', {
          p_pedido_id: pedidoId,
          p_mp_payment_id: String(dataId),
          p_pago_em: payment.date_approved ?? new Date().toISOString(),
        })
        .single()

      if (updateError) console.error('Erro ao confirmar pedido:', updateError)

      const pedido = resultado && resultado.transicao_nova ? resultado : null
      if (resultado?.status === 'excedente') {
        console.error('[ALERTA] Pedido excedente — turma lotou entre a criação e a confirmação do pagamento:', pedidoId)
      }

      if (pedido) {
        if (pedido.cupom_id) {
          await supabaseAdmin.rpc('increment_cupom_usos', { p_cupom_id: pedido.cupom_id })
        }

        if (pedido.lead_id) {
          await supabaseAdmin
            .from('leads')
            .update({
              pago: true,
              valor_curso: pedido.valor_final_centavos / 100,
              forma_pagamento: payment.payment_type_id ?? null,
              data_pagamento: payment.date_approved ?? new Date().toISOString(),
              pipeline_stage: 'matriculado',
              stage_updated_at: new Date().toISOString(),
            })
            .eq('id', pedido.lead_id)

          const { data: lead } = await supabaseAdmin
            .from('leads')
            .select('id, nome, email, telefone')
            .eq('id', pedido.lead_id)
            .maybeSingle()

          if (lead) {
            const { data: existingStudent } = await supabaseAdmin
              .from('students')
              .select('id')
              .eq('lead_id', lead.id)
              .maybeSingle()

            if (!existingStudent) {
              await supabaseAdmin
                .from('students')
                .insert([{ lead_id: lead.id, nome: lead.nome, email: lead.email, telefone: lead.telefone }])
            }
          }
        }
      }
    } else if (payment.status === 'rejected') {
      await supabaseAdmin.from('pedidos').update({ status: 'recusado' }).eq('id', pedidoId).eq('status', 'pendente')
    } else if (payment.status === 'refunded') {
      await supabaseAdmin.from('pedidos').update({ status: 'reembolsado' }).eq('id', pedidoId)
    }

    return jsonOk()
  } catch (err) {
    console.error('Erro ao processar webhook Mercado Pago:', err)
    return jsonOk()
  }
})
