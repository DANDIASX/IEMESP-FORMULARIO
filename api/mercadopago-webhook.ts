import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Payment } from 'mercadopago'
import { mpClient } from './_lib/mercadopago'
import { supabaseAdmin } from './_lib/supabaseAdmin'

function extractPaymentId(req: VercelRequest): string | null {
  const queryId = req.query.id ?? req.query['data.id']
  if (typeof queryId === 'string') return queryId
  if (Array.isArray(queryId) && queryId[0]) return queryId[0]

  const body = req.body as { data?: { id?: string | number }; id?: string | number } | undefined
  if (body?.data?.id) return String(body.data.id)
  if (body?.id) return String(body.id)

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const paymentId = extractPaymentId(req)

  if (!paymentId) {
    res.status(200).json({ received: true })
    return
  }

  try {
    const payment = await new Payment(mpClient).get({ id: paymentId })

    if (payment.status === 'approved' && payment.external_reference) {
      const leadId = payment.external_reference

      await supabaseAdmin
        .from('leads')
        .update({
          pago: true,
          valor_curso: payment.transaction_amount ?? null,
          forma_pagamento: payment.payment_type_id ?? null,
          data_pagamento: payment.date_approved ?? new Date().toISOString(),
          pipeline_stage: 'matriculado',
          stage_updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('id, nome, email, telefone')
        .eq('id', leadId)
        .maybeSingle()

      if (lead) {
        const { data: existingStudent } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('lead_id', lead.id)
          .maybeSingle()

        if (!existingStudent) {
          await supabaseAdmin.from('students').insert([
            { lead_id: lead.id, nome: lead.nome, email: lead.email, telefone: lead.telefone },
          ])
        }
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Erro ao processar webhook Mercado Pago:', err)
    res.status(200).json({ received: true })
  }
}
