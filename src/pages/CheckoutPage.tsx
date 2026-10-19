import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAttribution } from '../lib/attribution'
import { formatPhone } from '../lib/phone'
import { centavosToBRL } from '../lib/currency'
import { formatarDataBR } from '../lib/date'

type CursoInfo = {
  titulo: string
  preco_original_centavos: number
  preco_pix_original_centavos: number
  max_parcelas: number
}

type TurmaDisponivel = {
  slug: string
  nome: string
  data_turma: string
  horario: string | null
  local: string | null
  vagas_restantes: number
  status: string
}

type PrecoCalculado = { desconto_centavos: number; preco_final_centavos: number }
type Etapa = 'dados' | 'turma' | 'perfil' | 'metodo'
type Perfil = 'medico' | 'interno' | 'estudante'

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

  const [turmas, setTurmas] = useState<TurmaDisponivel[]>([])
  const [loadingTurmas, setLoadingTurmas] = useState(false)
  const [turmaSlug, setTurmaSlug] = useState(searchParams.get('turma') ?? '')

  const [etapa, setEtapa] = useState<Etapa>('dados')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [leadId, setLeadId] = useState<string | null>(searchParams.get('lead'))
  const [registrandoInteresse, setRegistrandoInteresse] = useState(false)

  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [crmNumero, setCrmNumero] = useState('')
  const [crmUf, setCrmUf] = useState('')
  const [faculdade, setFaculdade] = useState('')
  const [anoCurso, setAnoCurso] = useState('')
  const [aceiteComprovante, setAceiteComprovante] = useState(false)
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

  const carregarTurmas = async () => {
    if (!slug) return
    setLoadingTurmas(true)
    try {
      const { data } = await supabase.functions.invoke('listar-turmas', { body: { curso_slug: slug } })
      setTurmas((data?.turmas as TurmaDisponivel[]) ?? [])
    } finally {
      setLoadingTurmas(false)
    }
  }

  useEffect(() => {
    if (!slug) return
    setLoadingCurso(true)
    setCursoError(null)
    Promise.all([aplicarCupom(codigo), carregarTurmas()]).finally(() => setLoadingCurso(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const onConfirmarDados = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!nome.trim()) { setSubmitError('Por favor, informe seu nome.'); return }
    if (!email.trim() || !email.includes('@')) { setSubmitError('Por favor, informe um e-mail válido.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setSubmitError('Por favor, informe um telefone válido.'); return }

    setRegistrandoInteresse(true)
    try {
      const { data } = await supabase.functions.invoke('registrar-interesse-checkout', {
        body: { nome: nome.trim(), email: email.trim(), telefone, utms: getAttribution() },
      })
      if (data?.lead_id) setLeadId(data.lead_id)
    } catch {
      // Não bloqueia o checkout se isso falhar — só perde o "retomar quem abandonou".
    } finally {
      setRegistrandoInteresse(false)
    }

    setEtapa('turma')
  }

  const onEscolherTurma = (slugEscolhido: string) => {
    setTurmaSlug(slugEscolhido)
    setEtapa('perfil')
  }

  const onConfirmarPerfil = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!perfil) { setSubmitError('Selecione seu perfil.'); return }
    if (perfil === 'medico' && (!crmNumero.trim() || !crmUf.trim())) {
      setSubmitError('Informe seu CRM e a UF.'); return
    }
    if ((perfil === 'interno' || perfil === 'estudante')) {
      if (!faculdade.trim()) { setSubmitError('Informe sua faculdade.'); return }
      if (!aceiteComprovante) { setSubmitError('Confirme que vai apresentar o comprovante de matrícula no dia do curso.'); return }
    }
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
          turma_slug: turmaSlug,
          codigo: cupomAplicado || undefined,
          nome: nome.trim(),
          email: email.trim(),
          telefone,
          consentimento_lgpd: true,
          metodo,
          perfil,
          crm_numero: perfil === 'medico' ? crmNumero.trim() : undefined,
          crm_uf: perfil === 'medico' ? crmUf.trim() : undefined,
          faculdade: perfil !== 'medico' ? faculdade.trim() : undefined,
          ano_curso: perfil !== 'medico' ? anoCurso.trim() : undefined,
          lead_id_hint: leadId ?? undefined,
          utms: getAttribution(),
        },
      })
      if (error || !data?.init_point) {
        if (data?.sem_vagas) {
          setSubmitError('Essa turma acabou de lotar. Escolha a outra turma, ou fale com a gente no WhatsApp pra entrar na lista de espera.')
          setEtapa('turma')
          carregarTurmas()
          setMetodoEscolhido(null)
          return
        }
        throw new Error(data?.error || 'Falha ao iniciar pagamento')
      }
      window.location.href = data.init_point
    } catch (err: any) {
      setSubmitError(err?.message || 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.')
      setMetodoEscolhido(null)
    }
  }

  const turmaSelecionada = turmas.find(t => t.slug === turmaSlug)

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

              {/* Resumo fixo */}
              <div className="mb-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-sm space-y-2">
                {turmaSelecionada ? (
                  <div className="border-b pb-2">
                    <p className="font-semibold text-iemesp-900">{turmaSelecionada.nome}</p>
                    {turmaSelecionada.local && <p className="text-slate-600">{turmaSelecionada.local}</p>}
                    {turmaSelecionada.horario && <p className="text-slate-600">{turmaSelecionada.horario}</p>}
                  </div>
                ) : turmas.length > 0 ? (
                  <div className="border-b pb-2">
                    <p className="font-semibold text-iemesp-900">Datas disponíveis</p>
                    <p className="text-slate-600">
                      {turmas.map(t => formatarDataBR(t.data_turma)).join(' ou ')}
                      {turmas[0]?.local ? ` · ${turmas[0].local}` : ''}
                    </p>
                  </div>
                ) : null}
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
                <p className="text-xs text-slate-500">
                  O valor do Pix é diferente do cartão (Lei 13.455/2017) — escolha a forma de pagamento antes de ir pro Mercado Pago.
                </p>
              </div>

              {/* Etapa 1: dados */}
              {etapa === 'dados' && (
                <form onSubmit={onConfirmarDados} className="space-y-4">
                  <h2 className="text-lg font-bold text-iemesp-900">Seus dados</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome *</label>
                    <input className="mt-1 block w-full rounded border-gray-300 p-2" value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">E-mail *</label>
                    <input type="email" className="mt-1 block w-full rounded border-gray-300 p-2" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone (WhatsApp) *</label>
                    <input
                      className="mt-1 block w-full rounded border-gray-300 p-2"
                      value={telefone}
                      onChange={e => setTelefone(formatPhone(e.target.value))}
                      inputMode="tel"
                    />
                  </div>
                  {submitError && <div className="text-red-600 text-sm">{submitError}</div>}
                  <button
                    type="submit"
                    disabled={registrandoInteresse}
                    className="w-full rounded bg-iemesp-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Continuar
                  </button>
                </form>
              )}

              {/* Etapa 2: turma */}
              {etapa === 'turma' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-iemesp-900">Escolha a turma</h2>
                  {submitError && <div className="text-red-600 text-sm">{submitError}</div>}
                  {loadingTurmas && <p className="text-sm text-slate-500">Carregando turmas...</p>}
                  {!loadingTurmas && turmas.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhuma turma disponível no momento.</p>
                  )}
                  {turmas.map(t => (
                    <button
                      key={t.slug}
                      type="button"
                      disabled={t.vagas_restantes === 0}
                      onClick={() => onEscolherTurma(t.slug)}
                      className="w-full rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-4 text-left transition hover:bg-iemesp-cream disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-iemesp-900">{formatarDataBR(t.data_turma)}</span>
                        <span className={`text-xs font-semibold ${t.vagas_restantes === 0 ? 'text-red-600' : t.vagas_restantes <= 4 ? 'text-orange-600' : 'text-emerald-700'}`}>
                          {t.vagas_restantes === 0 ? 'Esgotada' : `${t.vagas_restantes} vaga${t.vagas_restantes === 1 ? '' : 's'} restante${t.vagas_restantes === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      {t.local && <p className="text-xs text-slate-500">{t.local}{t.horario ? ` · ${t.horario}` : ''}</p>}
                    </button>
                  ))}
                  <button type="button" onClick={() => setEtapa('dados')} className="text-sm text-slate-500 underline">Voltar</button>
                </div>
              )}

              {/* Etapa 3: perfil e verificação */}
              {etapa === 'perfil' && (
                <form onSubmit={onConfirmarPerfil} className="space-y-4">
                  <h2 className="text-lg font-bold text-iemesp-900">Perfil e verificação</h2>
                  <p className="text-xs text-slate-500">
                    Curso exclusivo para médicos com CRM ativo e estudantes de medicina; conferimos os dados antes de confirmar a vaga.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Você é *</label>
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="perfil" checked={perfil === 'medico'} onChange={() => setPerfil('medico')} /> Médico(a)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="perfil" checked={perfil === 'interno'} onChange={() => setPerfil('interno')} /> Interno(a) / 5º–6º ano
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="perfil" checked={perfil === 'estudante'} onChange={() => setPerfil('estudante')} /> Estudante 1º–4º ano
                      </label>
                    </div>
                  </div>

                  {perfil === 'medico' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">CRM *</label>
                        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={crmNumero} onChange={e => setCrmNumero(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">UF *</label>
                        <input className="mt-1 block w-full rounded border-gray-300 p-2" maxLength={2} value={crmUf} onChange={e => setCrmUf(e.target.value.toUpperCase())} />
                      </div>
                    </div>
                  )}

                  {(perfil === 'interno' || perfil === 'estudante') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Faculdade *</label>
                        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={faculdade} onChange={e => setFaculdade(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Ano do curso</label>
                        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={anoCurso} onChange={e => setAnoCurso(e.target.value)} />
                      </div>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={aceiteComprovante} onChange={e => setAceiteComprovante(e.target.checked)} />
                        <span>Apresentarei comprovante de matrícula no dia do curso.</span>
                      </label>
                    </>
                  )}

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

                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={consentimento} onChange={e => setConsentimento(e.target.checked)} />
                    <span>Dou meu consentimento para uso dos meus dados conforme a LGPD, para fins de pagamento e contato.</span>
                  </label>

                  {submitError && <div className="text-red-600 text-sm">{submitError}</div>}

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEtapa('turma')} className="rounded px-4 py-3 text-sm text-slate-500 underline">Voltar</button>
                    <button type="submit" className="flex-1 rounded bg-iemesp-700 px-4 py-3 text-sm font-semibold text-white">Continuar</button>
                  </div>
                </form>
              )}

              {/* Etapa 4: pagamento */}
              {etapa === 'metodo' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-iemesp-900">Como você prefere pagar?</h2>

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

                  <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    <summary className="cursor-pointer font-semibold text-slate-600">Política de cancelamento</summary>
                    <p className="mt-2">
                      Você tem direito de se arrepender da compra em até 7 dias corridos após o pagamento, com reembolso
                      integral, conforme o art. 49 do Código de Defesa do Consumidor. Dúvidas? Fale com a gente no WhatsApp.
                    </p>
                  </details>

                  <button
                    type="button"
                    onClick={() => { setEtapa('perfil'); setSubmitError(null) }}
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
