# Supabase — o que já está configurado e o que falta

Projeto: **vero-id** · ref `ajhfysjgaqduomkmkeec` · região São Paulo (`sa-east-1`) · plano **Free**.

## ✅ Já configurado
| Item | Valor |
|---|---|
| Migrations aplicadas | `20260916000001_foundation.sql`, `20260917000002_org_setup_and_links.sql`, `20260917000003_subject_flow_and_risk.sql` |
| Testes no projeto | `rls_isolation.sql` → "RLS OK" · `phase2_3.sql` → "FASES 2-3 OK" · `phase4_5.sql` → "FASES 4-5 OK" |
| Data API | tabelas **não** expostas automaticamente; grants explícitos na migration |
| RLS automático | ligado |
| Site URL | `https://gabrielmoreira.tech/veroid` |
| Redirect URLs | `https://gabrielmoreira.tech/veroid`, `https://gabrielmoreira.tech/veroid/**` |
| Cadastro | permitido, com confirmação de e-mail |
| Senha | mínimo 8 caracteres |
| OTP por e-mail | 6 dígitos, expira em 600 s |
| Storage | bucket privado `media` (3 MB, JPEG/PNG/WebP) · bucket público `brand` para logos (512 KB, SVG/PNG/WebP) |
| Keep-alive | `public.ping_heartbeat()` (chamado pelo cron do Worker) |

## ⚠️ Limite atual do e-mail
Com o SMTP padrão do Supabase:
- só recebem e-mail os endereços que são **membros da organização no Supabase** (hoje: gabrieltechdesign@gmail.com);
- poucos e-mails por hora;
- os templates não podem ser editados no Free, então a confirmação chega como **link** (o app aceita o link em `/veroid/auth/callback`).

Suficiente para você testar. Para recrutadores se cadastrarem, configure SMTP próprio.

## Próximo passo (grátis): Resend como SMTP
1. Crie conta em resend.com (plano Free).
2. **Domains → Add domain** → `gabrielmoreira.tech` (ou `mail.gabrielmoreira.tech`). Copie os registros DNS (SPF/DKIM) para a Cloudflare e aguarde "Verified".
3. **API Keys → Create** (permissão "Sending access").
4. Supabase → **Authentication → Emails → SMTP Settings** → Enable custom SMTP:
   - Host `smtp.resend.com` · Port `465` · User `resend` · Password = a API key
   - Sender email `nao-responda@gabrielmoreira.tech` · Sender name `Vero ID`
5. Supabase → **Authentication → Rate Limits**: ajuste "emails per hour" (ex.: 30).
6. Com SMTP próprio os templates ficam editáveis. Em **Confirm sign up** e **Magic link or OTP**, inclua o código:
   ```html
   <h2>Seu código Vero ID</h2>
   <p>Digite este código para continuar. Ele vale por 10 minutos.</p>
   <p style="font-size:28px;font-weight:600;letter-spacing:.2em">{{ .Token }}</p>
   <p>Se preferir, <a href="{{ .ConfirmationURL }}">confirme por este link</a>.</p>
   <p style="color:#4E5573;font-size:12px">Se você não pediu isto, ignore este e-mail.</p>
   ```
7. Opcional: ligue `VITE_LOGIN_EMAIL_OTP=true` para exigir código em todo login.

## Testar localmente com links de e-mail
Adicione `http://localhost:5173/**` em **Authentication → URL Configuration → Redirect URLs** enquanto desenvolve.

## Reaplicar o schema em outro projeto
SQL Editor → cole a migration → Run. Depois cole `supabase/tests/rls_isolation.sql` → Run → deve retornar "RLS OK".
Ou com a CLI: `supabase link --project-ref <ref>` e `supabase db push`.
