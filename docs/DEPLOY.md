# Deploy em gabrielmoreira.tech/veroid

O portfólio continua no GitHub Pages. Só o caminho `/veroid*` é atendido por um Cloudflare Worker (plano gratuito).

## Pré-requisitos (uma vez)
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

## Vitrine estática no GitHub Pages
Espelho só-front do app em `ogabrielmoreira.github.io/veroid/` — o caminho do Pages coincide com o `BASE_PATH` `/veroid/`, então o build sai pronto, sem reescrita.

Em **Settings → Pages → Source**, escolha **GitHub Actions** (não "Deploy from a branch"). O workflow `.github/workflows/pages.yml` roda a cada push em `main`: build, cópia de `index.html` para `404.html` (fallback de SPA) e publicação.

Limites em relação ao deploy no Workers:
- `/veroid/api/*` não existe — a reanálise com Claude Vision na tela de sessão falha; o fluxo do titular cai no sinal "IA não executada (modo local)".
- `public/_headers` é ignorado pelo Pages: sem `Permissions-Policy` próprio. A câmera segue liberada (https, mesma origem).
