import React from 'react'
import LeadForm from './components/LeadForm'

export default function App(){
  return (
    <div className="min-h-screen bg-iemesp-cream text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center rounded-full bg-iemesp-900/10 px-4 py-2 text-sm font-semibold text-iemesp-900">
              IEMESP • Emergência por emergencistas
            </div>
            <h1 className="mt-6 text-4xl font-poppins font-bold text-iemesp-900">Formulário de Inscrição</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">Preencha seus dados para receber informações sobre cursos e eventos da IEMESP.</p>
          </div>

          <LeadForm />
        </div>
      </div>
    </div>
  )
}
