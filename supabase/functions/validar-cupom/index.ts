import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { resolvePrice } from '../_shared/pricing.ts'

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req, { mensagem: 'Método não permitido' }, 405)
  }

  let body: { curso_slug?: string; codigo?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { mensagem: 'Corpo da requisição inválido.' }, 400)
  }

  const cursoSlug = body.curso_slug?.trim()
  if (!cursoSlug) {
    return jsonResponse(req, { mensagem: 'Informe o curso.' }, 400)
  }

  const resultado = await resolvePrice(cursoSlug, body.codigo)

  if (!resultado.ok) {
    return jsonResponse(req, {
      valido: false,
      mensagem: resultado.mensagem,
      // Presente só quando o curso existe e o problema foi o cupom — permite
      // ao front mostrar o preço cheio em vez de uma tela de "curso não encontrado".
      curso: resultado.curso
        ? {
            titulo: resultado.curso.titulo,
            preco_original_centavos: resultado.curso.preco_centavos,
            preco_pix_original_centavos: resultado.curso.preco_pix_centavos ?? resultado.curso.preco_centavos,
            max_parcelas: resultado.curso.max_parcelas,
          }
        : null,
    }, resultado.status)
  }

  return jsonResponse(req, {
    valido: true,
    curso: {
      titulo: resultado.curso.titulo,
      preco_original_centavos: resultado.curso.preco_centavos,
      preco_pix_original_centavos: resultado.curso.preco_pix_centavos ?? resultado.curso.preco_centavos,
      max_parcelas: resultado.curso.max_parcelas,
    },
    cartao: resultado.cartao,
    pix: resultado.pix,
  })
})
