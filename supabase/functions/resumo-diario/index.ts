import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { enviarTextoTelegram } from '../_shared/notify.ts'

const ETAPA_LABEL: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  negociando: 'Negociando',
  aguardando_pagamento: 'Aguardando pagamento',
  matriculado: 'Matriculado',
  perdido: 'Perdido',
}

// Chamado 1x por dia às 20h (pg_cron) — resumo do dia pro Danilo no Telegram.
// Protegida por chave compartilhada (x-cron-secret), igual ao padrão já usado em
// relatorio-financeiro — não é chamada por um usuário logado, então não faz sentido
// verify_jwt aqui.
// Nunca lança erro: uma falha aqui não pode travar o cron.
Deno.serve(async (req: Request) => {
  const chaveEsperada = Deno.env.get('CRON_SECRET')
  if (!chaveEsperada || req.headers.get('x-cron-secret') !== chaveEsperada) {
    return new Response('forbidden', { status: 403 })
  }

  try {
    const inicioHoje = new Date()
    inicioHoje.setUTCHours(3, 0, 0, 0) // meia-noite em horário de Brasília (UTC-3)
    if (inicioHoje > new Date()) inicioHoje.setUTCDate(inicioHoje.getUTCDate() - 1)
    const desde = inicioHoje.toISOString()

    const [leadsNovosRes, pendentesRes, pedidosDataRes, listaInteresseRes] = await Promise.all([
      supabaseAdmin.from('leads').select('nome, pipeline_stage').gte('created_at', desde),
      supabaseAdmin.from('pedidos').select('nome').eq('status', 'pendente'),
      supabaseAdmin.from('pedidos_data').select('preferencia').gte('criado_em', desde),
      supabaseAdmin.from('lista_interesse').select('preferencia_de_data').gte('criado_em', desde),
    ])

    const leadsNovos = leadsNovosRes.data ?? []
    const porEtapa = new Map<string, number>()
    for (const l of leadsNovos) {
      const etapa = l.pipeline_stage ?? 'novo'
      porEtapa.set(etapa, (porEtapa.get(etapa) ?? 0) + 1)
    }

    const pendentes = pendentesRes.data ?? []

    const preferenciasHoje = [
      ...pedidosDataRes.data?.map((p) => p.preferencia).filter(Boolean) ?? [],
      ...listaInteresseRes.data?.map((p) => p.preferencia_de_data).filter(Boolean) ?? [],
    ] as string[]
    const contagemPreferencias = new Map<string, number>()
    for (const p of preferenciasHoje) contagemPreferencias.set(p, (contagemPreferencias.get(p) ?? 0) + 1)
    const destaques = [...contagemPreferencias.entries()].filter(([, n]) => n >= 4)

    const linhas = [
      `📊 Resumo do dia — IEMESP bot`,
      ``,
      `Leads novos: ${leadsNovos.length}`,
      ...[...porEtapa.entries()].map(([etapa, n]) => `  • ${ETAPA_LABEL[etapa] ?? etapa}: ${n}`),
      ``,
      `Escolheram turma e não pagaram (pendentes): ${pendentes.length}`,
      ...pendentes.slice(0, 10).map((p) => `  • ${p.nome ?? '-'}`),
      ``,
      `Pedidos de outra data hoje: ${preferenciasHoje.length}`,
      ...(destaques.length > 0
        ? [`⚠️ ${destaques.length} data(s) com 4+ pedidos:`, ...destaques.map(([data, n]) => `  • ${data}: ${n} pedidos`)]
        : []),
    ]

    await enviarTextoTelegram(linhas.join('\n'))
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Erro ao montar resumo diário:', err)
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
