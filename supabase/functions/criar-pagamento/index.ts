import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { escapeLike, resolvePrice } from '../_shared/pricing.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const SITE_URL = 'https://formulario.iemesp.com.br'

type CriarPagamentoBody = {
  curso_slug?: string
  codigo?: string
  nome?: string
  email?: string
  telefone?: string
  consentimento_lgpd?: boolean
  utms?: Record<string, unknown>
  metodo?: 'cartao' | 'pix'
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: CriarPagamentoBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const cursoSlug = body.curso_slug?.trim()
  const nome = body.nome?.trim()
  const email = body.email?.trim()
  const telefone = body.telefone?.trim()

  const metodo = body.metodo === 'pix' ? 'pix' : body.metodo === 'cartao' ? 'cartao' : null

  if (!cursoSlug || !nome || !email || !telefone || !metodo) {
    return jsonResponse(req, { error: 'Preencha nome, e-mail, telefone e escolha a forma de pagamento.' }, 400)
  }
  if (body.consentimento_lgpd !== true) {
    return jsonResponse(req, { error: 'É necessário aceitar o consentimento LGPD.' }, 400)
  }

  // Recalcula o preço no servidor — nunca confia em valor vindo do navegador.
  const resultado = await resolvePrice(cursoSlug, body.codigo)
  if (!resultado.ok) {
    return jsonResponse(req, { error: resultado.mensagem }, resultado.status)
  }
  const { curso, cupom } = resultado
  const precoEscolhido = metodo === 'pix' ? resultado.pix : resultado.cartao
  const precoOriginalEscolhido = metodo === 'pix' ? (curso.preco_pix_centavos ?? curso.preco_centavos) : curso.preco_centavos
  const { desconto_centavos, preco_final_centavos } = precoEscolhido

  // Vincula a um lead já existente pelo e-mail, ou cria um novo.
  const { data: leadExistente } = await supabaseAdmin
    .from('leads')
    .select('id')
    .ilike('email', escapeLike(email))
    .maybeSingle()

  let leadId = leadExistente?.id as string | undefined
  if (!leadId) {
    const { data: novoLead, error: leadError } = await supabaseAdmin
      .from('leads')
      .insert([{
        tipo: 'b2c',
        nome,
        email,
        telefone,
        origem: 'checkout',
        consentimento_lgpd: true,
        utm_source: body.utms?.utm_source ?? null,
        utm_medium: body.utms?.utm_medium ?? null,
        utm_campaign: body.utms?.utm_campaign ?? null,
        utm_content: body.utms?.utm_content ?? null,
        utm_term: body.utms?.utm_term ?? null,
        gclid: body.utms?.gclid ?? null,
        fbclid: body.utms?.fbclid ?? null,
        first_landing_page: body.utms?.first_landing_page ?? null,
        referrer: body.utms?.referrer ?? null,
      }])
      .select('id')
      .single()

    if (leadError || !novoLead) {
      console.error('Erro ao criar lead no checkout:', leadError)
      return jsonResponse(req, { error: 'Não foi possível processar seu pedido. Tente novamente.' }, 500)
    }
    leadId = novoLead.id
  }

  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from('pedidos')
    .insert([{
      curso_id: curso.id,
      cupom_id: cupom?.id ?? null,
      lead_id: leadId,
      nome,
      email,
      telefone,
      preco_original_centavos: precoOriginalEscolhido,
      desconto_centavos,
      valor_final_centavos: preco_final_centavos,
      status: 'pendente',
      utms: body.utms ?? null,
      consentimento_lgpd: true,
      metodo_pagamento: metodo,
    }])
    .select('id')
    .single()

  if (pedidoError || !pedido) {
    console.error('Erro ao criar pedido:', pedidoError)
    return jsonResponse(req, { error: 'Não foi possível processar seu pedido. Tente novamente.' }, 500)
  }

  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!mpAccessToken || !supabaseUrl) {
    console.error('MP_ACCESS_TOKEN ou SUPABASE_URL não configuradas.')
    return jsonResponse(req, { error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' }, 500)
  }

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: curso.slug,
          title: curso.titulo,
          quantity: 1,
          unit_price: preco_final_centavos / 100,
          currency_id: 'BRL',
        }],
        payer: { name: nome, email },
        external_reference: pedido.id,
        back_urls: {
          success: `${SITE_URL}/pagamento/sucesso?pedido=${pedido.id}`,
          pending: `${SITE_URL}/pagamento/pendente?pedido=${pedido.id}`,
          failure: `${SITE_URL}/pagamento/erro?pedido=${pedido.id}`,
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/webhook-mercadopago`,
        payment_methods: metodo === 'pix'
          ? {
              // Só Pix: cada método tem seu próprio preço, então uma preferência
              // nunca pode deixar o comprador escolher outro método aqui.
              installments: 1,
              excluded_payment_types: [{ id: 'ticket' }, { id: 'credit_card' }, { id: 'debit_card' }],
            }
          : {
              installments: curso.max_parcelas,
              excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
            },
      }),
    })

    const preference = await mpResponse.json()
    if (!mpResponse.ok || !preference.init_point) {
      console.error('Erro ao criar preferência Mercado Pago:', preference)
      return jsonResponse(req, { error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 502)
    }

    await supabaseAdmin.from('pedidos').update({ mp_preference_id: preference.id }).eq('id', pedido.id)

    return jsonResponse(req, { init_point: preference.init_point, pedido_id: pedido.id })
  } catch (err) {
    console.error('Erro ao chamar Mercado Pago:', err)
    return jsonResponse(req, { error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 502)
  }
})
