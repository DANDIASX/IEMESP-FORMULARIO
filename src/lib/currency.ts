export const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const centavosToBRL = (centavos: number) => formatBRL(centavos / 100)
