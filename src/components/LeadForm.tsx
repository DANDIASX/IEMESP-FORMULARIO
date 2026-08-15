import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Tipo = 'b2c' | 'b2b'
type ProdutoInteresse = 'curso_pratico' | 'plataforma' | 'ambos'

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '')
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`
}

const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  }
}

export default function LeadForm(){
  const [tipo, setTipo] = useState<Tipo>('b2c')
  const [produtoInteresse, setProdutoInteresse] = useState<ProdutoInteresse>('curso_pratico')
  const [utm, setUtm] = useState<{ utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }>({
    utm_source: null, utm_medium: null, utm_campaign: null
  })
  const [form, setForm] = useState<any>({
    nome: '', email: '', telefone: '', crm: '', formacao: '', especializacao: '', trabalho: '', residencia: '', instituicao: '', cargo: '' , consentimento_lgpd: false
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUtm(getUtmParams())
  }, [])

  const handleChange = (k: string, v: any) => setForm((s:any)=>({ ...s, [k]: v }))

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
    const payload = {
      tipo,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone,
      crm: form.crm || null,
      formacao: form.formacao || null,
      especializacao: form.especializacao || null,
      trabalho: form.trabalho || null,
      residencia: form.residencia || null,
      produto_interesse: produtoInteresse,
      instituicao: tipo === 'b2b' ? (form.instituicao || null) : null,
      cargo: tipo === 'b2b' ? (form.cargo || null) : null,
      origem: 'formulario',
      consentimento_lgpd: form.consentimento_lgpd,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
    }

    try{
      console.log('Enviando payload:', payload)
      const { data, error: supError } = await supabase.from('leads').insert([payload])
      console.log('Resposta supabase:', { data, supError })
      if(supError) throw supError
      setSuccess(true)
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
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="p-6 bg-white rounded shadow space-y-4">
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

      <div>
        <label className="block text-sm font-medium text-gray-700">Tenho interesse em *</label>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='curso_pratico'} onChange={()=>setProdutoInteresse('curso_pratico')} />
            <span>Curso Procedimentos 2.0 (presencial)</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='plataforma'} onChange={()=>setProdutoInteresse('plataforma')} />
            <span>Plataforma de Educação Permanente (online)</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="produto_interesse" className="mt-1" checked={produtoInteresse==='ambos'} onChange={()=>setProdutoInteresse('ambos')} />
            <span>Os dois</span>
          </label>
        </div>
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
