import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackLead } from '../lib/metaPixel'
import { getAttribution, type Attribution } from '../lib/attribution'
import { formatPhone } from '../lib/phone'
import PaymentCTA from './PaymentCTA'

type Tipo = 'b2c' | 'b2b'
type ProdutoInteresse = 'curso_pratico' | 'plataforma' | 'ambos'

export default function LeadForm(){
  const [tipo, setTipo] = useState<Tipo>('b2c')
  const [produtoInteresse, setProdutoInteresse] = useState<ProdutoInteresse>('curso_pratico')
  const [attribution, setAttribution] = useState<Attribution>({
    utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
    gclid: null, fbclid: null, first_landing_page: null, referrer: null
  })
  const [form, setForm] = useState<any>({
    nome: '', email: '', telefone: '', crm: '', formacao: '', especializacao: '', trabalho: '', residencia: '', instituicao: '', cargo: '' , consentimento_lgpd: false,
    como_conheceu: '', objetivo: '', instagram: '', tiktok: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)

  useEffect(() => {
    setAttribution(getAttribution())
  }, [])

  const handleChange = (k: string, v: any) => setForm((s:any)=>({ ...s, [k]: v }))

  const normalizeHandle = (v: string) => {
    const semArroba = v.trim().replace(/^@+/, '')
    return semArroba ? `@${semArroba}` : null
  }

  const validate = () => {
    if(!form.nome || form.nome.trim().length === 0) { setError('Por favor, informe seu nome.'); return false }
    if(!form.telefone || form.telefone.replace(/\D/g,'').length < 10) { setError('Por favor, informe um telefone válido.'); return false }
    if(!form.consentimento_lgpd) { setError('É necessário aceitar o consentimento LGPD.'); return false }
    return true
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if(!validate()) return
    setLoading(true)
    const newLeadId = crypto.randomUUID()
    const payload = {
      id: newLeadId,
      tipo,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone,
      crm: form.crm || null,
      formacao: form.formacao || null,
      especializacao: form.especializacao || null,
      trabalho: form.trabalho || null,
      residencia: form.residencia || null,
      instagram: normalizeHandle(form.instagram || ''),
      tiktok: normalizeHandle(form.tiktok || ''),
      produto_interesse: produtoInteresse,
      instituicao: tipo === 'b2b' ? (form.instituicao || null) : null,
      cargo: tipo === 'b2b' ? (form.cargo || null) : null,
      como_conheceu: form.como_conheceu || null,
      objetivo: form.objetivo || null,
      origem: 'formulario',
      consentimento_lgpd: form.consentimento_lgpd,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
      first_landing_page: attribution.first_landing_page,
      referrer: attribution.referrer,
    }

    try{
      console.log('Enviando payload:', payload)
      const { data, error: supError } = await supabase.from('leads').insert([payload])
      console.log('Resposta supabase:', { data, supError })
      if(supError) throw supError
      setLeadId(newLeadId)
      setSuccess(true)
      trackLead()
    }catch(err:any){
      console.error('Erro ao enviar lead:', err)
      // Mostrar mensagem útil para debugging
      const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err))
      setError(message || 'Ocorreu um erro ao enviar. Por favor, tente novamente mais tarde.')
    }finally{
      setLoading(false)
    }
  }

  if(success) return (
    <div className="p-6 bg-white rounded shadow text-center">
      <h2 className="text-2xl font-poppins font-bold text-iemesp-900 mb-4">Recebemos seu contato</h2>
      <p>Em breve retornamos.</p>
      {leadId && <PaymentCTA leadId={leadId} produto={produtoInteresse} />}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="p-6 bg-white rounded shadow space-y-4">
      <input type="hidden" name="utm_source" value={attribution.utm_source ?? ''} />
      <input type="hidden" name="utm_medium" value={attribution.utm_medium ?? ''} />
      <input type="hidden" name="utm_campaign" value={attribution.utm_campaign ?? ''} />
      <input type="hidden" name="utm_content" value={attribution.utm_content ?? ''} />
      <input type="hidden" name="utm_term" value={attribution.utm_term ?? ''} />
      <input type="hidden" name="gclid" value={attribution.gclid ?? ''} />
      <input type="hidden" name="fbclid" value={attribution.fbclid ?? ''} />
      <input type="hidden" name="first_landing_page" value={attribution.first_landing_page ?? ''} />
      <input type="hidden" name="referrer" value={attribution.referrer ?? ''} />

      <div>
        <label className="block text-sm font-medium text-gray-700">Tipo</label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" checked={tipo==='b2c'} onChange={()=>setTipo('b2c')} />
            <span>Médico/Aluno</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" checked={tipo==='b2b'} onChange={()=>setTipo('b2b')} />
            <span>Instituição/Hospital</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nome *</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.nome} onChange={e=>handleChange('nome', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.email} onChange={e=>handleChange('email', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Telefone *</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.telefone} onChange={e=>handleChange('telefone', formatPhone(e.target.value))} inputMode="tel" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">CRM</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.crm} onChange={e=>handleChange('crm', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Formação (onde se formou/estuda)</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.formacao} onChange={e=>handleChange('formacao', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Especialização</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.especializacao} onChange={e=>handleChange('especializacao', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Trabalho</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.trabalho} onChange={e=>handleChange('trabalho', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Residência (cidade/UF)</label>
        <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.residencia} onChange={e=>handleChange('residencia', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Instagram (opcional)</label>
          <input className="mt-1 block w-full rounded border-gray-300 p-2" placeholder="@seuusuario" value={form.instagram} onChange={e=>handleChange('instagram', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">TikTok (opcional)</label>
          <input className="mt-1 block w-full rounded border-gray-300 p-2" placeholder="@seuusuario" value={form.tiktok} onChange={e=>handleChange('tiktok', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Como você conheceu a IEMESP?</label>
        <select className="mt-1 block w-full rounded border-gray-300 p-2" value={form.como_conheceu} onChange={e=>handleChange('como_conheceu', e.target.value)}>
          <option value="">Selecione</option>
          <option value="instagram">Instagram</option>
          <option value="indicacao">Indicação de colega/amigo</option>
          <option value="google">Google</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="outro">Outro</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tenho interesse em *</label>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='curso_pratico'} onChange={()=>setProdutoInteresse('curso_pratico')} />
            <span>Curso Procedimentos 2.0 (presencial)</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='plataforma'} onChange={()=>setProdutoInteresse('plataforma')} />
            <span>Plataforma de Educação Permanente (online) <span className="text-xs text-slate-400">(em construção)</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='ambos'} onChange={()=>setProdutoInteresse('ambos')} />
            <span>Os dois <span className="text-xs text-slate-400">(plataforma em construção)</span></span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">O que você busca com o curso? (opcional)</label>
        <textarea className="mt-1 block w-full rounded border-gray-300 p-2" rows={2} value={form.objetivo} onChange={e=>handleChange('objetivo', e.target.value)} />
      </div>

      {tipo === 'b2b' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Instituição</label>
            <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.instituicao} onChange={e=>handleChange('instituicao', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cargo</label>
            <input className="mt-1 block w-full rounded border-gray-300 p-2" value={form.cargo} onChange={e=>handleChange('cargo', e.target.value)} />
          </div>
        </>
      )}

      <div className="text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={form.consentimento_lgpd} onChange={e=>handleChange('consentimento_lgpd', e.target.checked)} />
          <span>Dou meu consentimento para uso dos meus dados conforme a LGPD. Autorizo contato para fins educacionais e comerciais.</span>
        </label>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={loading} className="bg-iemesp-900 text-white px-4 py-2 rounded">
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </form>
  )
}
