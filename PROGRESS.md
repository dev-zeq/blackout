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

## Possíveis próximos passos (não pedidos ainda, só ideias)

- Locação de imóvel não tem opção de "imóvel com múltiplas unidades" ou campos de IPTU/condomínio separados — hoje é uma cláusula fixa genérica.
- Não há campo de reajuste automático nem geração de boleto/cobrança — é só o texto do contrato.
- O formulário não valida CPF/CNPJ (formato), só verifica se o campo foi preenchido. **Ainda não implementado** — chegou a ser discutido em 2026-08-16 (checagem de dígito verificador de CPF e CNPJ, com máscara nos campos `${p}_cpf`, `fiador_cpf`, `test1_cpf`, `test2_cpf`), mas o usuário pediu pra deixar pra depois.
- Editar contrato/declaração/currículo: registros salvos *antes* dessa versão de cada formulário não têm os campos soltos de rua/número/complemento — ao editar um desses, o campo "Rua" recebe o endereço inteiro composto e "Número"/"Complemento" ficam em branco pro usuário ajustar manualmente (não dá pra separar com segurança um endereço já junto).
- Editar currículo: o campo "Qual tipo de cargo você busca no mercado de trabalho?" é salvo hoje a partir de `qual_cargo || tipo_cargo_busca` (um OR entre dois campos diferentes do formulário) — um bug preexistente, não introduzido agora. Ao editar, não dá pra saber qual dos dois originou o valor salvo, então ambos os campos são preenchidos de volta com o mesmo valor (redundante, mas não perde informação).
