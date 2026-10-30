async function sha256(texto: string): Promise<string> {
  const data = new TextEncoder().encode(texto.trim().toLowerCase())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

type EventoCapi = {
  nomeEvento: 'Lead' | 'Purchase'
  email?: string | null
  telefone?: string | null
  valor?: number
  moeda?: string
  // Mesmo ID usado no evento do Pixel no navegador (lead.id ou pedido.id) —
  // permite a Meta deduplicar e não contar o mesmo lead/compra duas vezes.
  eventId: string
}

// Nunca lança erro — uma falha aqui não pode derrubar o fluxo principal.
export async function enviarEventoMetaCapi(evento: EventoCapi) {
  const pixelId = Deno.env.get('META_PIXEL_ID')
  const token = Deno.env.get('META_CAPI_TOKEN')
  if (!pixelId || !token) {
    console.error('META_PIXEL_ID ou META_CAPI_TOKEN não configuradas — evento CAPI não enviado.')
    return
  }

  const userData: Record<string, string[]> = {}
  if (evento.email) userData.em = [await sha256(evento.email)]
  if (evento.telefone) {
    const digitos = evento.telefone.replace(/\D/g, '')
    if (digitos) userData.ph = [await sha256(digitos)]
  }

  // Só setada temporariamente durante depuração — faz o evento aparecer na
  // hora na aba "Eventos de teste" do Gerenciador de Eventos.
  const testEventCode = Deno.env.get('META_TEST_EVENT_CODE')

  const payload = {
    data: [{
      event_name: evento.nomeEvento,
      event_time: Math.floor(Date.now() / 1000),
      event_id: evento.eventId,
      action_source: 'website',
      user_data: userData,
      ...(evento.valor !== undefined ? { custom_data: { value: evento.valor, currency: evento.moeda ?? 'BRL' } } : {}),
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('Erro ao enviar evento pra API de Conversões:', await res.text())
    }
  } catch (err) {
    console.error('Erro ao chamar API de Conversões:', err)
  }
}
