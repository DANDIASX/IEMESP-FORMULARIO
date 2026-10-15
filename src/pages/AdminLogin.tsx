import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLogin(){
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError('Email ou senha incorretos.')
      return
    }
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-iemesp-cream flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 space-y-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-poppins font-bold text-iemesp-900">Painel IEMESP</h1>
          <p className="text-sm text-slate-500 mt-1">Entre com sua conta para acessar o CRM.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            required
            className="mt-1 block w-full rounded border-gray-300 p-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Senha</label>
          <input
            type="password"
            required
            className="mt-1 block w-full rounded border-gray-300 p-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-iemesp-900 text-white px-4 py-2 rounded">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
