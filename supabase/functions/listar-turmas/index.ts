import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const TRINTA_MINUTOS_MS = 30 * 60 * 1000

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405)
  }

  let body: { curso_slug?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Corpo da requisição inválido.' }, 400)
  }

  const cursoSlug = body.curso_slug?.trim()
  if (!cursoSlug) {
    return jsonResponse(req, { error: 'Informe o curso.' }, 400)
  }

  const { data: curso } = await supabaseAdmin
    .from('cursos')
    .select('id')
    .eq('slug', cursoSlug)
    .eq('ativo', true)
    .maybeSingle()

  if (!curso) {
    return jsonResponse(req, { error: 'Curso não encontrado.' }, 404)
  }

  const { data: turmas } = await supabaseAdmin
    .from('turmas')
    .select('id, slug, nome, data_turma, horario, local, vagas_total, status')
    .eq('curso_id', curso.id)
    .in('status', ['aberta', 'esgotada'])
    .order('data_turma')

  const limiteReserva = new Date(Date.now() - TRINTA_MINUTOS_MS).toISOString()

  const resultado = []
  for (const t of turmas ?? []) {
    const { count } = await supabaseAdmin
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', t.id)
      .or(`status.eq.aprovado,and(status.eq.pendente,created_at.gt.${limiteReserva})`)

    const vagasRestantes = Math.max(t.vagas_total - (count ?? 0), 0)

    resultado.push({
      slug: t.slug,
      nome: t.nome,
      data_turma: t.data_turma,
      horario: t.horario,
      local: t.local,
      vagas_restantes: vagasRestantes,
      status: vagasRestantes > 0 ? t.status : 'esgotada',
    })
  }

  return jsonResponse(req, { turmas: resultado })
})
