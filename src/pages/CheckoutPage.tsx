import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAttribution } from '../lib/attribution'
import { formatPhone } from '../lib/phone'
import { centavosToBRL } from '../lib/currency'

type CursoInfo = {
  titulo: string
  preco_original_centavos: number
  preco_pix_original_centavos: number
  max_parcelas: number
}

type PrecoCalculado = { desconto_centavos: number; preco_final_centavos: number }

const PRECO_ZERADO: PrecoCalculado = { desconto_centavos: 0, preco_final_centavos: 0 }

export default function CheckoutPage(){
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const [loadingCurso, setLoadingCurso] = useState(true)
  const [cursoError, setCursoError] = useState<string | null>(null)
  const [curso, setCurso] = useState<CursoInfo | null>(null)

  const [codigo, setCodigo] = useState(searchParams.get('cupom') ?? '')
  const [cupomAplicado, setCupomAplicado] = useState<string | null>(null)
  const [precoCartao, setPrecoCartao] = useState<PrecoCalculado>(PRECO_ZERADO)
  const [precoPix, setPrecoPix] = useState<PrecoCalculado>(PRECO_ZERADO)
  const [aplicandoCupom, setAplicandoCupom] = useState(false)
  const [cupomError, setCupomError] = useState<string | null>(null)

  const [etapa, setEtapa] = useState<'dados' | 'metodo'>('dados')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [metodoEscolhido, setMetodoEscolhido] = useState<'cartao' | 'pix' | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const aplicarCupom = async (codigoParaAplicar: string) => {
    if (!slug) return
    setAplicandoCupom(true)
    setCupomError(null)
    try {
      const { data, error } = await supabase.functions.invoke('validar-cupom', {
        body: { curso_slug: slug, codigo: codigoParaAplicar || undefined },
      })
      if (error || !data?.valido) {
        const mensagem = data?.mensagem || 'Não foi possível validar o cupom.'
        if (data?.curso) {
          // Curso existe, só o cupom é que não valeu — mantém o preço cheio.
          setCurso(data.curso)
          setPrecoCartao({ desconto_centavos: 0, preco_final_centavos: data.curso.preco_original_centavos })
          setPrecoPix({ desconto_centavos: 0, preco_final_centavos: data.curso.preco_pix_original_centavos })
          setCupomAplicado(null)
          setCupomError(mensagem)
        } else {
          setCursoError(mensagem)
        }
        return
      }
      setCurso(data.curso)
      setPrecoCartao(data.cartao)
      setPrecoPix(data.pix)
      setCupomAplicado(codigoParaAplicar || null)
    } catch {
      setCupomError('Não foi possível validar o cupom. Tente novamente.')
    } finally {
      setAplicandoCupom(false)
    }
  }

  useEffect(() => {
    if (!slug) return
    setLoadingCurso(true)
    setCursoError(null)
    aplicarCupom(codigo).finally(() => setLoadingCurso(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const onConfirmarDados = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!nome.trim()) { setSubmitError('Por favor, informe seu nome.'); return }
    if (!email.trim() || !email.includes('@')) { setSubmitError('Por favor, informe um e-mail válido.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setSubmitError('Por favor, informe um telefone válido.'); return }
    if (!consentimento) { setSubmitError('É necessário aceitar o consentimento LGPD.'); return }

    setEtapa('metodo')
  }

  const pagarCom = async (metodo: 'cartao' | 'pix') => {
    setSubmitError(null)
    setMetodoEscolhido(metodo)
    try {
      const { data, error } = await supabase.functions.invoke('criar-pagamento', {
        body: {
          curso_slug: slug,
          codigo: cupomAplicado || undefined,
          nome: nome.trim(),
          email: email.trim(),
          telefone,
          consentimento_lgpd: true,
          metodo,
          utms: getAttribution(),
        },
      })
      if (error || !data?.init_point) {
        throw new Error(data?.error || 'Falha ao iniciar pagamento')
      }
      window.location.href = data.init_point
    } catch (err: any) {
      setSubmitError(err?.message || 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.')
      setMetodoEscolhido(null)
    }
  }

  return (
    <div className="min-h-screen bg-iemesp-cream text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white p-8 shadow-2xl">
          {loadingCurso ? (
            <p className="text-center text-slate-500">Carregando...</p>
          ) : !curso ? (
            <div className="text-center">
              <h1 className="text-2xl font-poppins font-bold text-iemesp-900">Curso não encontrado</h1>
              <p className="mt-2 text-slate-600">{cursoError || 'Verifique o link e tente novamente.'}</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <img
                  src="/logo-iemesp.png"
                  alt="IEMESP — Emergência para Emergencistas"
                  className="mx-auto w-full max-w-xs rounded-2xl sm:max-w-sm"
                />
                <h1 className="mt-6 text-3xl font-poppins font-bold text-iemesp-900">{curso.titulo}</h1>
              </div>

              <div className="mb-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-sm space-y-2">
                <div>
                  <div className="flex justify-between">
                    <span>Pix</span>
                    <span className={precoPix.desconto_centavos > 0 ? 'line-through text-slate-400' : 'font-semibold'}>
                      {centavosToBRL(curso.preco_pix_original_centavos)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-iemesp-900">
                    <span />
                    <span>{centavosToBRL(precoPix.preco_final_centavos)}</span>
                  </div>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span>Cartão em até {curso.max_parcelas}x sem juros</span>
                    <span className={precoCartao.desconto_centavos > 0 ? 'line-through text-slate-400' : 'font-semibold'}>
                      {centavosToBRL(curso.preco_original_centavos)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-iemesp-900">
                    <span />
                    <span>{centavosToBRL(precoCartao.preco_final_centavos)}</span>
                  </div>
                </div>
              </div>

              {etapa === 'dados' && (
                <form onSubmit={onConfirmarDados} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cupom de desconto</label>
                    <div className="mt-1 flex gap-2">
                      <input
                        className="block w-full rounded border-gray-300 p-2"
                        value={codigo}
                        onChange={e => setCodigo(e.target.value)}
                        placeholder="Opcional"
                      />
                      <button
                        type="button"
                        disabled={aplicandoCupom}
                        onClick={() => aplicarCupom(codigo)}
                        className="shrink-0 rounded bg-iemesp-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                      >
                        {aplicandoCupom ? 'Aplicando...' : 'Aplicar'}
                      </button>
                    </div>
                    {cupomError && <p className="mt-1 text-sm text-red-600">{cupomError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome *</label>
                    <input className="mt-1 block w-full rounded border-gray-300 p-2" value={nome} onChange={e => setNome(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">E-mail *</label>
                    <input type="email" className="mt-1 block w-full rounded border-gray-300 p-2" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone *</label>
                    <input
                      className="mt-1 block w-full rounded border-gray-300 p-2"
                      value={telefone}
                      onChange={e => setTelefone(formatPhone(e.target.value))}
                      inputMode="tel"
                    />
                  </div>

                  <div className="text-sm">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={consentimento} onChange={e => setConsentimento(e.target.checked)} />
                      <span>Dou meu consentimento para uso dos meus dados conforme a LGPD, para fins de pagamento e contato.</span>
                    </label>
                  </div>

                  {submitError && <div className="text-red-600 text-sm">{submitError}</div>}

                  <button
                    type="submit"
                    className="w-full rounded bg-iemesp-700 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Continuar
                  </button>
                </form>
              )}

              {etapa === 'metodo' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Como você prefere pagar?</p>

                  <button
                    type="button"
                    disabled={metodoEscolhido !== null}
                    onClick={() => pagarCom('pix')}
                    className="w-full rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-left transition hover:bg-iemesp-cream disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-iemesp-900">Pix</span>
                      <span className="font-bold text-iemesp-900">{centavosToBRL(precoPix.preco_final_centavos)}</span>
                    </div>
                    <p className="text-xs text-slate-500">Aprovação na hora.</p>
                  </button>

                  <button
                    type="button"
                    disabled={metodoEscolhido !== null}
                    onClick={() => pagarCom('cartao')}
                    className="w-full rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-left transition hover:bg-iemesp-cream disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-iemesp-900">Cartão de crédito</span>
                      <span className="font-bold text-iemesp-900">{centavosToBRL(precoCartao.preco_final_centavos)}</span>
                    </div>
                    <p className="text-xs text-slate-500">Em até {curso.max_parcelas}x sem juros.</p>
                  </button>

                  {metodoEscolhido && <p className="text-center text-sm text-slate-500">Preparando pagamento...</p>}
                  {submitError && <div className="text-red-600 text-sm">{submitError}</div>}

                  <button
                    type="button"
                    onClick={() => { setEtapa('dados'); setSubmitError(null) }}
                    className="w-full text-center text-sm text-slate-500 underline"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
