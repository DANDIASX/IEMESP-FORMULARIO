export type Attribution = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  gclid: string | null
  fbclid: string | null
  first_landing_page: string | null
  referrer: string | null
}

export function getAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search)
  const get = (key: string) => params.get(key) || null

  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    gclid: get('gclid'),
    fbclid: get('fbclid'),
    first_landing_page: window.location.href || null,
    referrer: document.referrer || null,
  }
}
