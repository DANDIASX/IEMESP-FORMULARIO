import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Preference } from 'mercadopago'
import { mpClient } from './_lib/mercadopago'
import { supabaseAdmin } from './_lib/supabaseAdmin'
import { PRODUCTS, type ProdutoInteresse } from '../src/config/pricing'

const SITE_URL = 'https://formulario.iemesp.com.br'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const { leadId, produto } = (req.body || {}) as { leadId?: string; produto?: ProdutoInteresse }

  if (!leadId || !produto || !(produto in PRODUCTS)) {
    res.status(400).json({ error: 'Dados inválidos' })
    return
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('id, nome, email')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }

  const product = PRODUCTS[produto]

  try {
    const preference = await new Preference(mpClient).create({
      body: {
        items: [
          {
            id: produto,
            title: product.label,
            quantity: 1,
            unit_price: product.price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          name: lead.nome,
          email: lead.email || undefined,
        },
        external_reference: leadId,
        back_urls: {
          success: `${SITE_URL}/?mp_status=approved&produto=${produto}`,
          pending: `${SITE_URL}/?mp_status=pending`,
          failure: `${SITE_URL}/?mp_status=failure`,
        },
        auto_return: 'approved',
        notification_url: `${SITE_URL}/api/mercadopago-webhook`,
        payment_methods: {
          installments: 12,
          excluded_payment_types: [{ id: 'ticket' }],
        },
      },
    })

    res.status(200).json({ init_point: preference.init_point })
  } catch (err) {
    console.error('Erro ao criar preferência Mercado Pago:', err)
    res.status(500).json({ error: 'Erro ao criar pagamento. Tente novamente mais tarde.' })
  }
}
