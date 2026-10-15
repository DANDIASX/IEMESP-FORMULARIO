import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAttribution } from '../lib/attribution'
import { formatPhone } from '../lib/phone'
import { centavosToBRL } from '../lib/currency'

type CursoInfo = {
  titulo: string
  preco_original_centavos: number
  max_parcelas: number
}

export default function CheckoutPage(){
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const [loadingCurso, setLoadingCurso] = useState(true)
  const [cursoError, setCursoError] = useState<string | null>(null)
  const [curso, setCurso] = useState<CursoInfo | null>(null)

  const [codigo, setCodigo] = useState(searchParams.get('cupom') ?? '')
  const [cupomAplicado, setCupomAplicado] = useState<string | null>(null)
  const [descontoCentavos, setDescontoCentavos] = useState(0)
  const [precoFinalCentavos, setPrecoFinalCentavos] = useState(0)
  const [aplicandoCupom, setAplicandoCupom] = useState(false)
  const [cupomError, setCupomError] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
          setDescontoCentavos(0)
          setPrecoFinalCentavos(data.curso.preco_original_centavos)
          setCupomAplicado(null)
          setCupomError(mensagem)
        } else {
          setCursoError(mensagem)
        }
        return
      }
      setCurso(data.curso)
      setDescontoCentavos(data.desconto_centavos)
      setPrecoFinalCentavos(data.preco_final_centavos)
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!nome.trim()) { setSubmitError('Por favor, informe seu nome.'); return }
    if (!email.trim() || !email.includes('@')) { setSubmitError('Por favor, informe um e-mail válido.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setSubmitError('Por favor, informe um telefone válido.'); return }
    if (!consentimento) { setSubmitError('É necessário aceitar o consentimento LGPD.'); return }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('criar-pagamento', {
        body: {
          curso_slug: slug,
          codigo: cupomAplicado || undefined,
          nome: nome.trim(),
          email: email.trim(),
          telefone,
          consentimento_lgpd: true,
          utms: getAttribution(),
        },
      })
      if (error || !data?.init_point) {
        throw new Error(data?.error || 'Falha ao iniciar pagamento')
      }
      window.location.href = data.init_point
    } catch (err: any) {
      setSubmitError(err?.message || 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.')
      setSubmitting(false)
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
                <div className="inline-flex items-center rounded-full bg-iemesp-900/10 px-4 py-2 text-sm font-semibold text-iemesp-900">
                  IEMESP • Checkout
                </div>
                <h1 className="mt-6 text-3xl font-poppins font-bold text-iemesp-900">{curso.titulo}</h1>
              </div>

              <div className="mb-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-sm">
                <div className="flex justify-between">
                  <span>Valor do curso</span>
                  <span className={descontoCentavos > 0 ? 'line-through text-slate-400' : 'font-semibold'}>
                    {centavosToBRL(curso.preco_original_centavos)}
                  </span>
                </div>
                {descontoCentavos > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Desconto</span>
                    <span>- {centavosToBRL(descontoCentavos)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold text-iemesp-900">
                  <span>Total</span>
                  <span>{centavosToBRL(precoFinalCentavos)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Em até {curso.max_parcelas}x no cartão, ou Pix.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
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
                  disabled={submitting}
                  className="w-full rounded bg-iemesp-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? 'Preparando pagamento...' : 'Ir para pagamento'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
