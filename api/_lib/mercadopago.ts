import { MercadoPagoConfig } from 'mercadopago'

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

if (!accessToken) {
  console.error('MERCADOPAGO_ACCESS_TOKEN não configurada. Verifique as variáveis de ambiente do deploy.')
}

export const mpClient = new MercadoPagoConfig({ accessToken: accessToken || 'missing-token' })
