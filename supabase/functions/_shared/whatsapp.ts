const GRAPH_API_VERSION = 'v23.0'

// Só funciona dentro da janela de 24h desde a última mensagem do lead (fora dela, a
// Meta recusa texto livre — teria que ser um modelo aprovado, que ainda não existe).
// Nunca lança erro: quem chama decide o que fazer com { ok: false }.
export async function enviarMensagemWhatsapp(paraWaId: string, texto: string): Promise<{ ok: boolean; id?: string; erro?: unknown }> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId) {
    console.error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados — mensagem não enviada pelo WhatsApp.')
    return { ok: false, erro: 'credenciais não configuradas' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: paraWaId, type: 'text', text: { body: texto } }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Erro ao enviar mensagem WhatsApp:', JSON.stringify(data))
      return { ok: false, erro: data }
    }
    return { ok: true, id: data?.messages?.[0]?.id }
  } catch (err) {
    console.error('Erro ao chamar API do WhatsApp:', err)
    return { ok: false, erro: String(err) }
  }
}

export async function enviarDocumentoWhatsapp(
  paraWaId: string,
  urlDocumento: string,
  nomeArquivo: string,
): Promise<{ ok: boolean; id?: string; erro?: unknown }> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId) {
    console.error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados — documento não enviado pelo WhatsApp.')
    return { ok: false, erro: 'credenciais não configuradas' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: paraWaId,
        type: 'document',
        document: { link: urlDocumento, filename: nomeArquivo },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Erro ao enviar documento WhatsApp:', JSON.stringify(data))
      return { ok: false, erro: data }
    }
    return { ok: true, id: data?.messages?.[0]?.id }
  } catch (err) {
    console.error('Erro ao chamar API do WhatsApp (documento):', err)
    return { ok: false, erro: String(err) }
  }
}
