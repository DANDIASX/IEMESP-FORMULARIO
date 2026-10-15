import { supabaseAdmin } from './supabaseAdmin.ts'

export type Curso = {
  id: string
  slug: string
  titulo: string
  preco_centavos: number
  max_parcelas: number
}

export type PriceResolution =
  | { ok: false; status: number; mensagem: string; curso?: Curso }
  | {
      ok: true
      curso: Curso
      cupom: { id: string } | null
      desconto_centavos: number
      preco_final_centavos: number
    }

// Nunca cobrar abaixo disso, mesmo com cupom de 100% ou valor_fixo maior que o preço.
const PRECO_MINIMO_CENTAVOS = 100

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// Única fonte de verdade pro cálculo de preço — usada por validar-cupom E
// criar-pagamento, pra nunca ter duas contas divergentes do mesmo desconto.
export async function resolvePrice(cursoSlug: string, codigo?: string | null): Promise<PriceResolution> {
  const { data: curso, error: cursoError } = await supabaseAdmin
    .from('cursos')
    .select('id, slug, titulo, preco_centavos, max_parcelas')
    .eq('slug', cursoSlug)
    .eq('ativo', true)
    .maybeSingle()

  if (cursoError || !curso) {
    return { ok: false, status: 404, mensagem: 'Curso não encontrado ou indisponível.' }
  }

  const codigoNormalizado = codigo?.trim()
  if (!codigoNormalizado) {
    return { ok: true, curso, cupom: null, desconto_centavos: 0, preco_final_centavos: curso.preco_centavos }
  }

  const { data: cupom } = await supabaseAdmin
    .from('cupons')
    .select('id, tipo, valor, curso_id, valido_de, valido_ate, limite_usos, usos, ativo')
    .ilike('codigo', escapeLike(codigoNormalizado))
    .maybeSingle()

  const agora = new Date()
  const valido =
    !!cupom &&
    cupom.ativo &&
    (cupom.curso_id === null || cupom.curso_id === curso.id) &&
    (!cupom.valido_de || new Date(cupom.valido_de) <= agora) &&
    (!cupom.valido_ate || new Date(cupom.valido_ate) >= agora) &&
    (cupom.limite_usos === null || cupom.usos < cupom.limite_usos)

  if (!valido) {
    // Mensagem genérica de propósito — nunca revela qual condição falhou.
    // Inclui o curso (que é válido) pra quem chamou saber que o problema foi só o cupom.
    return { ok: false, status: 400, mensagem: 'Cupom inválido ou expirado.', curso }
  }

  const descontoBruto =
    cupom!.tipo === 'percentual'
      ? Math.round((curso.preco_centavos * Number(cupom!.valor)) / 100)
      : Math.round(Number(cupom!.valor) * 100)

  const precoFinal = Math.max(curso.preco_centavos - descontoBruto, PRECO_MINIMO_CENTAVOS)
  const descontoEfetivo = curso.preco_centavos - precoFinal

  return {
    ok: true,
    curso,
    cupom: { id: cupom!.id },
    desconto_centavos: descontoEfetivo,
    preco_final_centavos: precoFinal,
  }
}
