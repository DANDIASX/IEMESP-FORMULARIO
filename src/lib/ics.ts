type EventoTurma = {
  titulo: string
  dataTurma: string // 'YYYY-MM-DD'
  horario: string | null // ex: "8h às 18h"
  local: string | null
}

const parseHorario = (horario: string | null): { inicio: string; fim: string } => {
  const match = horario?.match(/(\d{1,2})h\s*(?:às|-|–)\s*(\d{1,2})h/)
  if (!match) return { inicio: '080000', fim: '180000' }
  const [, h1, h2] = match
  return { inicio: `${h1.padStart(2, '0')}0000`, fim: `${h2.padStart(2, '0')}0000` }
}

const escapeICS = (texto: string) => texto.replace(/[,;]/g, '\\$&')

export function gerarIcsTurma(evento: EventoTurma): string {
  const dataCompacta = evento.dataTurma.replace(/-/g, '')
  const { inicio, fim } = parseHorario(evento.horario)

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IEMESP//Checkout//PT-BR',
    'BEGIN:VEVENT',
    `UID:${evento.dataTurma}-${Date.now()}@iemesp.com.br`,
    `DTSTART;TZID=America/Sao_Paulo:${dataCompacta}T${inicio}`,
    `DTEND;TZID=America/Sao_Paulo:${dataCompacta}T${fim}`,
    `SUMMARY:${escapeICS(evento.titulo)}`,
    evento.local ? `LOCATION:${escapeICS(evento.local)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return linhas.join('\r\n')
}

export function baixarIcs(evento: EventoTurma){
  const conteudo = gerarIcsTurma(evento)
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'curso-iemesp.ics'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
