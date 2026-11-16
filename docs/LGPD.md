# LGPD e biometria: como manter este projeto seguro

Este arquivo é uma orientação técnica, não aconselhamento jurídico.

## Por que o cuidado
- Dado biométrico (rosto) é **dado pessoal sensível** (LGPD, art. 5º, II). O tratamento precisa de uma hipótese do art. 11; "legítimo interesse" não serve.
- A multa pode chegar a 2% do faturamento, limitada a R$ 50 milhões por infração (art. 52, II). Fora a responsabilidade civil e o dano de imagem.
- A ANPD está regulando o tema (tomada de subsídios sobre biometria em 2025) e já agiu contra uso de reconhecimento facial sem finalidade proporcional.

## Regras deste projeto
1. **A versão publicada é uma vitrine sem coleta.** Com `VITE_MAINTENANCE=true`, a home (`/`) já abre o portal de demonstração. Não existe câmera, foto, documento, envio de mensagem, backend nem login: o fluxo do titular (`/v/:token`) nem é empacotado e qualquer rota volta para `/`.
2. **Tudo é fictício.** Leads em "lorem ipsum", CPF sempre oculto, tokens de link ocultos, rostos nunca exibidos (só um espaço reservado).
3. **Funções sensíveis ficam visíveis, mas desativadas:** WhatsApp, SMS, e-mail, QR Code, importar lote (CSV), exportar CSV, subir leads, envio de logo. O simulador de onboarding só encena o pedido de câmera, sem chamar o navegador.
4. **O que a pessoa pode mudar:** nome da empresa e cor, guardados só no `localStorage` do navegador dela.
5. **Tutorial obrigatório** (8 passos, sem pular) avisa que nada é coletado e explica o sistema oficial.
6. **Se um dia reativar o fluxo completo** (Supabase + câmera): só dados fictícios ou de quem consentiu por escrito; consentimento biométrico específico e separado do marketing (já existe); retenção curta com exclusão automática; canal de direitos do titular (`/privacidade`); sem crianças; sem analytics de terceiros na tela da câmera; consulte um advogado. Chame de "prova de vida", não de "reconhecimento facial".

## Fontes consultadas
- [Reconhecimento Facial e LGPD](https://www.galiciaeducacao.com.br/blog/reconhecimento-facial-e-lgpd-regulacao-riscos-e-sancoes-no-brasil/)
- [Mattos Filho: tecnologias de reconhecimento facial e a LGPD](https://www.mattosfilho.com.br/unico/tecnologias-reconhecimento-facial-lei-lgpd/)
- [ANPD: tomada de subsídios sobre dados biométricos](https://www.gov.br/participamaisbrasil/ts-dados-biometricos)
- [Mayer Brown: relatório da ANPD sobre biometria](https://www.mayerbrown.com/pt/insights/publications/2024/07/biometrics-and-facial-recognition-anpd-releases-report)
- [Sanções da LGPD, art. 52](https://www.aurum.com.br/blog/lgpd-comentada/art-52-a-54-lgpd/)
