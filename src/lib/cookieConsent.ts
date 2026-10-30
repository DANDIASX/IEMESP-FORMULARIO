const CHAVE = 'iemesp_cookie_consent'

export type ConsentimentoCookies = 'aceito' | 'recusado'

export function getConsentimentoCookies(): ConsentimentoCookies | null {
  try {
    const valor = localStorage.getItem(CHAVE)
    return valor === 'aceito' || valor === 'recusado' ? valor : null
  } catch {
    return null
  }
}

export function setConsentimentoCookies(valor: ConsentimentoCookies) {
  try {
    localStorage.setItem(CHAVE, valor)
  } catch {
    // Sem localStorage (navegação privada etc.) — segue sem persistir,
    // o banner só volta a aparecer a cada visita.
  }
}
