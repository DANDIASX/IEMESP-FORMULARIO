import { useEffect } from 'react'

// Troca o título da aba enquanto a página está montada e devolve o anterior
// ao sair — evita que todas as páginas mostrem o mesmo título genérico do
// index.html (ruim pra quem navega com várias abas abertas e pra links
// compartilhados, que usam o título como texto da prévia).
export function useDocumentTitle(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return
    const tituloAnterior = document.title
    document.title = titulo
    return () => { document.title = tituloAnterior }
  }, [titulo])
}
