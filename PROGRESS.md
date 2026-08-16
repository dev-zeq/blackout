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

## Testado

- Fluxo completo dos 3 tipos de contrato, local e ao vivo em produção (lanblackout.com).
- As 6 combinações de pagamento (veículo/dinheiro × à vista/a prazo).
- Cálculo de área do terreno (12m × 25m = 300m²) ao vivo, sem perder foco do campo.
- Envio real em produção + limpeza do registro de teste depois.

## Possíveis próximos passos (não pedidos ainda, só ideias)

- Locação de imóvel não tem opção de "imóvel com múltiplas unidades" ou campos de IPTU/condomínio separados — hoje é uma cláusula fixa genérica.
- Não há campo de reajuste automático nem geração de boleto/cobrança — é só o texto do contrato.
- O formulário não valida CPF/CNPJ (formato), só verifica se o campo foi preenchido. **Ainda não implementado** — chegou a ser discutido em 2026-08-16 (checagem de dígito verificador de CPF e CNPJ, com máscara nos campos `${p}_cpf`, `fiador_cpf`, `test1_cpf`, `test2_cpf`), mas o usuário pediu pra deixar pra depois.
