# Deploy

## Deploy atual: GitHub Pages standalone
O app está publicado em `https://ogabrielmoreira.github.io/veroid/`, num repositório `veroid` próprio (fora do repositório do portfólio) — não pelo Worker descrito abaixo.

```bash
npm install
cp .env.example .env.local     # preencha a chave publishable
npm run build
cp dist/veroid/index.html dist/veroid/404.html   # fallback de SPA (React Router) no GitHub Pages
touch dist/veroid/.nojekyll
npx gh-pages -d dist/veroid    # publica em gh-pages; Settings → Pages → Source = "Deploy from a branch"
```

**Checklist pós-deploy (GitHub Pages):**
- [ ] `https://ogabrielmoreira.github.io/veroid/` carrega, e F5 em `/veroid/entrar` também (fallback de SPA)
- [ ] Supabase → Authentication → URL Configuration: **Site URL** e **Redirect URLs** apontam para `https://ogabrielmoreira.github.io/veroid` (não para `gabrielmoreira.tech/veroid` — domínio do plano original abaixo, nunca usado). Ver D-035 no DECISIONS.md: um link de confirmação de e-mail para o domínio errado 404. Se o domínio de publicação mudar de novo, esta tela precisa ser atualizada manualmente — nenhuma migração cobre isso.
- [ ] Cadastro → e-mail chega → link de confirmação abre `/veroid/auth/callback` e entra no app
- [ ] Sem SMTP próprio configurado no Supabase (plano Free usa o e-mail padrão deles, com limite baixo) — ver "Limitações conhecidas" no README

## Alternativa: Worker em gabrielmoreira.tech/veroid
Caminho original — só o caminho `/veroid*` do portfólio (GitHub Pages) atendido por um Cloudflare Worker (plano gratuito). Não é o deploy em uso hoje; documentado aqui caso o app seja linkado de volta ao domínio do portfólio no futuro.

### Pré-requisitos (uma vez)
1. Cloudflare → DNS do `gabrielmoreira.tech`: os registros do domínio raiz (A/CNAME para o GitHub Pages) precisam estar **Proxied** (nuvem laranja). Em SSL/TLS, use **Full**.
2. `npx wrangler login`

## Publicar
```bash
npm install
cp .env.example .env.local   # preencha a chave publishable
npm run deploy               # build + wrangler deploy (cria a route gabrielmoreira.tech/veroid*)
```
Abra `https://gabrielmoreira.tech/veroid/` e `https://gabrielmoreira.tech/veroid/api/health`.

## Deploy automático pelo GitHub (Workers Builds)
Cloudflare → Workers & Pages → `vero-id` → Settings → Builds → Connect repository.
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LOGIN_EMAIL_OTP`

## Segredos (opcionais)
Sem eles a demo funciona com análise por regras. Com eles, o Copiloto usa Claude Vision (cobrado por uso na Anthropic; teto diário em `AI_DAILY_LIMIT`).
```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
```

## Checklist pós-deploy
- [ ] F5 em `/veroid/entrar` e `/veroid/app` carrega (fallback de SPA)
- [ ] Cadastro → e-mail chega → link abre `/veroid/auth/callback` e entra no app
- [ ] Criar organização → aparece `organization.created` em Atividade recente
- [ ] Rotas fora de `/veroid` continuam servindo o portfólio
