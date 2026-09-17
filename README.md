# Vero ID

Plataforma white-label de **KYC, prova de vida e qualificação de clientes**, multi-nicho (B2B2C). Protótipo funcional de portfólio.

Feito por **Gabriel Moreira** · [@GabrielTechDesign](https://gabrielmoreira.tech) · 

> **Protótipo de demonstração.** A detecção usa visão computacional e IA generativa e não substitui prova de vida certificada (ISO/IEC 30107-3).

## Status — completo (fases 1–10)
- [x] SPA React 19 + Vite + TypeScript, servida em `/veroid`
- [x] Design System v0.1 em tokens CSS (light + dark no painel), Tailwind v4
- [x] i18n PT-BR / EN (react-i18next)
- [x] Supabase: schema completo da seção 9, RLS por organização, grants explícitos, auditoria imutável, bucket privado
- [x] Cadastro, confirmação por código **ou** link, login, recuperação de senha
- [x] Onboarding: empresa (CNPJ validado + BrasilAPI) e nicho → cria organização via RPC
- [x] Painel inicial com shell, estados vazios e log de auditoria
- [x] Cloudflare Worker: `/veroid/api/health`, fallback de SPA, headers de segurança, cron de keep-alive
- [x] Fase 2: wizard Marca → Fluxo → Equipe → Pronto; Brand Kit com escala gerada, checagem AA em tempo real, logos e preview ao vivo (celular + painel); fluxo por nicho; convites e papéis; Configurações
- [x] Fase 3: links de verificação (WhatsApp, SMS/e-mail simulados, QR Code), lote por CSV com validação linha a linha, estados, reenviar (token novo), cancelar com motivo, busca e filtros; página pública `/v/:token` com a marca da organização; "Simular onboarding"
- [x] Fase 4: fluxo do titular — consentimento LGPD (biometria obrigatória, marketing separado e versionado), tutorial antes da permissão, telas de câmera negada/indisponível por navegador, captura com MediaPipe (moldura oval, feedback, desafio aleatório, captura automática, fallback manual), documento frente e verso com checagem de luz/nitidez, formulário do nicho (CPF, CEP com ViaCEP, máscaras), revisão, envio e retomada de sessão
- [x] Fase 5: Copiloto Antifraude — motor de regras no banco (navegador + dados/dispositivo + regras de nicho), Score de Risco e faixas, aprovação automática opcional, camada Claude Vision no Worker (opcional, com teto diário)
- [x] Fase 6: painel com indicadores, funil, fraude por tipo, tendência, histograma de score, mapa por UF, heatmap, dispositivos e KPI por nicho — tudo numa única RPC (`dashboard_stats`) com clique-para-filtrar; fila de revisão com SLA e ordenação por risco; detalhe da sessão (evidências com link assinado de 5 min + marca d'água, linha do tempo, Copiloto, checagens, notas, auditoria, aprovar/reprovar/nova captura/reanalisar)
- [x] Fase 7: Score de Qualificação (identidade + completude + recência), Clientes Qualificados (opt-in separado, exportar CSV, enviar ao CRM), bureau de crédito simulado (determinístico, com finalidade e cache de 24h), regras e integrações (aprovação automática com prévia de impacto, webhook assinado)
- [x] Fase 8: modo demo — painel público `/demo` (sem login, mesma agregação do painel via `public_demo_stats`), gerador de massa de dados (~800 sessões/90 dias, funil/geografia/sinais realistas), "Explorar sem cadastro" e "Criar conta demo" na landing, "Simular onboarding" com moldura de celular, tour guiado de 5 passos
- [x] Fase 9: LGPD — retenção automática (mídia e links vencidos apagados pelo cron do Worker), página pública de direitos do titular (acesso/exclusão verificados por código de 6 dígitos, sem exigir login), consentimento versionado
- [x] Fase 10: acabamento — relatório mensal em PDF com a marca da organização (gerado no navegador, `@react-pdf/renderer`, carregado sob demanda); acessibilidade (varredura automatizada com `axe-core` em 12 telas × claro/escuro × desktop/mobile, zero violações WCAG 2 AA; foco preso + Esc corrigidos no tour guiado); testes automatizados (`supabase/tests/*.sql` para RLS/fluxo do titular/regras de risco, `npm test` para validadores/cor/CSV/prova de vida/parser do Copiloto/paridade de i18n); este README e o [DECISIONS.md](DECISIONS.md) consolidados

## Arquitetura
```
gabrielmoreira.tech            → GitHub Pages (portfólio, sem mudanças)
gabrielmoreira.tech/veroid*    → Cloudflare Worker (route)
   ├── /veroid/*               → SPA (dist/veroid)
   └── /veroid/api/*           → API do Worker (segredos)
                  │
                  ▼
        Supabase (Auth, Postgres + RLS, Storage) — sa-east-1, plano Free
```

## Modelo de dados (visão simplificada)
```
organizations ──┬── memberships ── profiles (auth.users)
                 ├── flow_templates
                 ├── invitations
                 ├── ai_usage
                 └── verification_links ── subjects
                                        └── verification_sessions ─┬─ session_events
                                                                    ├─ risk_signals
                                                                    ├─ session_notes
                                                                    ├─ consents
                                                                    ├─ media_assets
                                                                    └─ bureau_checks

audit_logs        registra toda escrita sensível (organização + ator + antes/depois), imutável
data_requests     pedidos de acesso/exclusão do titular (LGPD, §8) — por CPF+OTP, sem login
heartbeat         1 linha, usada só pelo cron de keep-alive do Supabase Free
```
Todas as tabelas (exceto `heartbeat`) têm RLS habilitado e `organization_id` (direto ou via `verification_links`/`verification_sessions`) — o isolamento entre organizações é reforçado por `supabase/tests/rls_isolation.sql`. Detalhe completo das colunas: migrations em `supabase/migrations/`.

## Rodar localmente
```bash
npm install
cp .env.example .env.local     # preencha VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                    # http://localhost:5173/veroid/
npm test                       # validadores, cor, CSV, prova de vida, parser do Copiloto, paridade de i18n
npm run build
```

## Estrutura
```
src/
  config/niches/     um arquivo por nicho (campos, etapas, regras de risco, KPIs)
  features/auth/     cadastro, login, verificação, callback, senha
  features/onboarding/
  features/app/      shell do painel e visão geral
  features/setup/    Brand Kit, fluxo, equipe, wizard e Configurações
  features/links/    links de verificação, lote CSV, QR/WhatsApp
  features/subject/  telas do titular (/v/:token)
  features/dashboard/ painel: gráficos, filtros, tabela de sessões
  features/review/   fila de revisão e detalhe da sessão
  features/qualified/ Clientes Qualificados e bureau simulado
  features/audit/    log de auditoria
  features/demo/      painel público /demo, "Simular onboarding" e tour guiado
  features/privacy/   direitos do titular (LGPD) em /privacidade
  features/reports/   relatório mensal em PDF (MonthlyReportPdf, download sob demanda)
  components/ui/     Button, Field, Checkbox, OtpInput, Alert, Icon…
  styles/tokens.css  Design System v0.1
worker/              Cloudflare Worker (index.ts, analyze.ts, copilot.ts, webhooks.ts, retention.ts)
scripts/             prepare-mediapipe.mjs (WASM + modelo em public/)
supabase/migrations/ schema versionado
supabase/tests/      rls_isolation.sql, phase2_3.sql, phase4_5.sql, phase6_7.sql, phase8_9.sql (rode no SQL Editor → devem retornar OK)
docs/                SUPABASE.md, DEPLOY.md, ROTEIRO_VIDEO.md
```

## Segurança
- Só chaves públicas usam prefixo `VITE_`. Segredos: `wrangler secret put`.
- Usuário autenticado não insere organização nem membership direto: passa por `create_organization()`.
- `audit_logs` bloqueia `update`/`delete` por trigger.
- Titular nunca acessa o banco: só pelo Worker (fases 3–4).
- Cabeçalhos de segurança (CSP, `X-Frame-Options`, `Permissions-Policy`) no Worker, por rota — `frame-ancestors`/`X-Frame-Options` só afrouxam para `SAMEORIGIN` em `/v/:token` (a página embutida pela demo pública), nunca no painel autenticado. Ver D-032.
- Webhook do CRM assinado com HMAC usando a chave de serviço (nunca a chave pública) como segredo — ver D-033.
- `npm audit`: 0 vulnerabilidades nas dependências (checado antes da entrega final).

## Limitações conhecidas
- **Relatório em PDF:** usa a cor da marca, mas não a tipografia (`font_display`/`font_text`) — `@react-pdf/renderer` não registra as fontes do Design System. Ver D-030.
- **LGPD em modo demo:** sem SMTP próprio configurado, o código de verificação de acesso/exclusão volta na resposta da API (com aviso explícito na tela) em vez de ser enviado por e-mail. Ver D-026.
- **Gerador de dados de demonstração:** parâmetros (800 sessões, 9% fraude, UFs) fixos no wrapper `seed_demo_data`, em vez de ler o `seedProfile` por nicho já definido em `src/config/niches/*.ts`. Ver D-024.
- **Camada de IA do Copiloto (Claude Vision) e o CRM via webhook** dependem de chaves/URLs configuradas pelo usuário — sem elas, o produto funciona só com o motor de regras determinístico.
- Cobertura de teclado/leitor de tela foi verificada com `axe-core` (WCAG 2 A/AA, zero violações em 12 telas) e revisão manual dos componentes de overlay (`Modal`, `GuidedTour`); não é uma auditoria completa de acessibilidade nem cobre todos os leitores de tela do mercado. Ver D-031.

## Fora de escopo
Prova de vida certificada, bureaus e bases governamentais reais, cobrança, app nativo, SSR, SMS real na demo pública.

Decisões: [DECISIONS.md](DECISIONS.md) · Supabase: [docs/SUPABASE.md](docs/SUPABASE.md) · Deploy: [docs/DEPLOY.md](docs/DEPLOY.md) · Roteiro do vídeo de apresentação: [docs/ROTEIRO_VIDEO.md](docs/ROTEIRO_VIDEO.md)
