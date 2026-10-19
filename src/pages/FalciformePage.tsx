import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackLead } from '../lib/metaPixel'
import { getAttribution } from '../lib/attribution'
import { formatPhone } from '../lib/phone'

type Perfil = 'medico' | 'interno' | 'estudante' | 'outro'
type TurmaInteresse = '23/01/2027' | '20/02/2027' | 'ainda_nao_sei'

const WHATSAPP_NUMERO = '5511998541993'
const INSTAGRAM_HANDLE = '@iemesp_oficial'
const SIGLA_LIGA = 'LAHTC e LIMIEU'
const CUPOM_CODIGO = 'UNICID200'
const CUPOM_VALOR = 'R$ 200'
const CUPOM_VALIDADE = '27/10/2026'

const PROCEDIMENTOS = [
  'Intubação com videolaringoscópio',
  'Intubação com laringoscópio direto',
  'Passagem de dispositivos supraglóticos',
  'Acesso venoso central guiado por ultrassom',
  'Acesso venoso central guiado pela anatomia',
  'Técnica de Seldinger completa — da paramentação à fixação na pele',
]

const REFERENCIAS = [
  'PCDT Doença Falciforme 2024 (Ministério da Saúde)',
  'ASH 2020',
  'Diretriz francesa SRLF 2025',
  'UpToDate 2026',
  'Alshahrani 2022',
  'Tanabe 2018',
  'Hutcherson 2025',
]

const PERFIL_LABEL: Record<Perfil, string> = {
  medico: 'Médico(a)',
  interno: 'Interno(a) / 5º–6º ano',
  estudante: 'Estudante 1º–4º ano',
  outro: 'Outro profissional',
}

export default function FalciformePage(){
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [turmaInteresse, setTurmaInteresse] = useState<TurmaInteresse>('ainda_nao_sei')
  const [aceite, setAceite] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tituloAnterior = document.title
    document.title = 'Mapa mental · Doença falciforme no PS | IEMESP'
    return () => { document.title = tituloAnterior }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nome.trim()) { setError('Por favor, informe seu nome.'); return }
    if (whatsapp.replace(/\D/g, '').length < 10) { setError('Por favor, informe um WhatsApp válido.'); return }
    if (!perfil) { setError('Selecione seu perfil.'); return }
    if (!aceite) { setError('É necessário aceitar receber mensagens no WhatsApp.'); return }

    setSubmitting(true)
    const attribution = getAttribution()
    const ehQualificado = perfil !== 'outro'

    const payload = {
      id: crypto.randomUUID(),
      tipo: 'b2c',
      nome: nome.trim(),
      telefone: `55${whatsapp.replace(/\D/g, '')}`,
      perfil,
      turma_interesse: ehQualificado ? turmaInteresse : null,
      cupom: ehQualificado ? CUPOM_CODIGO : null,
      origem: 'liga',
      consentimento_lgpd: aceite,
      utm_source: attribution.utm_source ?? 'liga-lahtc-limieu',
      utm_medium: attribution.utm_medium ?? 'qrcode',
      utm_campaign: attribution.utm_campaign ?? 'aula_falciforme_out26',
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
      first_landing_page: attribution.first_landing_page,
      referrer: attribution.referrer,
    }

    try {
      const { error: supError } = await supabase.from('leads').insert([payload])
      if (supError) throw supError
      setSubmitted(true)
      if (ehQualificado) trackLead()
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro ao enviar. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  const mensagemWhatsapp = encodeURIComponent(
    `Olá! Vim da aula de doença falciforme na ${SIGLA_LIGA} e quero saber do curso prático.`
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FBFAF7', fontFamily: 'Inter, sans-serif' }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

        {/* Topo */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide" style={{ backgroundColor: '#15717022', color: '#157170' }}>
            MATERIAL DA AULA
          </span>
          <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl" style={{ color: '#0F2340' }}>
            Doença falciforme no pronto-socorro
          </h1>
        </div>

        {/* Download do mapa mental */}
        <div className="mt-6 rounded-2xl p-5 text-center shadow-sm" style={{ backgroundColor: '#0F2340' }}>
          <p className="text-sm font-medium text-white/80">Baixe agora, sem cadastro</p>
          <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <a
              href="/materiais/mapa-mental-falciforme.png"
              download
              className="w-full rounded-xl px-6 py-3 text-base font-bold text-white transition hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: '#B4471F' }}
            >
              Baixar mapa mental
            </a>
            <a
              href="/materiais/mapa-mental-falciforme.png"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-white/80 underline underline-offset-2"
            >
              Ou abrir em nova aba
            </a>
          </div>
        </div>

        {/* Referências */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#157170' }}>Referências da aula</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {REFERENCIAS.map(ref => <li key={ref}>· {ref}</li>)}
          </ul>
        </div>

        {/* Curso prático */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold" style={{ color: '#0F2340' }}>
            Procedimentos 2.0 — curso prático de procedimentos de emergência
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            {PROCEDIMENTOS.map(p => <li key={p}>· {p}</li>)}
            <li>· Estação prática, com correção de emergencistas</li>
            <li>· 18 vagas por turma</li>
          </ul>
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ backgroundColor: '#FBFAF7' }}>
            <p><strong>Turmas:</strong> sábado, 23/01/2027 · sábado, 20/02/2027</p>
            <p className="mt-1"><strong>Horário:</strong> 8h às 18h (10h de carga horária)</p>
            <p className="mt-1"><strong>Local:</strong> Rua Cardoso de Almeida, 634</p>
          </div>
          <p className="mt-4 text-base font-semibold" style={{ color: '#0F2340' }}>
            R$ 2.098 no Pix ou 6x de R$ 383 sem juros no cartão (total R$ 2.298)
          </p>
          <div className="mt-3 rounded-xl p-3 text-sm font-semibold" style={{ backgroundColor: '#D9A44122', color: '#8a6a1f' }}>
            Membros da {SIGLA_LIGA}: cupom <strong>{CUPOM_CODIGO}</strong> com {CUPOM_VALOR} de desconto até {CUPOM_VALIDADE}.
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Curso exclusivo para médicos com CRM ativo e estudantes de medicina (Resolução CFM 1.718/2004; Resolução CFM 2.336/2023, art. 9º, XIII e XIV).
          </p>
        </div>

        {/* Formulário */}
        {!submitted ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold" style={{ color: '#0F2340' }}>Quero saber mais</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nome *</label>
              <input className="mt-1 block w-full rounded-lg border-gray-300 p-2.5" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">WhatsApp *</label>
              <input
                className="mt-1 block w-full rounded-lg border-gray-300 p-2.5"
                placeholder="(11) 91234-5678"
                value={whatsapp}
                onChange={e => setWhatsapp(formatPhone(e.target.value))}
                inputMode="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Perfil *</label>
              <div className="mt-2 space-y-2">
                {(Object.keys(PERFIL_LABEL) as Perfil[]).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="perfil" checked={perfil === key} onChange={() => setPerfil(key)} />
                    {PERFIL_LABEL[key]}
                  </label>
                ))}
              </div>
            </div>

            {perfil && perfil !== 'outro' && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Turma de interesse</label>
                <select
                  className="mt-1 block w-full rounded-lg border-gray-300 p-2.5"
                  value={turmaInteresse}
                  onChange={e => setTurmaInteresse(e.target.value as TurmaInteresse)}
                >
                  <option value="23/01/2027">Sábado, 23/01/2027</option>
                  <option value="20/02/2027">Sábado, 20/02/2027</option>
                  <option value="ainda_nao_sei">Ainda não sei</option>
                </select>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" className="mt-1" checked={aceite} onChange={e => setAceite(e.target.checked)} />
              <span>Aceito receber mensagens do IEMESP no WhatsApp.</span>
            </label>
            <p className="text-xs text-slate-400">
              Seus dados são usados apenas para contato sobre o curso, conforme a LGPD.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl px-4 py-3 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#0F2340' }}
            >
              {submitting ? 'Enviando...' : 'Quero saber mais'}
            </button>
          </form>
        ) : perfil === 'outro' ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-base font-medium" style={{ color: '#0F2340' }}>
              O curso prático é exclusivo para médicos e estudantes de medicina. Obrigado pelo interesse!
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-base font-medium" style={{ color: '#0F2340' }}>
              Recebemos seu interesse. Vou te chamar no WhatsApp.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}?text=${mensagemWhatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block w-full rounded-xl px-6 py-3 text-base font-bold text-white transition hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: '#157170' }}
            >
              Falar agora no WhatsApp
            </a>
            <p className="mt-3 text-sm text-slate-500">
              ou no Instagram{' '}
              <a href={`https://instagram.com/${INSTAGRAM_HANDLE.replace('@', '')}`} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: '#B4471F' }}>
                {INSTAGRAM_HANDLE}
              </a>
            </p>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-500">
          <p>Responsável técnico: Danilo Dias de Francesco · MÉDICO · CRM-SP 197024 · RQE 136263</p>
          <p className="mt-2 space-x-3">
            <a href={`https://instagram.com/${INSTAGRAM_HANDLE.replace('@', '')}`} target="_blank" rel="noreferrer" className="underline">Instagram</a>
            <a href={`https://wa.me/${WHATSAPP_NUMERO}`} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>
            <a href="https://iemesp.com.br" target="_blank" rel="noreferrer" className="underline">iemesp.com.br</a>
          </p>
        </div>
      </div>
    </div>
  )
}
