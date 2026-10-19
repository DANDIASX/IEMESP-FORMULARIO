import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { resolvePrice } from '../_shared/pricing.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { encontrarOuCriarLead } from '../_shared/leads.ts'

const SITE_URL = 'https://formulario.iemesp.com.br'

type Perfil = 'medico' | 'interno' | 'estudante'

type CriarPagamentoBody = {
  curso_slug?: string
  turma_slug?: string
  codigo?: string
  nome?: string
  email?: string
  telefone?: string
  consentimento_lgpd?: boolean
  utms?: Record<string, unknown>
  metodo?: 'cartao' | 'pix'
  perfil?: Perfil
  crm_numero?: string
  crm_uf?: string
  faculdade?: string
  ano_curso?: string
  lead_id_hint?: string
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
  const turmaSlug = body.turma_slug?.trim()
  const nome = body.nome?.trim()
  const email = body.email?.trim()
  const telefone = body.telefone?.trim()
  const metodo = body.metodo === 'pix' ? 'pix' : body.metodo === 'cartao' ? 'cartao' : null
  const perfil: Perfil | null = body.perfil === 'medico' || body.perfil === 'interno' || body.perfil === 'estudante' ? body.perfil : null

  if (!cursoSlug || !turmaSlug || !nome || !email || !telefone || !metodo || !perfil) {
    return jsonResponse(req, { error: 'Preencha todos os dados e escolha turma, perfil e forma de pagamento.' }, 400)
  }
  if (body.consentimento_lgpd !== true) {
    return jsonResponse(req, { error: 'É necessário aceitar o consentimento LGPD.' }, 400)
  }
  if (perfil === 'medico' && (!body.crm_numero?.trim() || !body.crm_uf?.trim())) {
    return jsonResponse(req, { error: 'Informe seu CRM e a UF.' }, 400)
  }
  if ((perfil === 'interno' || perfil === 'estudante') && !body.faculdade?.trim()) {
    return jsonResponse(req, { error: 'Informe sua faculdade.' }, 400)
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

  // Turma precisa existir, pertencer a esse curso e estar aberta.
  const { data: turma } = await supabaseAdmin
    .from('turmas')
    .select('id, nome, status, curso_id')
    .eq('slug', turmaSlug)
    .maybeSingle()

  if (!turma || turma.curso_id !== curso.id) {
    return jsonResponse(req, { error: 'Turma não encontrada.' }, 404)
  }
  if (turma.status !== 'aberta') {
    return jsonResponse(req, { error: 'Essa turma não está com inscrições abertas no momento.' }, 409)
  }

  // Se veio de um link gerado pelo CRM (?lead=), usa esse lead direto —
  // evita risco de casar com o lead errado por e-mail duplicado.
  let leadId: string | undefined
  if (body.lead_id_hint) {
    const { data: leadPorId } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('id', body.lead_id_hint)
      .maybeSingle()
    leadId = leadPorId?.id
  }

  // Senão, vincula a um lead já existente pelo e-mail, ou cria um novo.
  if (!leadId) {
    leadId = (await encontrarOuCriarLead({ nome, email, telefone, origem: 'checkout', utms: body.utms })) ?? undefined
  }
  if (!leadId) {
    return jsonResponse(req, { error: 'Não foi possível processar seu pedido. Tente novamente.' }, 500)
  }

  // Reserva a vaga e cria o pedido numa única transação atômica — nunca
  // vende mais vagas do que existem, mesmo com gente pagando ao mesmo tempo.
  const { data: pedido, error: pedidoError } = await supabaseAdmin.rpc('criar_pedido_com_vaga', {
    p_turma_id: turma.id,
    p_curso_id: curso.id,
    p_cupom_id: cupom?.id ?? null,
    p_lead_id: leadId,
    p_nome: nome,
    p_email: email,
    p_telefone: telefone,
    p_preco_original_centavos: precoOriginalEscolhido,
    p_desconto_centavos: desconto_centavos,
    p_valor_final_centavos: preco_final_centavos,
    p_utms: body.utms ?? {},
    p_consentimento_lgpd: true,
    p_metodo_pagamento: metodo,
    p_perfil: perfil,
    p_crm_numero: body.crm_numero?.trim() ?? null,
    p_crm_uf: body.crm_uf?.trim() ?? null,
    p_faculdade: body.faculdade?.trim() ?? null,
    p_ano_curso: body.ano_curso?.trim() ?? null,
    p_parcelas: metodo === 'cartao' ? curso.max_parcelas : 1,
  }).single()

  if (pedidoError || !pedido) {
    if (pedidoError?.message?.includes('sem_vagas')) {
      // Guarda o interesse no lead pra você conseguir contatar pela lista de espera.
      await supabaseAdmin.from('leads').update({ turma_interesse: `lista_espera:${turmaSlug}` }).eq('id', leadId)
      return jsonResponse(req, {
        error: 'Essa turma está com todas as vagas preenchidas.',
        sem_vagas: true,
      }, 409)
    }
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
          title: `${curso.titulo} — ${turma.nome}`,
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
