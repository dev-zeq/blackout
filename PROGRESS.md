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

## Piloto "Ler Documento" — Locação de Imóvel (2026-08-19)

Componente novo **só** nas etapas Locador/Locatário do Contrato de Locação de Imóvel (`contrato-form.html`) — Compra e Venda de Veículo/Imóvel, que reaproveitam a mesma `stepPessoa()`, ficam 100% intocados (gate por `s.tipo === 'imovel_locacao'` dentro da própria função).

**Fluxo**: botão "📷 Ler Documento" acima do Nome completo → folha de ação "Tirar foto" (`capture="environment"`) / "Escolher da galeria" (dois `<input type="file">` ocultos, mesmo padrão já usado em `curriculo-form.html`) → imagem é redimensionada/comprimida no `<canvas>` (maior lado 1600px, JPEG 0.82 — API nativa, sem lib nova) → vira base64 e é mandada pra nova Edge Function `documento-ia` → tela de conferência com os campos extraídos **editáveis** antes de aplicar ("Usar estes dados" / "Descartar").

**Edge Function `documento-ia`** (Deno, projeto `kihnavaovspdjnegcraj`): mesmo esqueleto de `curriculo-ia` (CORS, `OPENAI_API_KEY` já configurada nos Secrets), mas manda a imagem pro `gpt-4o-mini` como `image_url` (visão) em vez de só texto. Prompt trava vocabulário pra bater com as opções que já existem no formulário (`estado_civil` só uma das 5 opções do `<select>`, `uf_emissor` só sigla de UF válida) e proíbe expressamente inventar dado não legível. A função também nunca deixa `nacionalidade` vir preenchida a partir de "Naturalidade" (bug pego no teste — documento tem os dois campos e são coisas diferentes).

**Confiabilidade**: a IA retorna `legivel: true/false`; o cliente trata como não confiável tanto `legivel:false` quanto `legivel:true` sem nome nem CPF. Nesse caso aparece a mensagem fixa pedida pelo usuário ("Não foi possível realizar uma leitura confiável. Verifique a nitidez ou preencha manualmente.") — o motivo específico da IA (quando existe) só aparece como detalhe menor abaixo, nunca substituindo essa frase.

**Descarte da imagem**: a imagem **nunca** é gravada em lugar nenhum — não sobe pro Supabase Storage, não vira coluna em tabela nenhuma. Existe só como `base64` em memória durante a chamada à Edge Function; a variável é descartada logo depois da resposta (sucesso ou erro). Nenhuma tabela/coluna/bucket novo foi criado no Supabase pra esse piloto.

**Campos novos**: `a_nascimento`/`a_orgao_emissor`/`a_uf_emissor` (+ equivalentes `b_`) — opcionais, só renderizados/aplicados em Locação de Imóvel. Persistidos em `dados.pessoa_a/pessoa_b.nascimento/orgao_emissor/uf_emissor` (via `pessoa()` em `submitForm()`) e restaurados em modo de edição (`carregarPessoa()`). Como só há UI pra esses campos em Locação, eles ficam sempre `null` nos outros dois tipos de contrato — inofensivo. **Não** entraram na cláusula de qualificação do contrato final (`qualificarCV()` em `index.html`, compartilhada por todos os tipos) — ficam só guardados no registro por enquanto, pra não mexer numa função usada por todos os contratos.

**Testado** (harness local, sem senha de produção — mesma limitação já registrada pra outras features): folha de ação abre/fecha certo; leitura de uma imagem sintética sem dados de documento retorna `legivel:false` e mostra a mensagem fixa pedida; leitura de uma imagem sintética simulando um RG (nome, CPF, RG, nascimento, órgão emissor, UF emissor, e um campo "Naturalidade" de propósito) extraiu tudo certo e a tela de conferência aplicou certinho nos campos do formulário, inclusive a nacionalidade caindo em "Outra" quando o valor lido não bate com Brasileiro(a)/Venezuelano(a)/Haitiano(a) — e ficando em branco (sem alterar o valor padrão) quando a IA não tem certeza da nacionalidade. Confirmado que Compra e Venda de Veículo continua sem o botão/campos novos. **Não testado**: câmera real de celular (só o input `capture="environment"` foi conferido por leitura de código, igual ao padrão já usado no currículo) e o texto final do contrato em produção.

**Próximo passo, se o piloto for aprovado**: replicar o mesmo componente pras etapas de Vendedor/Comprador de Compra e Venda de Veículo/Imóvel, e decidir se `orgao_emissor`/`uf_emissor` entram na cláusula de qualificação.

## Campos de data sem digitação — flatpickr (2026-08-19)

Pedido do usuário: nenhum campo de data do sistema deveria exigir digitação — no celular tem que abrir o seletor nativo (rolagem), no computador um calendário, sempre exibindo DD/MM/AAAA. Antes de implementar, confirmei que o projeto não tinha nenhuma lib de date-picker (só `supabase-js`/`extenso`/`html2canvas` via `esm.sh`) — por isso foi adicionada a **flatpickr** (`esm.sh/flatpickr@4.6.13`, locale `Portuguese`, tema `dark.css` do próprio flatpickr via CDN, com pequenos overrides de cor pra bater com o `--accent` verde do app). Zero dependências, mesmo padrão de CDN já usado no projeto.

Isso **substituiu** a tentativa anterior (máscara de texto DD/MM/AAAA digitada à mão, ver histórico de commits do mesmo dia) — o usuário decidiu que não queria digitação nenhuma, só seleção visual.

**Onde**: só nos formulários que o cliente preenche — `contrato-form.html` (Data de nascimento do Locador/Locatário — piloto, Data de início da locação, Data da primeira parcela em compra/venda a prazo, e o campo de nascimento da tela de conferência do "Ler Documento") e o Recibo em `index.html` (campo Data). **Não** foi aplicado nos campos internos do painel (fechamento de caixa, planejamento, PIX, saídas, contratos manuais CV_*) — decisão explícita do usuário, escopo só nos formulários de cliente.

**Como funciona**: `campoDataBR(key, label, obrigatorio)` em `contrato-form.html` (e o equivalente `inicializarCampoData()` em `index.html`) renderiza um `<input readonly data-role="fp-data">` — sem `value` no HTML, porque quem preenche é o flatpickr via `defaultDate` depois. `flatpickr(el, { altInput:true, altFormat:'d/m/Y', dateFormat:'Y-m-d', locale:Portuguese, allowInput:false, onChange })` cria um segundo input visível (o "altInput") mostrando DD/MM/AAAA, enquanto o input original vira `type=hidden` e guarda o valor real em AAAA-MM-DD — é esse valor original que o resto do código sempre leu (`s[key]`, `reciboForm.data_recibo`), então nada mudou no que é salvo no banco, só a forma de preencher.

**Cuidado ao reaproveitar em telas que redesenham via `innerHTML`** (é o padrão de todo o projeto — cada etapa do formulário é uma string de template redesenhada do zero): toda vez que o pedaço do DOM com um campo de data é recriado, o flatpickr precisa ser inicializado de novo (senão o clique não abre nada) — mas cuidado pra não inicializar duas vezes o mesmo elemento (gera instância duplicada). Por isso as chamadas de `inicializarCamposData()` ficam escopadas por container específico (`#cardArea` inteiro só nas etapas que são redesenhadas por completo; `#condEntradaDinheiroParcelas` sozinho quando só aquele pedacinho é redesenhado dentro da etapa de Entrada).

**Comportamento por dispositivo** (decisão consciente, não bug): no celular o flatpickr detecta e cede lugar ao seletor nativo do sistema operacional (rolagem de dia/mês/ano) — é o comportamento padrão da lib (`disableMobile: false`), e foi exatamente o que o usuário pediu ("no celular abra o seletor nativo"). No computador, o calendário é sempre o do flatpickr (garantindo DD/MM/AAAA em qualquer navegador).

**Testado** (harness local): campo Data de nascimento abre calendário em português, tema escuro batendo com o app; navegação de ano digitando (precisa de Enter/blur pra recalcular o grid — só digitar sem confirmar não atualiza os dias, é comportamento da própria lib) escolhendo 15/08/1988 corretamente, valor interno confirmado via JS como `1988-08-15` (ISO); digitação manual no campo bloqueada (`allowInput:false`) — tentei digitar e nada mudou; tela de conferência do "Ler Documento" também usando flatpickr, pré-preenchida com a data lida pela IA (15/03/1988) e aplicando certinho ao formulário (`1988-03-15` confirmado). **Não testado**: `index.html`/Recibo (fica atrás da senha da equipe, não tenho acesso) — só confirmado que o arquivo carrega sem erro de console/import; e o seletor nativo real de celular (Android/iPhone), que só existe fora do ambiente de preview.

## Endereço do Locatário condicional (residencial × comercial) — 2026-08-19

Pedido do usuário: em locação **residencial** (casa, apartamento, kitnet...) não faz sentido pedir um endereço separado pro Locatário — o endereço dele passa a ser o do próprio imóvel alugado. Em locação **comercial** (sala, loja, galpão...) o Locatário continua informando endereço próprio (ex: sede da empresa), separado do imóvel.

**Problema de ordem**: a etapa que pergunta "Finalidade" (Residencial/Comercial) sempre existiu (`im_finalidade`), mas ficava dentro da etapa "Dados do Imóvel", que só vem **depois** das etapas de Locador e Locatário — na hora de renderizar a etapa do Locatário ainda não dava pra saber se ia precisar do endereço dele ou não. Solução: criei uma etapa nova e pequena, **"Tipo de locação"**, entre Locador e Locatário, só com a pergunta Residencial/Comercial (o campo duplicado foi removido de dentro de "Dados do Imóvel", que agora só mostra um lembrete no subtítulo: "uso residencial"/"uso comercial"). Contrato ficou com 9 etapas em vez de 8.

**Onde mexeu** (tudo em `contrato-form.html`, só a etapa de Locação de Imóvel — Compra e Venda de Veículo/Imóvel reaproveitam `stepPessoa()` sem nenhuma mudança):
- `stepFinalidadeLocacao()` — etapa nova.
- `buildSteps()` — no ramo `imovel_locacao`, as etapas de pessoa ganharam `.__key` explícito (`'pessoaA'`/`'pessoaB'`) porque a etapa nova desloca a posição do Locatário no array, e `stepKey()` tinha um fallback que inferia a etapa pela posição fixa (`stepIndex === 1/2`) — isso só valia enquanto Locatário era sempre a 3ª etapa, o que deixou de ser verdade só pra Locação.
- `locatarioSemEnderecoProprio()` — helper novo (`true` quando `tipo === 'imovel_locacao' && im_finalidade === 'Residenciais'`), usado em 3 lugares: `stepPessoa()` (esconde Rua/Número/Complemento/Cidade/Estado do Locatário e mostra um aviso no lugar), `validarPessoa()` (não exige esses campos nesse caso) e o builder `pessoa(p)` dentro de `submitForm()` (quando é o caso, monta o endereço do Locatário a partir de `im_*` — endereço do imóvel — em vez de `b_*`, reaproveitando as mesmas funções genéricas `enderecoFinal`/`bairroFinal`/`cidadeFinal`/`estadoFinal`, que já são agnósticas de prefixo).

**Efeito em contratos antigos reabertos pra edição**: se um contrato residencial antigo (de antes dessa mudança) tinha um endereço próprio do Locatário digitado manualmente, ao reabrir e salvar de novo esse endereço é substituído pelo do imóvel — é o comportamento esperado da nova regra, não um bug.

**Testado**: fluxo Residencial completo (Locador com endereço → Tipo de locação = Residencial, pré-selecionado por padrão → Locatário sem nenhum campo de endereço, com o aviso explicativo → Dados do Imóvel com subtítulo "uso residencial", sem campo de Finalidade duplicado); voltei até "Tipo de locação", troquei pra Comercial, avancei de novo até Locatário e confirmei que os campos de Rua/Número/Complemento/Cidade/Estado voltam a aparecer normalmente. Sem erros no console em nenhum dos dois caminhos. **Não testado**: o texto final do contrato em produção (senha da equipe) e reabertura em modo de edição de um contrato salvo com essa lógica nova.

## Cláusula DOS ENCARGOS simplificada (2026-08-19)

Pedido do usuário: a cláusula de encargos do Contrato de Locação (`index.html`, `TIPOS.CONTRATO_LOCACAO_IMOVEL.corpo()`) tinha uma segunda cláusula fixa cobrando do LOCATÁRIO "despesas ordinárias de condomínio, gás e demais consumos do imóvel... bem como o IPTU" — item que não existe no modelo do usuário e nunca foi configurável no formulário (era texto fixo, sem campo nenhum por trás). Essa cláusula foi **removida por completo**. Restou só a primeira cláusula de DOS ENCARGOS, que já existia e já era gerada a partir dos campos do formulário (`pagamento_agua`/`pagamento_energia`, cada um com LOCADOR/LOCATÁRIA/Dividido entre as partes) — nada mudou na lógica dela, só o texto do caso "Dividido" ficou mais explícito: em vez de "em partes iguais", agora diz "divididas igualmente entre as partes, cabendo 50% (cinquenta por cento) para cada uma".

Não precisou mexer no formulário (`contrato-form.html`) — os campos "Quem paga a fatura de água?"/"...de energia elétrica?" já existiam com exatamente as 3 opções pedidas (Locador/Locatária/Dividido), de uma sessão anterior (ver seção "Revisão das cláusulas de Locação" acima). Mudança ficou 100% dentro de `corpo()`, então só afeta o texto final do Contrato de Locação — não toca em Compra e Venda de Veículo/Imóvel nem em nenhum outro tipo de documento.

**Testado**: `index.html` carrega sem erro de sintaxe/console. **Não testado**: o texto final renderizado em produção (senha da equipe) — a mudança é só remoção de uma `clausulaCV()` fixa + troca de uma string, então revisão foi por leitura de código.

## Cláusula DO SOSSEGO reescrita do zero (2026-08-19)

Pedido do usuário: substituir **integralmente** a cláusula de sossego (`index.html`, dentro de `TIPOS.CONTRATO_LOCACAO_IMOVEL.corpo()`, seção `<h3>DO SOSSEGO E DO HORÁRIO DE SILÊNCIO</h3>`) pelo texto novo dele, não um ajuste. A versão anterior (criada numa sessão passada, ver "Revisão das cláusulas de Locação" acima) tinha 1 cláusula principal + 3 parágrafos (Primeiro/Segundo/Terceiro); a nova é um texto único, mais curto, sem parágrafos separados — troquei tudo por uma única `clausulaCV(n++, ...)` com o texto exato que o usuário passou (só capitalizei "LOCATÁRIO" pra bater com a convenção de maiúsculas já usada no resto do documento pra Locador/Locatário — nenhuma outra palavra foi alterada).

Como a numeração das cláusulas (`n++`) é sequencial e não fixa, trocar 1 cláusula + 3 parágrafos por só 1 cláusula reduz a contagem de itens numerados em 3 a partir daí — é automático, não precisa de ajuste manual.

**Testado**: `index.html` carrega sem erro de sintaxe/console. **Não testado**: texto final em produção (senha da equipe).

## Limite de moradores na cláusula de destinação (2026-08-19)

Pedido do usuário: campo novo obrigatório "Quantidade máxima de moradores autorizados" — definido em comum acordo entre locador e locatário — que complementa automaticamente a cláusula DO OBJETO E FINALIDADE, só em locação **residencial**.

**Formulário** (`contrato-form.html`): campo novo (`max_moradores`, número inteiro, obrigatório) dentro de `stepCondicoesLocacao()`, condicionado a `s.im_finalidade === 'Residenciais'` — some completamente em locação comercial (nem aparece, nem é obrigatório lá). Validado em `validateCurrentStep()` (caso `'locacao'`), salvo em `especifico.max_moradores` no `submitForm()` (fica `null` em locação comercial) e restaurado em modo de edição (`carregarParaEdicao`).

**Cláusula** (`index.html`, `TIPOS.CONTRATO_LOCACAO_IMOVEL.corpo()`, `<h3>DO OBJETO E FINALIDADE</h3>`): quando é residencial e o campo foi preenchido, a frase da cláusula ganha o complemento pedido — "...destinado exclusivamente a fins residenciais, sendo autorizada a ocupação por, no máximo, X pessoas, conforme acordado entre as partes." (concordância singular/plural tratada: "1 pessoa" vs "X pessoas"). Logo depois, um **Parágrafo Único** novo cobre o caso de excesso: precisa de autorização prévia e expressa do LOCADOR, podendo virar aditivo contratual (inclusive com revisão do valor do aluguel) se as partes concordarem — texto do usuário, sem alteração de conteúdo. Em locação comercial, ou se o campo não foi preenchido (registros antigos), a cláusula fica exatamente como já era, sem o complemento nem o parágrafo.

**Testado**: fluxo completo no formulário (Locador → Tipo de locação Residencial → Locatário sem endereço → Imóvel → Condições da Locação) confirmando que o campo aparece, é obrigatório (bloqueia "Avançar" com a mensagem certa até preencher) e aceita o valor. `index.html` carrega sem erro de sintaxe/console. **Não testado**: o texto final da cláusula em produção (senha da equipe) e o caso comercial (onde o campo não deveria aparecer nem entrar na cláusula) — revisão desse caso foi por leitura de código, reaproveitando a mesma condicional (`im_finalidade === 'Residenciais'`) já testada nas mudanças anteriores do dia.

## Índice de reajuste fixo, campo removido do formulário (2026-08-19)

Pedido do usuário (com uma correção no meio da própria mensagem — pediu primeiro só pra Locação Residencial, depois corrigiu pra valer nos dois: residencial **e** comercial): remover o campo "Índice de reajuste anual" (que deixava o cliente escolher entre IGP-M/IPCA/INPC) do formulário de Locação, e usar sempre o mesmo texto fixo na cláusula, independente do que era escolhido antes.

**Formulário** (`contrato-form.html`): campo `indice_reajuste` removido por completo — do `<select>` em `stepCondicoesLocacao()`, do estado inicial `s`, do que é salvo em `especifico` no `submitForm()`, e do que é restaurado em `carregarParaEdicao()`. Não sobrou nenhum resto (`grep` confirma zero ocorrências no arquivo).

**Cláusula** (`index.html`, `DO ALUGUEL E REAJUSTE`): antes lia `e.indice_reajuste` (com fallback pra `'IGP-M'`); agora é uma string fixa, sempre a mesma, com a redação exata pedida pelo usuário: "Caso ocorra a renovação do contrato, o valor do aluguel será reajustado pelo Índice Geral de Preços do Mercado (IGP-M), ou por outro índice oficial que venha a substituí-lo por determinação legal, considerando o período de vigência do contrato." Vale pros dois casos (residencial e comercial) — a cláusula de reajuste nunca foi diferenciada por finalidade, então não precisou de nenhuma condicional nova.

Registros antigos que tinham `indice_reajuste` diferente de IGP-M salvo (ex: IPCA/INPC) — se reabertos, o texto da cláusula sai sempre com IGP-M agora, independente do que foi escolhido na época; é o comportamento esperado da nova regra (índice deixou de ser configurável).

**Testado**: os dois arquivos carregam sem erro de sintaxe/console; `grep` confirma que não sobrou nenhuma referência a `indice_reajuste` em `contrato-form.html`. **Não testado**: o texto final da cláusula em produção (senha da equipe) — mudança é troca de uma string fixa, revisão por leitura de código.

## Qualificação do Locatário sem endereço + prazo com data de término (2026-08-19)

Duas mudanças pedidas juntas, as duas só em `index.html` (`TIPOS.CONTRATO_LOCACAO_IMOVEL.corpo()`), as duas restritas a **locação residencial** — comercial fica com o texto de sempre, sem nenhuma mudança.

**1) Qualificação das partes**: o LOCATÁRIO deixou de ter o endereço na linha de qualificação ("NOME, nacionalidade, estado civil, profissão, portador da CI nº X, inscrito no CPF nº Y" — parou por aí, sem "residente e domiciliado..."). O LOCADOR continua com tudo, endereço incluso, igual sempre foi. `qualificarCV(p, papel)` (função compartilhada por todos os tipos de contrato) ganhou um 3º parâmetro opcional `semEndereco` — por padrão `false`/omitido, então nenhum outro chamador (Compra e Venda de Veículo/Imóvel, Locador, Locatário comercial) muda de comportamento. Só a chamada do Locatário em Locação passou `ehResidencial` nesse parâmetro. O endereço do imóvel alugado continua aparecendo — só que exclusivamente na cláusula DO OBJETO E FINALIDADE, que já existia (não duplicava antes porque, pra residencial, o endereço "do locatário" salvo já era o do imóvel — ver "Endereço do Locatário condicional" acima —, então a qualificação repetia a mesma informação da cláusula de objeto; agora não repete mais).

**2) Cláusula DO PRAZO com data de término**: antes só mostrava a data de início (e ainda dizia, de forma confusa, que a mesma data de início era "a data em que o LOCATÁRIO obriga-se a restituir o imóvel" — sobrava só uma data pra duas coisas). Agora, em residencial, calcula a data de término (início + prazo em meses) e mostra as duas: "...com início em DD/MM/AAAA e término em DD/MM/AAAA, data em que o LOCATÁRIO obriga-se a restituir...". Helper novo `somarMesesBR(dataISO, meses)` (perto de `dataBR()`) faz a soma tratando o caso de o dia não existir no mês de destino (ex: 31/01 + 1 mês vira 28/02, não "estoura" pra 03/03). A cláusula é sempre recalculada a partir de `e.data_inicio`/`e.prazo_meses` direto na hora de montar o texto — não fica um valor salvo em lugar nenhum, então nunca desatualiza se um dos dois mudar. Comercial continua com o texto antigo (só data de início), sem a frase de término.

**Testado**: `somarMesesBR` testado isoladamente no console com 4 casos (12 meses a partir de 10/08/2026 → 10/08/2027; 31/01 + 1 mês → 28/02, sem estourar; 29/02/2024 bissexto + 12 meses → 28/02/2025; 30 meses a partir de 15/01/2026 → 15/07/2028) — todos corretos. `index.html` carrega sem erro de sintaxe/console. **Não testado**: o texto final das duas cláusulas em produção (senha da equipe).

## Concordância de gênero automática (LOCADOR/LOCADORA, LOCATÁRIO/LOCATÁRIA) — 2026-08-19

Pedido do usuário: usar o campo Gênero (já existente no formulário, tanto pro Locador quanto pro Locatário) pra decidir automaticamente, em **todo** o texto do contrato — título de qualificação, cláusulas, obrigações e assinaturas —, se cada parte é tratada como LOCADOR/LOCATÁRIO (masculino) ou LOCADORA/LOCATÁRIA (feminino), sem precisar editar o texto na mão.

Antes disso, o contrato inteiro usava "LOCADOR"/"LOCATÁRIO" fixos em maiúsculo em todas as ~30 ocorrências espalhadas pelas cláusulas (`TIPOS.CONTRATO_LOCACAO_IMOVEL.corpo()`, `index.html`), independente do gênero real de cada parte.

**Como foi feito**: dentro de `corpo()`, dois valores calculados uma vez no topo da função a partir de `locador.genero`/`locatario.genero` — reaproveitando o helper `g(genero, masc, fem)` que já existia no sistema (usado em `qualificarCV()` pra flexionar "portador/portadora" etc.):
- `termoLocador` = "LOCADOR" ou "LOCADORA"; `termoLocatario` = "LOCATÁRIO" ou "LOCATÁRIA".
- `fLocador`/`fLocatario` (função `flexArtigos()`, nova) — os artigos e contrações que sempre acompanham essas palavras nas frases: `O/A`, `o/a`, `ao/à`, `pelo/pela`, `do/da`. Sem isso a palavra mudava mas o artigo do lado ficava errado (ex: "a LOCADORA" com artigo masculino).

Toda cláusula que mencionava "LOCADOR"/"LOCATÁRIO" (qualificação das partes, objeto, prazo, aluguel, encargos, vistoria, garantia — caução/fiador/seguro-fiança —, uso e conservação, animais, sossego, rescisão, desapropriação, intimação sanitária, venda do imóvel, e o rótulo nas assinaturas no fim do contrato) foi reescrita trocando o texto fixo pelas variáveis `termoLocador`/`termoLocatario`/`fLocador.*`/`fLocatario.*`. Em duas cláusulas (vistoria e rescisão/desapropriação) também precisou flexionar adjetivos/pronomes que concordam com a parte em questão ("isento/isenta", "este/esta", "desobrigado/desobrigada"), senão a palavra LOCADOR mudava mas o resto da frase continuava no masculino.

`qualificarCV(p, papel, semEndereco)` (função compartilhada por todos os tipos de contrato, ver "Qualificação do Locatário sem endereço" acima) passou a receber `termoLocador`/`termoLocatario` no lugar dos literais `'LOCADOR'`/`'LOCATÁRIO'` como segundo parâmetro — como já é uma função genérica, funciona sem nenhuma mudança nela.

`textoResponsavelEncargo()` (cláusula DOS ENCARGOS) também foi ajustada: antes gerava "por conta do(a) LOCADOR" (artigo genérico "do(a)" fixo, sem refletir o gênero real); agora identifica qual das duas partes é (`quem === 'LOCADOR'`) e usa o artigo e o termo certos dessa parte especificamente.

Só entra em Contrato de Locação — Compra e Venda de Veículo/Imóvel usam VENDEDOR/COMPRADOR (palavras que não têm variação de gênero na forma usada, "vendedor"/"comprador" continuam sem "a" nos textos desses contratos) e não foram tocados.

**Testado**: lógica de flexão (termo + artigos) testada isoladamente no console pra 3 combinações — ambos masculino, ambos feminino, e misto (locador feminino + locatário masculino) — conferindo a concordância em 5 trechos representativos (objeto, prazo, aluguel, vistoria com pronome/adjetivo, desapropriação) — todos gramaticalmente corretos nos 3 casos. `index.html` carrega sem erro de sintaxe/console; `grep` confirma que não sobrou nenhum "LOCADOR"/"LOCATÁRIO" literal solto nas cláusulas (só as 3 ocorrências esperadas: a definição de `termoLocador`/`termoLocatario` e a comparação `quem === 'LOCADOR'`). **Não testado**: o texto final do contrato completo em produção (senha da equipe) — a extensão do teste (30+ trechos de cláusula) tornou inviável simular o `corpo()` inteiro fora do painel; a revisão desses trechos foi por leitura de código, um por um.

## Possíveis próximos passos (não pedidos ainda, só ideias)

- Procuração DETRAN e Procuração Simples ainda não são geradas pelo painel — só existem como link pra Google Forms externo. Os modelos antigos já foram extraídos da planilha numa sessão (ver git history/conversa de 2026-08-19) e podem ser reaproveitados se o usuário decidir implementar.
- Não há campo de reajuste automático nem geração de boleto/cobrança — é só o texto do contrato.
- O formulário não valida CPF/CNPJ (formato), só verifica se o campo foi preenchido. **Ainda não implementado** — chegou a ser discutido em 2026-08-16 (checagem de dígito verificador de CPF e CNPJ, com máscara nos campos `${p}_cpf`, `fiador_cpf`, `test1_cpf`, `test2_cpf`), mas o usuário pediu pra deixar pra depois.
- Editar contrato/declaração/currículo: registros salvos *antes* dessa versão de cada formulário não têm os campos soltos de rua/número/complemento — ao editar um desses, o campo "Rua" recebe o endereço inteiro composto e "Número"/"Complemento" ficam em branco pro usuário ajustar manualmente (não dá pra separar com segurança um endereço já junto).
- Editar currículo: o campo "Qual tipo de cargo você busca no mercado de trabalho?" é salvo hoje a partir de `qual_cargo || tipo_cargo_busca` (um OR entre dois campos diferentes do formulário) — um bug preexistente, não introduzido agora. Ao editar, não dá pra saber qual dos dois originou o valor salvo, então ambos os campos são preenchidos de volta com o mesmo valor (redundante, mas não perde informação).
