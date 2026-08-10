IEMESP - Formulário de Leads

Instruções rápidas (português):

1. Copie `.env.example` para `.env` e preencha suas chaves Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Instale dependências:

```bash
npm install
```

3. Rode em desenvolvimento:

```bash
npm run dev
```

4. Abra no navegador:

```bash
http://localhost:5174/
```

5. Se quiser usar no subdomínio `iemesp.com.br`:
   - faça deploy em um serviço como Vercel ou Netlify
   - adicione um registro DNS CNAME para o subdomínio desejado
   - aponte para o host do deploy

6. Se quiser rodar no Supabase Hosting, basta configurar o projeto no dashboard Supabase e usar o URL gerado.

## Deploy no Vercel

1. No Vercel, clique em "New Project" e conecte o repositório do seu projeto.
2. Use o diretório raiz do projeto.
3. Defina os comandos:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Adicione as variáveis de ambiente no Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Faça deploy.

## Subdomínio no Registro.br

1. No Registro.br, crie um registro `CNAME`:
   - Nome: `formulario` (ou outro subdomínio desejado)
   - Tipo: `CNAME`
   - Dados: endereço do host gerado pelo Vercel, por exemplo `meusite.vercel.app`
2. Salve as alterações.
3. Aguarde a propagação DNS (pode levar alguns minutos).
4. O subdomínio ficará disponível em:
   - `formulario.iemesp.com.br`

## Observação

- Se estiver usando outro host, o processo é similar: o `CNAME` deve apontar para o host do deploy.
- O site `localhost` não funciona como subdomínio. Será necessário fazer o deploy primeiro.

### Supabase

- A tabela de leads fica em `public.leads`.
- No Supabase, use `Table Editor` para ver os dados.
- Para ver os leads via SQL, rode:

```sql
select * from public.leads order by created_at desc;
```

### Nota de deploy

- O subdomínio deve ser configurado no DNS do domínio `iemesp.com.br`.
- O site funciona como app estático React + Tailwind.
- O arquivo `.env` nunca deve ser publicado publicamente.
