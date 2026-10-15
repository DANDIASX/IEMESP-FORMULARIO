import { supabaseAdmin } from './supabaseAdmin.ts'

export type Curso = {
  id: string
  slug: string
  titulo: string
  preco_centavos: number
  preco_pix_centavos: number | null
  max_parcelas: number
}

type PrecoCalculado = { desconto_centavos: number; preco_final_centavos: number }

export type PriceResolution =
  | { ok: false; status: number; mensagem: string; curso?: Curso }
  | {
      ok: true
      curso: Curso
      cupom: { id: string } | null
      cartao: PrecoCalculado
      pix: PrecoCalculado
    }

// Nunca cobrar abaixo disso, mesmo com cupom de 100% ou valor_fixo/preco_fixo maior que o preço.
const PRECO_MINIMO_CENTAVOS = 100

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

type Cupom = { id: string; tipo: 'percentual' | 'valor_fixo' | 'preco_fixo'; valor: string | number }

function aplicarCupom(baseCentavos: number, cupom: Cupom | null): PrecoCalculado {
  if (!cupom) return { desconto_centavos: 0, preco_final_centavos: baseCentavos }

  let precoFinal: number
  if (cupom.tipo === 'percentual') {
    precoFinal = baseCentavos - Math.round((baseCentavos * Number(cupom.valor)) / 100)
  } else if (cupom.tipo === 'preco_fixo') {
    precoFinal = Math.round(Number(cupom.valor) * 100)
  } else {
    precoFinal = baseCentavos - Math.round(Number(cupom.valor) * 100)
  }

  // Nunca abaixo do piso, nem acima do preço original (um cupom nunca aumenta o preço).
  precoFinal = Math.min(Math.max(precoFinal, PRECO_MINIMO_CENTAVOS), baseCentavos)
  return { desconto_centavos: baseCentavos - precoFinal, preco_final_centavos: precoFinal }
}

// Única fonte de verdade pro cálculo de preço — usada por validar-cupom E
// criar-pagamento, pra nunca ter duas contas divergentes do mesmo desconto.
// Calcula os dois preços (cartão e Pix) de uma vez, já que o checkout mostra
// os dois antes do comprador escolher como pagar.
export async function resolvePrice(cursoSlug: string, codigo?: string | null): Promise<PriceResolution> {
  const { data: curso, error: cursoError } = await supabaseAdmin
    .from('cursos')
    .select('id, slug, titulo, preco_centavos, preco_pix_centavos, max_parcelas')
    .eq('slug', cursoSlug)
    .eq('ativo', true)
    .maybeSingle()

  if (cursoError || !curso) {
    return { ok: false, status: 404, mensagem: 'Curso não encontrado ou indisponível.' }
  }

  const precoPixBase = curso.preco_pix_centavos ?? curso.preco_centavos
  const codigoNormalizado = codigo?.trim()

  if (!codigoNormalizado) {
    return {
      ok: true,
      curso,
      cupom: null,
      cartao: { desconto_centavos: 0, preco_final_centavos: curso.preco_centavos },
      pix: { desconto_centavos: 0, preco_final_centavos: precoPixBase },
    }
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

  return {
    ok: true,
    curso,
    cupom: { id: cupom!.id },
    cartao: aplicarCupom(curso.preco_centavos, cupom as Cupom),
    pix: aplicarCupom(precoPixBase, cupom as Cupom),
  }
}
