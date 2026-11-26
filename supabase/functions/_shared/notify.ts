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

// 3 grupos separados no Telegram, pra não misturar tudo num só:
// - ATENCAO (TELEGRAM_CHAT_ID): o bot precisa de você — notificar_danilo, rascunho
//   esperando aprovação, arquivo recebido do lead.
// - LEADS (TELEGRAM_CHAT_ID_LEADS): lead novo chegou (formulário ou WhatsApp).
// - ERROS (TELEGRAM_CHAT_ID_ERROS): o bot falhou em alguma coisa.
export type DestinoTelegram = 'atencao' | 'leads' | 'erros'

function chatIdDoDestino(destino: DestinoTelegram): string | undefined {
  if (destino === 'leads') return Deno.env.get('TELEGRAM_CHAT_ID_LEADS') ?? Deno.env.get('TELEGRAM_CHAT_ID')
  if (destino === 'erros') return Deno.env.get('TELEGRAM_CHAT_ID_ERROS') ?? Deno.env.get('TELEGRAM_CHAT_ID')
  return Deno.env.get('TELEGRAM_CHAT_ID')
}

// Nunca lança erro — uma falha aqui não pode derrubar o cadastro do lead.
export async function enviarNotificacaoTelegram(lead: LeadParaNotificar) {
  const produto = lead.produto_interesse ? (PRODUTO_LABEL[lead.produto_interesse] ?? lead.produto_interesse) : null

  const texto = [
    '📋 Novo lead no formulário IEMESP',
    `Nome: ${lead.nome}`,
    lead.telefone ? `Telefone: ${lead.telefone}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    produto ? `Interesse: ${produto}` : null,
    lead.origem ? `Origem: ${lead.origem}${lead.utm_source ? ` (${lead.utm_source})` : ''}` : null,
  ].filter(Boolean).join('\n')

  await enviarTextoTelegram(texto, 'leads')
}

// Texto livre pro Telegram. Por padrão vai pro grupo "Preciso de você" (atencao);
// passe `destino` pra mandar pros outros dois grupos.
// Nunca lança erro, mesmo assim: uma falha aqui não pode travar a resposta do bot.
export async function enviarTextoTelegram(texto: string, destino: DestinoTelegram = 'atencao') {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = chatIdDoDestino(destino)
  if (!botToken || !chatId) {
    console.error(`TELEGRAM_BOT_TOKEN ou chat do destino "${destino}" não configurado — notificação não enviada.`)
    return
  }

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

export type BotaoTelegram = { text: string; callback_data?: string; url?: string }

// Igual a enviarTextoTelegram, mas com botões inline, e devolve o message_id
// (precisamos dele pra ligar um toque de botão, ou uma resposta por reply, de volta
// à conversa certa). Sempre vai pro grupo "Preciso de você" — é lá que moram os botões
// e as respostas por reply. Também nunca lança erro.
export async function enviarTelegramComBotoes(texto: string, botoes: BotaoTelegram[][]): Promise<number | null> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = chatIdDoDestino('atencao')
  if (!botToken || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configuradas — notificação não enviada.')
    return null
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, reply_markup: { inline_keyboard: botoes } }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Erro ao enviar notificação Telegram com botões:', data)
      return null
    }
    return data.result.message_id as number
  } catch (err) {
    console.error('Erro ao chamar API do Telegram:', err)
    return null
  }
}
