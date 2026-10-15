export const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined

function callFbq(...args: any[]) {
  ;(window as any).fbq?.(...args)
}

export function initMetaPixel() {
  if (!META_PIXEL_ID || (window as any).fbq) return

  const w = window as any
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = (f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode?.insertBefore(t, s)
  })(w, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

  callFbq('init', META_PIXEL_ID)
  callFbq('track', 'PageView')
}

export function trackLead() {
  callFbq('track', 'Lead')
}

export function trackPurchase(value: number, currency = 'BRL') {
  callFbq('track', 'Purchase', { value, currency })
}
