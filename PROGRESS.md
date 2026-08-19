# Progress — Formulário de Contrato

Registro do que foi feito até agora, pra continuar em outra sessão sem perder contexto.

## O que existe hoje

**[paineldecontrole/contrato-form.html](paineldecontrole/contrato-form.html)** — formulário público único pro cliente preencher contrato. Fluxo:

1. Cliente escolhe o tipo: Compra e Venda de Veículo, Compra e Venda de Imóvel, ou Locação de Imóvel.
2. Com base na escolha, o formulário monta as etapas certas (vendedor/comprador ou locador/locatário, objeto, pagamento, entrada, garantia, testemunhas, revisão).
3. Envia pro Supabase (`declaracoes_pendentes`), mesma tabela usada pelos formulários de declaração (currículo, união estável etc.).

Link fica na aba **Contratos** do painel (`📃 Link — Contrato`), com botão de copiar, igual aos outros formulários.

**[paineldecontrole/index.html](paineldecontrole/index.html)** — painel administrativo. Recebeu 3 novos tipos no motor de formatação (`TIPOS` registry, dentro de `<script type="module">`):

- `CONTRATO_CV_VEICULO` — Compra e Venda de Veículo
- `CONTRATO_CV_IMOVEL` — Compra e Venda de Imóvel
- `CONTRATO_LOCACAO_IMOVEL` — Locação de Imóvel

Esses tipos aparecem em **Declarações Pendentes**, com o botão "📄 Formatar" já funcionando (reaproveita `montarContrato()`/`qualificarCV()`/`clausulaCV()` etc., os mesmos helpers dos contratos de veículo que já existiam).

## Funcionalidades já implementadas

- **Seletores em vez de texto livre**: nacionalidade, tipo de veículo, marca, cor, tipo de imóvel — todos com opção "Outro" que libera campo de texto quando o valor não está na lista.
- **Veículo na entrada (troca)**: em qualquer compra e venda (veículo ou imóvel), o formulário pergunta se houve veículo dado como parte do pagamento, cobrindo as 6 combinações:
  - À vista, 100% em dinheiro
  - À vista, com carro na troca (+ dinheiro complementar opcional)
  - A prazo, sem entrada
  - A prazo, só com entrada em dinheiro
  - A prazo, só com carro na entrada
  - A prazo, com carro + dinheiro na entrada

  O painel calcula o valor restante (total − veículo − dinheiro) e monta a cláusula de pagamento certa pra cada caso.
- **Terreno**: quando o tipo de imóvel é "Terreno", o formulário pede metros de frente e de fundo (em vez de área direta) e calcula o m² total sozinho (frente × fundo), mostrado ao vivo na tela. A cláusula do objeto no contrato final especifica frente, fundos e área total. Outros tipos de imóvel (Casa, Apartamento etc.) não pedem nenhum campo de metragem.
- **Caução na locação**: etapa de garantia com 4 opções (Caução, Fiador, Seguro-fiança, Sem garantia). Se Caução, pede o valor e a cláusula deixa explícito que é pago junto com o primeiro aluguel.
- **Formatação maior**: fonte e espaçamento entre linhas aumentados na prévia em tela e na impressão/PDF (`#declFormatadoConteudo` e `#printArea .doc-formatado-print`), título do contrato em 18px.

## Banco de dados (Supabase, projeto `kihnavaovspdjnegcraj`)

A tabela `declaracoes_pendentes` tinha uma CHECK constraint (`declaracoes_pendentes_tipo_contrato_check`) que só permitia os tipos de Declaração antigos. Foi alterada (migration `add_contrato_tipos_to_declaracoes_pendentes_check`) pra incluir os 3 novos tipos de contrato. **Se aparecer erro "violates check constraint" ao testar um tipo novo, é sinal de que a constraint precisa ser atualizada de novo.**

A tabela só tem policy de `INSERT` e `SELECT` pro `anon` — não tem `UPDATE`/`DELETE` direto. Todo UPDATE/DELETE nela (e nas outras tabelas sensíveis) passa pela Edge Function `db-write`, que confere a senha da equipe (`APP_PASSWORD`, guardada em `localStorage` no painel após desbloqueado) e só então grava com `service_role`. **Isso importa pra qualquer feature nova que precise alterar uma declaração/contrato já salvo** — nunca dá pra fazer `supabase.from(...).update()`/`.delete()` direto de dentro de `contrato-form.html` (formulário público, sem a senha); tem que pedir pro painel (`index.html`) fazer via `dbUpdate`/`dbDelete`. Isso mordeu a implementação do Editar (ver abaixo): o primeiro teste "funcionou" (sem erro) mas não gravou nada, porque o RLS bloqueou silenciosamente.

## Editar (todos os formulários — 2026-08-16, padronizado no mesmo dia)

Botão **EDITAR** na tela de resultado formatado do painel, ao lado de Imprimir/Fechar. Existe hoje pra **7 formulários**: os 3 tipos de contrato (`CONTRATO_CV_VEICULO`/`CONTRATO_CV_IMOVEL`/`CONTRATO_LOCACAO_IMOVEL`), as 4 Declarações (`DECLARACAO_AUTONOMO`/`DECLARACAO_TRABALHO`/`DECLARACAO_RESIDENCIA`/`DECLARACAO_UNIAO_ESTAVEL`) e o Currículo. Termo de Responsabilidade e os CV_* manuais do painel não têm formulário público equivalente pra reabrir, então não têm Editar.

**Como funciona (protocolo padrão `form-*`, igual em todo formulário)**: EDITAR abre `<algum>-form.html?editId=<uuid>` dentro de um `<iframe>` no modal genérico `editarFormularioModal` em `index.html`. Cada formulário público, ao detectar `editId` na URL, busca o próprio registro no Supabase e roda `carregarParaEdicao(row)` pra reconstruir o state `s` inteiro a partir do que foi salvo — endereço solto em Rua/Número/Complemento (contrato), cidade/bairro/nacionalidade "Outro" comparados com as listas conhecidas, telefone/whatsapp do currículo re-separados em DDD+número (são salvos concatenados; só dá pra separar de volta porque DDD BR é sempre 2 dígitos), cursos/empresas/referências reconstruídos a partir das chaves de pergunta salvas em `dados`. Botão final vira "Salvar alterações" + link "Cancelar edição".

**Importante — quem grava é sempre o painel, nunca o formulário público**: só `index.html` tem a senha de escrita (Edge Function `db-write`). Nenhum formulário público grava direto no modo de edição — cada um só monta o `registro` e manda `postMessage({type:'form-salvar-pedido', table, id, registro})` pro `window.parent`. O painel (`index.html`) tem UM listener genérico pra isso — não um por formulário — que chama `dbUpdate(table, registro, {id})` e, se der certo, fecha o modal e re-renderiza a visualização certa (`abrirDeclFormatado`/`loadDeclaracoesPendentes` pra contrato+declaração, `abrirFormatado`/`loadCurriculos` pra currículo); se der erro, manda `postMessage({type:'form-salvar-resultado', ok:false, error})` de volta pro iframe mostrar sem perder o que a pessoa editou. `Cancelar edição` só manda `form-editar-cancelado`, não toca no banco. Qual URL/tabela usar por tipo fica no mapa `EDICAO_FORMULARIO` em `index.html` — adicionar Editar a um formulário novo no futuro é só somar uma entrada nesse mapa + implementar `carregarParaEdicao`/o listener `form-salvar-resultado` no form em si, copiando o padrão dos que já existem.

Atualiza sempre o **mesmo registro** (mesmo `id`) — nunca cria linha nova, nunca duplica, nunca vira histórico.

**Currículo tem duas coisas a mais**: (1) a foto já salva (`foto_url`) é preservada se o usuário não mexer nela — só troca se escolher um arquivo novo, só limpa se clicar em "remover foto" (variável `fotoUrlOriginal`/`fotoRemovida`); (2) se o texto formatado por IA (`ia_texto`) já tinha sido gerado antes, o painel zera ele (`ia_texto`/`ia_header`/`ia_gerado_em` = `null`) toda vez que uma edição é salva, pra não ficar imprimindo uma versão da IA desatualizada em relação aos dados novos — precisa clicar em "🤖 Gerado com IA" de novo pra gerar uma versão nova.

## Testado

- Fluxo completo dos 3 tipos de contrato, local e ao vivo em produção (lanblackout.com).
- As 6 combinações de pagamento (veículo/dinheiro × à vista/a prazo).
- Cálculo de área do terreno (12m × 25m = 300m²) ao vivo, sem perder foco do campo.
- Envio real em produção + limpeza do registro de teste depois.
- Editar contrato (Locação de Imóvel): reabertura com todos os campos preenchidos (inclusive cidade "Outra"/bairro livre/estado manual), troca do valor do aluguel, salvar, e confirmação direto no banco de que atualizou o mesmo `id` sem duplicar.
- Editar declaração (Autônomo): reabertura completa, troca da função exercida, salvar, confirmado no banco.
- Editar currículo: reabertura com telefone/whatsapp com DDDs diferentes entre si (nenhum dos dois era 47) reconstruídos certinho, cidade "Outra" reconstruída, curso e experiência (arrays) reconstruídos, edição do nome da empresa salva e confirmada no banco sem duplicar.

## Rua/Número/Complemento + SC automático em todos os formulários (2026-08-16)

O que já tinha sido feito só em `contrato-form.html` (ver seção acima) foi replicado nos outros 5 formulários públicos: as 4 Declarações (Autônomo, Trabalho, Residência, União Estável) e o Currículo. Mesmo padrão em todo lugar:

- Campo único de endereço virou **Rua / Número / Complemento (não obrigatório)** — composto num endereço só (`enderecoFinal()`) na hora de enviar/exibir.
- Porto Belo → **Itajaí** na lista de cidades (mesmos bairros usados em `contrato-form.html`).
- **Camboriú, Balneário Camboriú, Itapema e Itajaí** forçam Estado = SC e escondem o campo (`estadoForcadoSC()`/`estadoCampoHtml()`/`renderCondEstado()`); qualquer outra cidade (inclusive "Outra") continua pedindo o Estado.
- `carregarParaEdicao()` de cada formulário ganhou `carregarEnderecoSolto()` (reconstrói Rua/Número/Complemento a partir do que foi salvo, com fallback pro endereço composto inteiro em registros antigos).

**Onde cada um guarda o endereço**: os 4 formulários de Declaração salvam `rua`/`numero`/`complemento` direto dentro de `dados.pessoa_a` (é tudo JSON solto, sem problema). O Currículo é diferente — a tabela `curriculos` só tem uma coluna fixa `endereco` (já composta), sem coluna própria pra rua/número/complemento — então esses 3 campos ficam soltos dentro da coluna `dados` (que já guarda um monte de outra pergunta/resposta), com chaves curtas `dados.rua`/`dados.numero`/`dados.complemento`.

Testado ao vivo (criar, conferir no banco, editar/recarregar, apagar):
- Declaração de Autônomo, cidade Itajaí — SC automático, Rua/Número/Complemento persistidos e reconstruídos certinho na edição.
- Currículo, cidade Camboriú — mesma coisa, incluindo o `estado` (coluna fixa) vindo `null`→`"SC"` automaticamente e `dados.rua`/`dados.numero` persistidos.
- Os outros 3 formulários de Declaração (Trabalho, Residência, União Estável) só tiveram teste de fumaça (sem erro de JS, campos renderizando certo) — o padrão é idêntico ao do Autônomo, que foi testado ponta a ponta.

## Emitir Recibo (2026-08-16)

Nova função independente no painel, sem mexer em nada das outras. Card **"🧾 Emitir Recibo"** aparece primeiro no menu inicial (`MENU_ITEMS`), com tooltip explicando o que faz.

**Fluxo**: Novo Recibo → formulário → Visualizar Recibo (prévia fiel do documento impresso, ainda sem número definitivo) → Gerar Recibo (grava no banco e atribui o número) → tela final com Imprimir/PDF, Novo Recibo e Fechar.

**Campos do formulário**: Nome do pagador/Razão Social (obrigatório); Tipo de pagador (Pessoa Física/Jurídica) — mostra CPF só se PF, CNPJ só se PJ, nunca os dois; Descrição dos serviços (texto livre, várias linhas); Valor do serviço (mostrado formatado em R$ e por extenso, ex. "R$ 150,00" / "Cento e cinquenta reais.", usando o helper `extensoReais()` que já existia); Forma de pagamento (Dinheiro/PIX/Cartão de débito/Cartão de crédito); Data (pré-preenchida com hoje, editável); Observações (opcional — se não preenchido, a seção inteira some da prévia/impressão, não fica um espaço vazio).

**Numeração sequencial**: tabela nova `recibos` no Supabase, coluna `numero serial unique` — o Postgres garante atomicamente que cada INSERT pega o próximo número disponível, sem risco de dois recibos saírem com o mesmo número mesmo se gerados ao mesmo tempo. Exibido sempre com 6 dígitos (`Nº 000001`).

**Layout timbrado**: logo Blackout (SVG inline, círculo verde com "B"), nome "BLACKOUT" + "Serviços de Impressões e Gráfica Rápida", número/data no canto, seções Recebemos de / Referente a / Valor recebido / Forma de pagamento / Observações (se houver), rodapé com os dados reais da empresa: "Blackout — R. Monte Agulhas Negras, 265 - sl 04, Bairro Monte Alegre - Camboriú/SC — (47) 99991-2755". **Nenhum dado da empresa foi inventado** — só os que o usuário passou explicitamente; o exemplo de pagador (nome/CPF/CNPJ de terceiro) que apareceu no pedido original foi usado só como referência de formatação, nunca gravado como dado real da empresa.

**Impressão/PDF**: reaproveita o padrão existente (`#printArea` + `window.print()`) — não existe biblioteca de geração de PDF no projeto, então "Gerar PDF" é feito via a opção nativa "Salvar como PDF" da janela de impressão do navegador, igual já funciona pros contratos e currículos.

**Banco de dados**: tabela `recibos` (RLS: só `SELECT` pro `anon`; toda escrita passa pela Edge Function `db-write`, que precisou ganhar `recibos: ['insert','update','delete']` no mapa `ALLOWED` — sem isso a escrita falha com "Operação não permitida", mesmo padrão de bug já visto antes com `declaracoes_pendentes`/`curriculos`).

Testado ao vivo: 2 recibos gerados em sequência (números 000001 e 000002, confirmando que não repete/reusa número), formulário PF↔PJ trocando CPF/CNPJ corretamente, Observações vazio não deixa buraco no documento, prévia idêntica ao documento final, listagem em "Recibos Emitidos" (mais recente primeiro), reabrir um recibo já emitido pela lista, excluir. Registros de teste apagados depois e a sequência do banco resetada pra 1, então o primeiro recibo real do usuário vai sair como Nº 000001.

## Recibo de Serviço — CNPJ, assinatura e redesign (2026-08-16)

Depois do Emitir Recibo (seção acima), três rodadas de ajuste no mesmo dia, todas em `paineldecontrole/index.html` (função `montarReciboHtml()` + CSS `.recibo-doc-*`):

1. **CNPJ + assinatura fixa**: CNPJ da empresa (`37.696.836/0001-82`) no rodapé. Assinatura de Márcio Feitosa de Souza embutida como `<img>` em base64 direto no JS (`RECIBO_ASSINATURA_IMG`), a partir de uma foto que o usuário mandou — processada com PowerShell/System.Drawing (removido fundo branco→transparente, recortada, rotacionada 40° porque a assinatura original estava torta), assim não precisa assinar fisicamente cada recibo.
2. **Redesign completo**: virou um documento comercial de verdade — cabeçalho maior com logo, título "RECIBO DE SERVIÇO", seções em cards (Dados do Pagador / Descrição dos Serviços / Valores), valor total em destaque, frase de quitação, marca d'água da logo (opacidade baixa, `RECIBO_WATERMARK_SVG`), rodapé com dados da empresa maiores ao lado da assinatura no canto inferior direito.

**⚠️ Cuidado ao editar essa parte do arquivo**: a constante `RECIBO_ASSINATURA_IMG` é uma única linha de ~150.000 caracteres (o base64 da imagem). Ferramentas de edição por regex/replace que rodam sobre o arquivo inteiro (tipo um `-replace` de PowerShell mal escrito) podem silenciosamente corromper esse base64 ou — pior, como já aconteceu numa sessão — comer barras invertidas de regex em *outras* funções do arquivo inteiro sem dar erro nenhum. Pra mexer nessa linha com segurança: localizar por prefixo/sufixo fixo (`const RECIBO_ASSINATURA_IMG = \`<img src="data:image/png;base64,` … `" alt="...">\`;`) e fazer substring/replace **literal** (não regex) só do meio. Depois de qualquer edição nessa região, sempre conferir `git diff --stat` pra garantir que só as linhas pretendidas mudaram.

## Orçamento de Impressões e Encadernações (2026-08-16)

Nova ferramenta no painel (`MENU_ITEMS` → `{ icon: 'orcamento', view: 'orcamento' }`, view `#viewOrcamento`), pra substituir o processo manual que o usuário fazia numa planilha Google Sheets ao orçar impressão de PDFs de cliente.

**Fonte da lógica de preço**: planilha Google Sheets "PAINEL DE CONTROLE" (aba de mesmo nome), acessada via MCP do Google Drive (`search_files`/`download_file_content` exportando `.xlsx`, depois `unzip` + leitura direta do XML da planilha — o `read_file_content` em markdown não preserva fórmula nem células mescladas o bastante pra isso). Fórmulas das células `AJ7`/`AJ8` (impressão P&B/Colorido) e `AJ11`/`AJ12` (+ encadernação) foram lidas por inteiro e reproduzidas 1:1 em `ORC_PRECOS` (tabelas de tiers por papel × categoria × faixa de páginas) e nas funções `orcPrecoImpressao()`/`orcPrecoEncadernacao()`. Conferido contra o exemplo real da própria planilha (10 páginas, Sulfite 75g, Escritas, 1 encadernação → 7,50 / 15,00 / 14,50 / 22,00) — bateu exato. **Não alterar os valores em `ORC_PRECOS` sem reconferir a planilha original.**

**Fluxo**: usuário informa páginas, tipo de impressão (botões Escritas/Imagens/Chapadas — mas o cliente vê "Somente texto"/"Contém imagem e texto"/"Bastante imagens" no orçamento, via `ORC_TIPO_DESCRICAO`), papel (5 opções, direto da planilha) e quantidade de encadernações. Recalcula ao vivo (`atualizarOrcamento()`) e mostra um card estilo documento comercial: cabeçalho Blackout, Detalhes do Serviço, Opção 1 (P&B) e Opção 2 (Colorido) com impressão + encadernação + total, e um balão amarelo "Próximo passo" explicando que a produção só começa após o pagamento (chave PIX `(47) 99737-0714`) — com "Posso confirmar seu pedido?" + 👍 grande/👎 pequeno dentro do mesmo balão (canto inferior direito), só um convite visual pro cliente responder no chat, sem nenhuma lógica por trás.

**Exportar/Enviar**: os dois botões (`Exportar Orçamento` e `Enviar pelo WhatsApp`) geram a mesma imagem, sempre no tamanho de story do Instagram (1080×1920, 9:16) — `orcGerarCanvas()` monta um quadro dedicado fora da tela (`.orc-story-*`, fontes maiores que o card em tela) com `html2canvas` (importado via CDN `esm.sh`, mesmo padrão do `supabase-js`/`extenso` já usados no projeto) e depois remove o quadro do DOM. "Enviar pelo WhatsApp" baixa o JPG e abre `web.whatsapp.com/send?text=...` numa aba nova (de propósito, não usa Web Share API nem link `wa.me` — ambos podem abrir o app nativo do WhatsApp em vez do WhatsApp Web, que é o que a loja usa no atendimento).

Testado: cálculo conferido contra a planilha em dois casos (10pg/Sulfite/Escritas/1enc e 120pg/A Laser/Imagens/3enc), canvas exportado sempre 1080×1920 exato, conteúdo cabe com folga dentro do quadro (sem cortar), "Obs: sem encadernação" aparece no lugar do valor quando a quantidade é 0, WhatsApp Web abre em aba nova. Tudo via harness standalone isolado (não dá pra testar a view real sem a senha da equipe do painel em produção).

## Revisão das cláusulas de Locação — fidelidade aos modelos antigos (2026-08-19)

Pedido do usuário: os contratos gerados pelo painel foram criados numa sessão anterior com cláusulas genéricas/inventadas em vez de fiéis aos modelos que ele já usava (planilha Google Sheets "PAINEL DE CONTROLE", abas "TERMO DE RESPONSABILIDADE - PRONTO", "PROCURAÇÃO DETRAN - PRONTA", "PROCURAÇÃO SIMPLES - PRONTA", "LOCAÇÃO I PESSOA S/ CAUÇÃO - PRONTA"). Tarefa: comparar com os modelos reais e corrigir só o que diverge, sem reconstruir o sistema.

**Comparação (via aba "RESPOSTAS" de cada modelo, que reproduz o texto do modelo com dados de um cliente real — a aba "-PRONTA"/"-PRONTO" com placeholders em branco não estava acessível na extração, mas o corpo do texto é o mesmo)**:

- **Termo de Responsabilidade** (`TIPOS.TERMO_DE_RESPONSABILIDADE` em `index.html`): já estava fiel ao modelo quase palavra por palavra (cláusulas a-h, qualificação completa de ambas as partes via `qualificarTermo()`). **Não foi alterado.**
- **Procuração DETRAN / Procuração Simples**: confirmado que não existem no motor `TIPOS` — só aparecem como rótulo (`TIPO_CONTRATO_LABELS`) e como link pra Google Forms externo. Decisão do usuário: **fora de escopo por enquanto**, não implementadas.
- **Contrato de Locação de Imóvel** (`TIPOS.CONTRATO_LOCACAO_IMOVEL`): aqui estavam as divergências reais, corrigidas:
  - Prazo: voltou a ser **improrrogável** ("independentemente de aviso, notificação ou interpelação judicial ou extrajudicial"), igual aos dois modelos antigos — antes o contrato dizia que prorrogava automaticamente por prazo indeterminado se ninguém se manifestasse, o que não existia nos modelos.
  - Rescisão antecipada pelo locatário: tirada a multa de 3 aluguéis (inventada, não existe em nenhum modelo antigo); agora segue o modelo — sem multa, aviso por escrito com 30 dias de antecedência.
  - Caução: cláusula expandida com os 2 parágrafos que existiam no modelo e faltavam no código (LOCADOR precisa notificar o motivo antes de usar a caução pra reparo de dano; caução não pode ser usada pra pagar aluguel).
  - Cláusulas que existiam nos modelos e faltavam no código — adicionadas: prazo de 5 dias pro locatário reclamar de reparos pendentes; proibição de modificar o imóvel sem autorização por escrito; direito do locador de vistoriar o imóvel; proibição de sublocar/emprestar sem autorização; desapropriação (isenta o locador); intimação do Serviço Sanitário não é motivo pra abandono/rescisão (cláusula "de ruína" dos modelos, mantida por fidelidade); cobrança judicial de valores devidos + honorários advocatícios a cargo do devedor; renúncia ao direito de preferência de compra + desocupação em 30 dias em caso de venda.
  - **Nova cláusula "DO SOSSEGO E DO HORÁRIO DE SILÊNCIO"** (pedido novo do usuário, não vem de nenhum modelo antigo): a partir das 22h, cuidado redobrado com TV/som/instrumentos etc.; proibição de festas/algazarra a qualquer horário; locatário responde por orientar visitantes/convidados; deixa claro que não restringe convívio familiar normal nem o ruído inevitável do dia a dia; ancorada em infração contratual + convenção de condomínio/regulamento interno quando existirem (sem inventar "lei nacional de silêncio das 22h às 7h", que não existe dessa forma).
  - **Campos novos no formulário** (`contrato-form.html`, etapa "Condições da Locação"), decididos com o usuário via pergunta direta:
    - "Quem paga a fatura de água?" e "Quem paga a fatura de energia elétrica?" — cada um com 3 respostas (LOCADOR / LOCATÁRIA / Dividido entre as partes), a cláusula de encargos reflete a resposta. Condomínio/gás/IPTU continuam fixos por conta do locatário (não apareciam nos modelos antigos, mantido como proteção padrão, sem pedido pra mudar).
    - "Permite animais de estimação no imóvel?" (Sim/Não) — troca a cláusula fixa de proibição dos modelos antigos por uma condicional.
    - Registros salvos *antes* dessa mudança não têm esses 3 campos — `corpo()` e `carregarParaEdicao()` usam fallback (`água`/`energia` → `'LOCATÁRIA'`, `animais` → `'Não'`) pra preservar o comportamento que já existia e não quebrar contratos antigos ao reabrir/reeditar.

**Testado**: fluxo completo de Locação de Imóvel em `contrato-form.html` rodando localmente (servidor estático PowerShell ad-hoc, sem Node/Python disponíveis no ambiente — `.claude/launch.json` deixado configurado pra próximas sessões), cobrindo os 3 campos novos (água=LOCADOR, energia=Dividido, animais=Sim, garantia=Caução) — os campos aparecem certinho na etapa, a validação bloqueia quando não preenchidos, e o fluxo completa até a tela de revisão sem erro. `index.html` carregado localmente sem erros de console (confirma que o `corpo()` reescrito não quebrou o parse/carregamento do painel). **Não testado**: o texto final renderizado da cláusula (precisa da senha da equipe em produção pra abrir "Formatar" de um registro real — não dá pra simular localmente sem duplicar toda a lógica de autenticação do painel). Revisão cuidadosa do texto foi feita por leitura de código, reaproveitando helpers (`clausulaCV`, `qualificarCV`, `blocoForoCV` etc.) já usados e testados nos outros tipos de contrato.

## Possíveis próximos passos (não pedidos ainda, só ideias)

- Procuração DETRAN e Procuração Simples ainda não são geradas pelo painel — só existem como link pra Google Forms externo. Os modelos antigos já foram extraídos da planilha numa sessão (ver git history/conversa de 2026-08-19) e podem ser reaproveitados se o usuário decidir implementar.
- Não há campo de reajuste automático nem geração de boleto/cobrança — é só o texto do contrato.
- O formulário não valida CPF/CNPJ (formato), só verifica se o campo foi preenchido. **Ainda não implementado** — chegou a ser discutido em 2026-08-16 (checagem de dígito verificador de CPF e CNPJ, com máscara nos campos `${p}_cpf`, `fiador_cpf`, `test1_cpf`, `test2_cpf`), mas o usuário pediu pra deixar pra depois.
- Editar contrato/declaração/currículo: registros salvos *antes* dessa versão de cada formulário não têm os campos soltos de rua/número/complemento — ao editar um desses, o campo "Rua" recebe o endereço inteiro composto e "Número"/"Complemento" ficam em branco pro usuário ajustar manualmente (não dá pra separar com segurança um endereço já junto).
- Editar currículo: o campo "Qual tipo de cargo você busca no mercado de trabalho?" é salvo hoje a partir de `qual_cargo || tipo_cargo_busca` (um OR entre dois campos diferentes do formulário) — um bug preexistente, não introduzido agora. Ao editar, não dá pra saber qual dos dois originou o valor salvo, então ambos os campos são preenchidos de volta com o mesmo valor (redundante, mas não perde informação).
