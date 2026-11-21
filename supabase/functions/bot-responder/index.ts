import Anthropic from 'npm:@anthropic-ai/sdk@1.12.0'
import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarTextoTelegram } from '../_shared/notify.ts'

const MODELO = 'claude-sonnet-5-5'
const MAX_MENSAGENS_HISTORICO = 30
const ESPERA_AGRUPAMENTO_MS = 30_000
const ESPERA_MAXIMA_MS = 120_000
const MAX_RODADAS_FERRAMENTA = 6
const TRINTA_MINUTOS_MS = 30 * 60 * 1000

const anthropic = new Anthropic()

type Conversa = {
  id: string
  lead_id: string | null
  canal: string
  estado: string
  modo: string
  etapa: string | null
  optout: boolean
  pausado_ate: string | null
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_vagas',
    description: 'Consulta quantas vagas reais ainda restam numa turma, calculado no servidor.',
    input_schema: {
      type: 'object',
      properties: { turma: { type: 'string', description: 'Slug da turma, ex.: procedimentos-2-0-2027-01-23' } },
      required: ['turma'],
    },
  },
  {
    name: 'enviar_link_checkout',
    description: 'Gera e envia o link de inscrição da turma, com cupom validado no servidor se houver.',
    input_schema: {
      type: 'object',
      properties: {
        turma: { type: 'string', description: 'Slug da turma' },
        cupom: { type: 'string', description: 'Código do cupom, se o lead tiver um' },
      },
      required: ['turma'],
    },
  },
  {
    name: 'enviar_apresentacao',
    description: 'Envia o PDF de apresentação do curso para o lead.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'atualizar_etapa',
    description: 'Atualiza a etapa da conversa e os dados do lead no Kanban do CRM.',
    input_schema: {
      type: 'object',
      properties: {
        etapa: { type: 'string', enum: ['ACOLHER', 'ENTENDER', 'MOSTRAR', 'OBJECOES', 'FECHAR'] },
        perfil: { type: 'string' },
        procedimento_de_interesse: { type: 'string' },
        objecao: { type: 'string' },
      },
      required: ['etapa'],
    },
  },
  {
    name: 'registrar_lista_interesse',
    description: 'Registra o lead na lista de interesse de uma próxima turma.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string' },
        preferencia_de_data: { type: 'string' },
      },
      required: ['motivo'],
    },
  },
  {
    name: 'registrar_pedido_data',
    description: 'Registra que o lead pediu uma data diferente das turmas abertas.',
    input_schema: {
      type: 'object',
      properties: { preferencia: { type: 'string' } },
      required: ['preferencia'],
    },
  },
  {
    name: 'registrar_optout',
    description: 'Registra que o lead não quer mais receber mensagens.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'notificar_danilo',
    description: 'Avisa o Danilo no Telegram sobre algo que precisa da atenção dele.',
    input_schema: {
      type: 'object',
      properties: {
        prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        motivo: { type: 'string' },
        resumo: { type: 'string' },
        sugestao_de_resposta: { type: 'string' },
      },
      required: ['prioridade', 'motivo', 'resumo'],
    },
  },
]

async function vagasRestantes(slug: string): Promise<{ encontrada: boolean; vagas_restantes: number; status: string }> {
  const { data: turma } = await supabaseAdmin
    .from('turmas')
    .select('id, vagas_total, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!turma) return { encontrada: false, vagas_restantes: 0, status: 'nao_encontrada' }

  const limiteReserva = new Date(Date.now() - TRINTA_MINUTOS_MS).toISOString()
  const { count } = await supabaseAdmin
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turma.id)
    .or(`status.eq.aprovado,and(status.eq.pendente,created_at.gt.${limiteReserva})`)

  const restantes = Math.max(turma.vagas_total - (count ?? 0), 0)
  return { encontrada: true, vagas_restantes: restantes, status: restantes > 0 ? turma.status : 'esgotada' }
}

async function executarFerramenta(
  nome: string,
  input: Record<string, unknown>,
  conversa: Conversa,
): Promise<unknown> {
  switch (nome) {
    case 'consultar_vagas': {
      const resultado = await vagasRestantes(String(input.turma ?? ''))
      return resultado
    }

    case 'enviar_link_checkout': {
      const slug = String(input.turma ?? '')
      const cupomCodigo = input.cupom ? String(input.cupom).trim() : null

      const { data: turma } = await supabaseAdmin.from('turmas').select('id').eq('slug', slug).maybeSingle()
      if (!turma) return { erro: 'Turma não encontrada.' }

      let cupomValido: string | null = null
      if (cupomCodigo) {
        const agora = new Date().toISOString()
        const { data: cupom } = await supabaseAdmin
          .from('cupons')
          .select('codigo, ativo, valido_de, valido_ate, turma_id')
          .ilike('codigo', cupomCodigo)
          .eq('ativo', true)
          .maybeSingle()

        const dentroDoPeriodo = cupom && (!cupom.valido_de || cupom.valido_de <= agora) && (!cupom.valido_ate || cupom.valido_ate >= agora)
        const turmaCompatible = cupom && (!cupom.turma_id || cupom.turma_id === turma.id)
        if (cupom && dentroDoPeriodo && turmaCompatible) cupomValido = cupom.codigo
      }

      const params = new URLSearchParams({
        lead: conversa.lead_id ?? '',
        turma: slug,
        utm_source: 'bot',
        utm_medium: conversa.canal,
      })
      if (cupomValido) params.set('cupom', cupomValido)

      const url = `https://formulario.iemesp.com.br/checkout/procedimentos-emergencia?${params.toString()}`
      return { url, cupom_aplicado: cupomValido }
    }

    case 'enviar_apresentacao': {
      const caminho = 'apresentacao-procedimentos-2-0.pdf'
      const { data } = await supabaseAdmin.storage.from('bot-arquivos').createSignedUrl(caminho, 60 * 60 * 24)
      if (!data?.signedUrl) {
        return { enviado: false, motivo: 'O PDF de apresentação ainda não foi cadastrado no Supabase Storage.' }
      }
      return { enviado: true, url: data.signedUrl }
    }

    case 'atualizar_etapa': {
      await supabaseAdmin.from('conversas').update({ etapa: input.etapa }).eq('id', conversa.id)
      if (conversa.lead_id) {
        const novoPipelineStage = ['OBJECOES', 'FECHAR'].includes(String(input.etapa)) ? 'negociando' : 'contatado'
        const notasExtra = [
          input.perfil ? `Perfil (bot): ${input.perfil}` : null,
          input.procedimento_de_interesse ? `Procedimento de interesse (bot): ${input.procedimento_de_interesse}` : null,
          input.objecao ? `Objeção (bot): ${input.objecao}` : null,
        ].filter(Boolean)

        const { data: lead } = await supabaseAdmin.from('leads').select('notas, pipeline_stage').eq('id', conversa.lead_id).maybeSingle()
        if (lead) {
          const novasNotas = notasExtra.length > 0 ? [lead.notas, ...notasExtra].filter(Boolean).join('\n') : lead.notas
          await supabaseAdmin
            .from('leads')
            .update({ pipeline_stage: novoPipelineStage, notas: novasNotas, stage_updated_at: new Date().toISOString() })
            .eq('id', conversa.lead_id)
        }
      }
      return { ok: true }
    }

    case 'registrar_lista_interesse': {
      await supabaseAdmin.from('lista_interesse').insert({
        conversa_id: conversa.id,
        motivo: input.motivo ?? null,
        preferencia_de_data: input.preferencia_de_data ?? null,
      })
      return { ok: true }
    }

    case 'registrar_pedido_data': {
      await supabaseAdmin.from('pedidos_data').insert({ conversa_id: conversa.id, preferencia: input.preferencia ?? null })
      return { ok: true }
    }

    case 'registrar_optout': {
      await supabaseAdmin.from('conversas').update({ optout: true }).eq('id', conversa.id)
      return { ok: true }
    }

    case 'notificar_danilo': {
      const prioridade = String(input.prioridade ?? 'media')
      const emoji = prioridade === 'alta' ? '🔴' : prioridade === 'media' ? '🟡' : '🟢'
      const texto = [
        `${emoji} Bot — aviso (${prioridade})`,
        `Motivo: ${input.motivo ?? '-'}`,
        `Resumo: ${input.resumo ?? '-'}`,
        input.sugestao_de_resposta ? `Sugestão: ${input.sugestao_de_resposta}` : null,
        `Conversa: ${conversa.id}`,
      ].filter(Boolean).join('\n')
      await enviarTextoTelegram(texto)
      if (prioridade === 'alta') {
        await supabaseAdmin.from('conversas').update({ estado: 'pausado' }).eq('id', conversa.id)
      }
      return { ok: true }
    }

    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}

// Espera o lead parar de mandar mensagens picadas antes de responder (30s de silêncio, até 120s de espera total).
async function esperarAgrupamento(conversaId: string): Promise<void> {
  const inicio = Date.now()
  while (true) {
    const { data } = await supabaseAdmin
      .from('mensagens')
      .select('criado_em')
      .eq('conversa_id', conversaId)
      .eq('direcao', 'entrada')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ultima = data ? new Date(data.criado_em).getTime() : 0
    const faltam = ESPERA_AGRUPAMENTO_MS - (Date.now() - ultima)
    if (faltam <= 0) return
    if (Date.now() - inicio > ESPERA_MAXIMA_MS) return
    await new Promise((r) => setTimeout(r, Math.min(faltam, 5000)))
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: { conversa_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const conversaId = body.conversa_id?.trim()
  if (!conversaId) {
    return jsonResponse(req, { error: 'Informe a conversa.' }, 400)
  }

  const { data: conversa } = await supabaseAdmin
    .from('conversas')
    .select('id, lead_id, canal, estado, modo, etapa, optout, pausado_ate')
    .eq('id', conversaId)
    .maybeSingle<Conversa>()

  if (!conversa) return jsonResponse(req, { error: 'Conversa não encontrada.' }, 404)

  if (conversa.estado !== 'bot') return jsonResponse(req, { ok: true, pulado: 'estado_nao_bot' })
  if (conversa.optout) return jsonResponse(req, { ok: true, pulado: 'optout' })
  if (conversa.pausado_ate && new Date(conversa.pausado_ate) > new Date()) {
    return jsonResponse(req, { ok: true, pulado: 'pausado' })
  }

  await esperarAgrupamento(conversaId)

  const { data: config } = await supabaseAdmin
    .from('bot_config')
    .select('prompt_sistema, base_conhecimento, modelo')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!config) {
    await enviarTextoTelegram(`⚠️ Bot falhou: nenhum bot_config ativo encontrado. conversa_id=${conversaId}`)
    return jsonResponse(req, { error: 'Nenhuma configuração ativa do bot.' }, 500)
  }

  const systemPrompt = config.prompt_sistema.replace('{{BASE_DE_CONHECIMENTO}}', config.base_conhecimento)

  const lead = conversa.lead_id
    ? (
        await supabaseAdmin
          .from('leads')
          .select('nome, telefone, perfil, curso_interesse, turma_interesse, cupom, residencia, instituicao')
          .eq('id', conversa.lead_id)
          .maybeSingle()
      ).data
    : null

  const { data: historico } = await supabaseAdmin
    .from('mensagens')
    .select('direcao, autor, texto, criado_em')
    .eq('conversa_id', conversaId)
    .order('criado_em', { ascending: false })
    .limit(MAX_MENSAGENS_HISTORICO)

  const historicoOrdenado = (historico ?? []).slice().reverse()

  const contextoLead = lead
    ? [
        '[CONTEXTO INTERNO — dados do formulário, não é mensagem do lead. Use sem perguntar de novo.]',
        lead.nome ? `Nome: ${lead.nome}` : null,
        lead.perfil ? `Perfil: ${lead.perfil}` : null,
        lead.curso_interesse ? `Curso de interesse: ${lead.curso_interesse}` : null,
        lead.turma_interesse ? `Turma de interesse: ${lead.turma_interesse}` : null,
        lead.cupom ? `Cupom informado no formulário: ${lead.cupom}` : null,
        lead.residencia ? `Residência: ${lead.residencia}` : null,
        lead.instituicao ? `Instituição: ${lead.instituicao}` : null,
      ].filter(Boolean).join('\n')
    : '[CONTEXTO INTERNO — lead sem cadastro prévio no formulário.]'

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: contextoLead },
    { role: 'assistant', content: 'Entendido, vou usar essas informações na conversa.' },
    ...historicoOrdenado.map((m): Anthropic.MessageParam => ({
      role: m.autor === 'lead' ? 'user' : 'assistant',
      content: m.texto ?? '',
    })),
  ]

  let respostaFinal: Anthropic.Message
  try {
    for (let rodada = 0; ; rodada++) {
      const resposta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 2048,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        output_config: { effort: 'medium' },
        messages,
      })

      if (resposta.stop_reason !== 'tool_use' || rodada >= MAX_RODADAS_FERRAMENTA) {
        respostaFinal = resposta
        break
      }

      messages.push({ role: 'assistant', content: resposta.content })

      const toolUseBlocks = resposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const bloco of toolUseBlocks) {
        const resultado = await executarFerramenta(bloco.name, bloco.input as Record<string, unknown>, conversa)
        toolResults.push({ type: 'tool_result', tool_use_id: bloco.id, content: JSON.stringify(resultado) })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  } catch (err) {
    console.error('Erro ao chamar a API da Anthropic:', err)
    await enviarTextoTelegram(`⚠️ Bot falhou ao responder, responda manualmente. conversa_id=${conversaId}`)
    return jsonResponse(req, { error: 'Falha ao gerar resposta.' }, 500)
  }

  const textoFinal = respostaFinal.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim()

  if (!textoFinal) {
    return jsonResponse(req, { ok: true, mensagens: [] })
  }

  // No máximo 2 mensagens por resposta — junta qualquer parágrafo extra no segundo bloco.
  const blocos = textoFinal.split(/\n\n+/).filter(Boolean)
  const partes = blocos.length <= 2 ? blocos : [blocos[0], blocos.slice(1).join('\n\n')]

  if (conversa.modo === 'aprovacao') {
    const rascunho = partes.join('\n\n')
    await supabaseAdmin.from('rascunhos').insert({ conversa_id: conversaId, texto: rascunho, status: 'pendente' })
    await enviarTextoTelegram(`📝 Rascunho pendente de aprovação (conversa ${conversaId}):\n\n${rascunho}`)
    return jsonResponse(req, { ok: true, modo: 'aprovacao', rascunho })
  }

  for (const texto of partes) {
    await supabaseAdmin.from('mensagens').insert({
      conversa_id: conversaId,
      direcao: 'saida',
      autor: 'bot',
      texto,
      tokens_entrada: respostaFinal.usage.input_tokens,
      tokens_saida: respostaFinal.usage.output_tokens,
    })
  }

  return jsonResponse(req, { ok: true, mensagens: partes })
})
