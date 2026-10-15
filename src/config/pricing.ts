export type ProdutoInteresse = 'curso_pratico' | 'plataforma' | 'ambos'

export const PRODUCTS: Record<ProdutoInteresse, { label: string; price: number }> = {
  curso_pratico: { label: 'Curso Procedimentos 2.0 (presencial)', price: 2200 },
  plataforma: { label: 'Plataforma de Educação Permanente', price: 1400 },
  ambos: { label: 'Curso + Plataforma (combo)', price: 3299.99 },
}
