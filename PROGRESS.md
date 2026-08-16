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

## Editar contrato já gerado (2026-08-16)

Terceiro botão na tela de contrato formatado do painel: **EDITAR | IMPRIMIR | FECHAR**. Só aparece pros 3 tipos vindos do formulário público (`CONTRATO_CV_VEICULO`/`CONTRATO_CV_IMOVEL`/`CONTRATO_LOCACAO_IMOVEL`) — os outros tipos (Declarações, Termo, CV_* manuais do painel) não têm formulário público equivalente pra reabrir, então o botão fica escondido pra eles.

**Como funciona**: EDITAR abre `contrato-form.html?editId=<uuid>` dentro de um `<iframe>` num modal novo (`editarContratoModal`) em `index.html`. O `contrato-form.html`, ao detectar `editId` na URL, busca o registro no Supabase, recarrega o state `s` inteiro (endereço volta a ser Rua/Número/Complemento separados, cidade/bairro/tipo "Outro" são reconstruídos comparando com as listas conhecidas — ver `carregarParaEdicao()`/`paraSelecaoOutro()`) e pula direto pra 2ª etapa (a de escolha do tipo fica travada, trocar o tipo no meio de uma edição não é suportado). Botão final vira "Salvar alterações" + link "Cancelar edição".

**Importante — quem grava é sempre o painel, nunca o formulário público**: como só `index.html` tem a senha de escrita, `contrato-form.html` NUNCA grava direto no modo de edição — ele só monta o `registro` e manda via `postMessage({type:'contrato-salvar-pedido', id, registro})` pro `window.parent`. O painel escuta isso, chama `dbUpdate('declaracoes_pendentes', registro, {id})`, e se der certo fecha o modal e reabre o contrato já reformatado; se der erro, manda `postMessage({type:'contrato-salvar-resultado', ok:false, error})` de volta pro iframe mostrar o erro sem perder os dados digitados. `Cancelar edição` só manda `contrato-editar-cancelado`, não toca no banco.

Atualiza o **mesmo registro** (mesmo `id`, mesmo `.eq('id', ...)` na Edge Function) — não cria linha nova, não duplica, não vira histórico. Testado de ponta a ponta ao vivo: criei uma Locação de Imóvel de teste, editei o valor do aluguel pelo botão Editar, salvei, conferi direto no banco que só existe 1 registro com aquele id e o valor mudou — depois apaguei o registro de teste.

## Testado

- Fluxo completo dos 3 tipos de contrato, local e ao vivo em produção (lanblackout.com).
- As 6 combinações de pagamento (veículo/dinheiro × à vista/a prazo).
- Cálculo de área do terreno (12m × 25m = 300m²) ao vivo, sem perder foco do campo.
- Envio real em produção + limpeza do registro de teste depois.
- Editar contrato já gerado (Locação de Imóvel): reabertura com todos os campos preenchidos (inclusive cidade "Outra"/bairro livre/estado manual), troca do valor do aluguel, salvar, e confirmação direto no banco de que atualizou o mesmo `id` sem duplicar.

## Possíveis próximos passos (não pedidos ainda, só ideias)

- Locação de imóvel não tem opção de "imóvel com múltiplas unidades" ou campos de IPTU/condomínio separados — hoje é uma cláusula fixa genérica.
- Não há campo de reajuste automático nem geração de boleto/cobrança — é só o texto do contrato.
- O formulário não valida CPF/CNPJ (formato), só verifica se o campo foi preenchido. **Ainda não implementado** — chegou a ser discutido em 2026-08-16 (checagem de dígito verificador de CPF e CNPJ, com máscara nos campos `${p}_cpf`, `fiador_cpf`, `test1_cpf`, `test2_cpf`), mas o usuário pediu pra deixar pra depois.
- Editar contrato: registros salvos *antes* dessa versão do formulário não têm os campos soltos de rua/número/complemento — ao editar um desses, o campo "Rua" recebe o endereço inteiro composto e "Número"/"Complemento" ficam em branco pro usuário ajustar manualmente (não dá pra separar com segurança um endereço já junto).
