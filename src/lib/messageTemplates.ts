export type Channel = 'whatsapp' | 'email'

export type Objective =
  | 'boas_vindas'
  | 'qualificacao'
  | 'follow_up'
  | 'carrinho_abandonado'
  | 'reengajamento'
  | 'pos_venda_nps'

// Categorias exigidas pela Meta para templates de mensagem do WhatsApp Business API.
export type MetaCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

// Variáveis dinâmicas suportadas nos templates, no formato {{variavel}}.
export type TemplateVariable = 'nome' | 'curso' | 'estagio' | 'link_pagamento'

export const OBJECTIVES: { key: Objective; label: string }[] = [
  { key: 'boas_vindas', label: 'Boas-vindas' },
  { key: 'qualificacao', label: 'Qualificação' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'carrinho_abandonado', label: 'Carrinho abandonado' },
  { key: 'reengajamento', label: 'Reengajamento' },
  { key: 'pos_venda_nps', label: 'Pós-venda / NPS' },
]

type BaseTemplate = {
  id: string
  channel: Channel
  objective: Objective
  label: string
  body: string
}

export type WhatsappTemplate = BaseTemplate & {
  channel: 'whatsapp'
  // Se o template já foi aprovado pela Meta para envio via WhatsApp Business API.
  // Só é obrigatório fora da janela de 24h de atendimento; envio manual (wa.me) funciona mesmo sem aprovação.
  metaApproved: boolean
  metaCategory: MetaCategory
  // Nome cadastrado na Meta Business Manager. Null enquanto o template não foi submetido para aprovação.
  metaTemplateName: string | null
}

export type EmailTemplate = BaseTemplate & {
  channel: 'email'
  subject: string
}

export type MessageTemplate = WhatsappTemplate | EmailTemplate

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // WhatsApp
  {
    id: 'wa_boas_vindas',
    channel: 'whatsapp',
    objective: 'boas_vindas',
    label: 'Boas-vindas ao lead',
    body: 'Olá {{nome}}! Aqui é da IEMESP 👋 Recebemos seu interesse em {{curso}} e já vamos te passar todos os detalhes. Posso te ajudar com alguma dúvida agora?',
    metaApproved: true,
    metaCategory: 'UTILITY',
    metaTemplateName: 'iemesp_boas_vindas',
  },
  {
    id: 'wa_qualificacao',
    channel: 'whatsapp',
    objective: 'qualificacao',
    label: 'Entender o perfil do lead',
    body: 'Oi {{nome}}, tudo bem? Para te indicar a melhor opção, me conta: você já atua na área ou está começando agora? Assim consigo te ajudar melhor sobre {{curso}}.',
    metaApproved: true,
    metaCategory: 'UTILITY',
    metaTemplateName: 'iemesp_qualificacao',
  },
  {
    id: 'wa_follow_up',
    channel: 'whatsapp',
    objective: 'follow_up',
    label: 'Retomar contato',
    body: 'Olá {{nome}}, passando para saber se ficou alguma dúvida sobre {{curso}}. Vi que você está na fase "{{estagio}}" — posso te ajudar a dar o próximo passo?',
    metaApproved: false,
    metaCategory: 'MARKETING',
    metaTemplateName: null,
  },
  {
    id: 'wa_carrinho_abandonado',
    channel: 'whatsapp',
    objective: 'carrinho_abandonado',
    label: 'Pagamento não concluído',
    body: 'Oi {{nome}}! Vi que você iniciou a inscrição em {{curso}} mas o pagamento não foi concluído. Segue o link para finalizar e garantir sua vaga: {{link_pagamento}}',
    metaApproved: true,
    metaCategory: 'MARKETING',
    metaTemplateName: 'iemesp_pagamento_pendente',
  },
  {
    id: 'wa_reengajamento',
    channel: 'whatsapp',
    objective: 'reengajamento',
    label: 'Reengajar lead frio',
    body: 'Olá {{nome}}, faz um tempo que não conversamos! As turmas de {{curso}} têm vagas abrindo novamente. Ainda tem interesse?',
    metaApproved: false,
    metaCategory: 'MARKETING',
    metaTemplateName: null,
  },
  {
    id: 'wa_pos_venda_nps',
    channel: 'whatsapp',
    objective: 'pos_venda_nps',
    label: 'Pesquisa de satisfação',
    body: 'Oi {{nome}}! Já faz um tempo desde {{curso}}. De 0 a 10, qual nota você daria pra sua experiência com a IEMESP? Sua resposta nos ajuda muito 🙏',
    metaApproved: true,
    metaCategory: 'UTILITY',
    metaTemplateName: 'iemesp_nps',
  },

  // E-mail
  {
    id: 'email_boas_vindas',
    channel: 'email',
    objective: 'boas_vindas',
    label: 'Boas-vindas ao lead',
    subject: 'Recebemos seu interesse em {{curso}} — IEMESP',
    body: 'Olá {{nome}},\n\nObrigado por se inscrever para saber mais sobre {{curso}}! Em breve nossa equipe entra em contato com todos os detalhes.\n\nQualquer dúvida, é só responder este e-mail.\n\nAbraço,\nEquipe IEMESP',
  },
  {
    id: 'email_qualificacao',
    channel: 'email',
    objective: 'qualificacao',
    label: 'Entender o perfil do lead',
    subject: 'Vamos entender melhor seu perfil, {{nome}}?',
    body: 'Olá {{nome}},\n\nPara te indicar a melhor opção dentro de {{curso}}, me conta um pouco sobre sua atuação hoje e o que você busca com o curso.\n\nAssim consigo te orientar da forma certa.\n\nAbraço,\nEquipe IEMESP',
  },
  {
    id: 'email_follow_up',
    channel: 'email',
    objective: 'follow_up',
    label: 'Retomar contato',
    subject: 'Ficou alguma dúvida sobre {{curso}}?',
    body: 'Olá {{nome}},\n\nPassando para saber se ficou alguma dúvida sobre {{curso}}. Você está na fase "{{estagio}}" do seu processo com a gente — estou à disposição para ajudar no que precisar.\n\nAbraço,\nEquipe IEMESP',
  },
  {
    id: 'email_carrinho_abandonado',
    channel: 'email',
    objective: 'carrinho_abandonado',
    label: 'Pagamento não concluído',
    subject: '{{nome}}, finalize sua inscrição em {{curso}}',
    body: 'Olá {{nome}},\n\nVimos que sua inscrição em {{curso}} ficou pendente de pagamento. Para garantir sua vaga, finalize por aqui:\n\n{{link_pagamento}}\n\nQualquer dificuldade, é só nos chamar.\n\nAbraço,\nEquipe IEMESP',
  },
  {
    id: 'email_reengajamento',
    channel: 'email',
    objective: 'reengajamento',
    label: 'Reengajar lead frio',
    subject: 'Novas vagas em {{curso}} — {{nome}}',
    body: 'Olá {{nome}},\n\nFaz um tempo que não conversamos! Abrimos novas turmas de {{curso}} e lembramos do seu interesse.\n\nAinda faz sentido para você? Podemos retomar a conversa.\n\nAbraço,\nEquipe IEMESP',
  },
  {
    id: 'email_pos_venda_nps',
    channel: 'email',
    objective: 'pos_venda_nps',
    label: 'Pesquisa de satisfação',
    subject: 'Como foi sua experiência com {{curso}}?',
    body: 'Olá {{nome}},\n\nJá faz um tempo desde {{curso}} e adoraríamos saber como foi sua experiência.\n\nDe 0 a 10, qual nota você daria para a IEMESP? Basta responder este e-mail com a nota e, se quiser, um comentário.\n\nAbraço,\nEquipe IEMESP',
  },
]

export function templatesFor(channel: Channel, objective: Objective | 'all' = 'all'): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => t.channel === channel && (objective === 'all' || t.objective === objective))
}

export function extractVariables(text: string): TemplateVariable[] {
  const matches = text.matchAll(/\{\{(\w+)\}\}/g)
  return Array.from(new Set(Array.from(matches, m => m[1] as TemplateVariable)))
}

// Substitui {{variavel}} pelos valores informados. Variáveis sem valor ficam visíveis
// (ex: "{{link_pagamento}}") e são listadas em `missing`, para o preview avisar antes do envio.
export function renderTemplate(
  text: string,
  values: Partial<Record<TemplateVariable, string | undefined>>
): { text: string; missing: TemplateVariable[] } {
  const missing: TemplateVariable[] = []
  const rendered = text.replace(/\{\{(\w+)\}\}/g, (match, key: TemplateVariable) => {
    const value = values[key]
    if (!value) {
      missing.push(key)
      return match
    }
    return value
  })
  return { text: rendered, missing: Array.from(new Set(missing)) }
}
