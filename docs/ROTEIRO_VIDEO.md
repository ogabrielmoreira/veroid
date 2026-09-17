# Roteiro — vídeo de 2 minutos (case no portfólio)

Sequência do prompt original (§14): problema → marca aplicada → envio de link → captura no celular → tentativa de fraude com foto de tela → veredito do Copiloto → decisão do analista → dashboard.

Grava-se em duas janelas lado a lado (desktop = painel do analista; celular real ou emulador = fluxo do titular), ou intercalando tela cheia — o importante é a mesma sessão aparecendo dos dois lados. Todos os passos abaixo funcionam com dados reais gerados por "Criar conta demo" (ou pelo painel público `/demo`, sem precisar logar).

| # | Tempo | Tela / ação | Fala (roteiro) |
|---|-------|-------------|------------------|
| 1 | 0:00–0:12 | Landing (`/`), depois `/demo` — funil e mapa do painel público | "KYC e prova de vida custam caro e cada nicho — crédito, imóveis, agro — precisa de regras diferentes. O Vero ID é um SaaS white-label: a marca de cada organização, um motor de risco configurável, sem depender de um único fornecedor fechado." |
| 2 | 0:12–0:24 | `Configurações → Marca` (Brand Kit): trocar cor primária, ver a escala gerada e o preview ao vivo mudar no celular ao lado | "Cada cliente aplica a própria marca — cor, logo, tom de voz — e vê o resultado em tempo real, com checagem de contraste AA automática." |
| 3 | 0:24–0:38 | `Links → Novo link`: escolher canal (WhatsApp), preencher nome/referência, copiar o link gerado | "O analista cria um link de verificação em segundos — por WhatsApp, SMS, e-mail ou QR — sem nenhum dado sensível no link em si." |
| 4 | 0:38–0:58 | Celular: abrir o link (`/v/:token`), consentimento LGPD, tutorial da câmera, captura com a moldura oval guiando o rosto, documento frente/verso | "No celular, o titular só vê o essencial: consentimento claro, câmera guiada por visão computacional, documento com checagem de luz e nitidez — tudo em poucos toques." |
| 5 | 0:58–1:18 | Repetir a captura mostrando uma foto impressa/tela de celular no lugar do rosto real → tela de resultado ainda envia, mas fica marcada | "Aqui, uma tentativa de fraude: uma foto de tela no lugar da prova de vida real. O Copiloto Antifraude decide sobre isso a seguir." |
| 6 | 1:18–1:34 | Painel do analista: fila de revisão → abrir a sessão marcada → aba do Copiloto com o veredito (`screen_replay`, confiança, explicação) e os sinais de risco com peso | "O Copiloto cruza regras determinísticas com uma camada de IA generativa opcional. Ele explica o motivo: padrão de reflexo compatível com foto de tela, com o grau de confiança — nunca uma caixa preta." |
| 7 | 1:34–1:48 | Detalhe da sessão: reprovar com motivo, ver o registro imediato em `Auditoria` | "A decisão final é sempre humana. Reprovar exige um motivo, e cada decisão vira um registro de auditoria imutável — rastreável do início ao fim." |
| 8 | 1:48–2:00 | Voltar para `Visão geral`: KPIs, funil, fraude por tipo, e clicar em "Baixar relatório PDF" | "E cada organização acompanha tudo num painel com a própria marca — funil, fraude por tipo, clientes qualificados — e exporta um relatório mensal em PDF para quem não abre o produto todo dia." |

**Fechamento (tela final, sem narração):** logo Vero ID + "Protótipo de demonstração — feito por Gabriel Moreira" + link do case.

## Notas de gravação
- Gravar a tela do celular espelhada (Android: `scrcpy` ou emulador Chrome DevTools em modo dispositivo; iOS: espelhamento via QuickTime) — evita a distorção de gravar a câmera apontando pro celular.
- A "tentativa de fraude" do passo 5 pode ser feita mostrando a própria tela do notebook com uma foto no lugar do rosto durante a captura — é exatamente o cenário que o Copiloto foi feito para pegar.
- Se a narração for cortada, os nomes de tela (`Configurações → Marca`, `Links → Novo link`, `Auditoria`) servem de guia para legendas.
- Duração total: 2:00. Cada linha da tabela já soma para isso — ajustar o passo 1 (mais rápido) se algum passo do meio precisar de mais tempo na gravação real.
