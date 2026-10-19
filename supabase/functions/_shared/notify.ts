type LeadParaNotificar = {
  nome: string
  telefone?: string | null
  email?: string | null
  produto_interesse?: string | null
  origem?: string | null
  utm_source?: string | null
}

const PRODUTO_LABEL: Record<string, string> = {
  curso_pratico: 'Curso Procedimentos 2.0 (presencial)',
  plataforma: 'Plataforma de Educação Permanente',
  ambos: 'Curso + Plataforma',
}

// Nunca lança erro — uma falha aqui não pode derrubar o cadastro do lead.
export async function enviarNotificacaoTelegram(lead: LeadParaNotificar) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!botToken || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configuradas — notificação não enviada.')
    return
  }

  const produto = lead.produto_interesse ? (PRODUTO_LABEL[lead.produto_interesse] ?? lead.produto_interesse) : null

  const texto = [
    '📋 Novo lead no formulário IEMESP',
    `Nome: ${lead.nome}`,
    lead.telefone ? `Telefone: ${lead.telefone}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    produto ? `Interesse: ${produto}` : null,
    lead.origem ? `Origem: ${lead.origem}${lead.utm_source ? ` (${lead.utm_source})` : ''}` : null,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    })
    if (!res.ok) {
      console.error('Erro ao enviar notificação Telegram:', await res.text())
    }
  } catch (err) {
    console.error('Erro ao chamar API do Telegram:', err)
  }
}
