# Instruções para escrever as respostas-modelo das discursivas da Vunesp

Roteiro usado em 06/11/2026 (Unesp 2024–2026/2 e Medicina 2024–2027). Cada lote vai para um agente
separado, com o texto abaixo. O material vem de `preparar.py`; a conferência e a publicação são
feitas por `validar.py`.

Troque `{LOTE}` e `{PASTA}`.

---

Você vai escrever respostas-modelo para questões discursivas de vestibulares aplicados pela Vunesp
(Unesp, Famerp, Famema, Santa Casa, Einstein, FMJ). Um estudante escreve a própria resposta e só
depois abre a sua, para comparar e ver o que a banca provavelmente esperava. Não existe resposta
oficial publicada para essas provas: a sua é a referência que ele terá.

## Material

Pasta: `{PASTA}`

- `{LOTE}.json`: lista de questões, cada uma com `chave` (identificador, copie sem mudar),
  `instituicao`, `edicao`, `caderno`, `numero`, `imagem` (caminho do PNG) e `texto_extraido`.
- Um PNG por questão, recortado do caderno (inclui o texto de apoio quando a questão depende de um
  texto compartilhado).

A imagem é a fonte de verdade: abra todas, uma por questão, com a ferramenta Read. O
`texto_extraido` é só um apoio — pode vir fora de ordem, embaralhar fórmulas e não traz figuras,
gráficos, mapas nem tabelas. Confira na imagem todo dado que você usar.

## Como trabalhar cada questão

1. Leia a imagem inteira e identifique cada item pedido (a, b…) e o que exatamente cada um pede
   (explicar, citar, calcular, justificar, identificar…).
2. Resolva por conta própria, até o fim. Contas trabalhosas: confira com Python (`python3`).
3. Responda tudo o que foi pedido e só o que foi pedido, como um bom candidato faria na folha de
   resposta: direto, completo, com as justificativas e as unidades.
4. Se a imagem estiver cortada, ilegível ou faltar um dado (figura, tabela, texto de apoio), não
   invente: responda o que der, marque `confianca: "baixa"` e diga em `pendencia` o que faltou.
5. Quando a questão admitir mais de uma resposta aceitável (exemplos, opiniões, interpretações),
   dê uma resposta completa e diga em uma frase que outras respostas bem justificadas também valem.

## Como escrever

- Português do Brasil, registro de prova bem feita: frases completas, sem enrolação.
- Separe os itens: comece cada um com `**a)**`, `**b)**`… em parágrafo próprio.
- Em contas, mostre o caminho: dados, relação usada, conta, resultado com unidade. Uma conta por
  linha, com símbolos Unicode (·, ×, ÷, ², √, Δ, →, ≈) e fórmulas químicas com subscritos (H₂O).
  Sem LaTeX (a tela não renderiza).
- Em questões de língua estrangeira, escreva em português, salvo se o item pedir resposta no idioma.
- Não transcreva o enunciado nem trechos longos da prova: no máximo algumas palavras entre aspas
  quando for indispensável para apontar a passagem.
- Tamanho: o necessário para uma resposta nota máxima, em geral 40 a 120 palavras por item.
- Texto simples: parágrafos separados por linha em branco; **negrito** só nas marcas dos itens e,
  com moderação, na ideia-chave. Sem títulos e sem listas longas.

## Entrega

Um único arquivo JSON válido (UTF-8), na mesma pasta, chamado `respostas-{LOTE}.json`, com uma
lista de objetos na ordem do manifesto, um por questão:

```json
[
  { "chave": "data/questoes/…json#0:15", "resposta": "**a)** …\n\n**b)** …", "confianca": "alta", "pendencia": null }
]
```

- `confianca`: "alta" (resposta segura e completa), "media" (resposta defensável, mas a questão é
  aberta, discutível ou dependeu de detalhe pouco legível) ou "baixa" (ver passo 4, ou quando você
  não tem segurança no conteúdo).
- `pendencia`: null ou uma frase dirigida ao estudante. Nas questões "media" e "baixa" ela aparece
  na tela.

Grave o arquivo a cada ~10 questões, para não perder trabalho. Não use a internet, não baixe nada e
não altere nenhum outro arquivo. Antes de terminar, rode
`python3 /Users/Developer/Developer/painel-de-estudos/ferramentas/respostas-modelo/validar.py {PASTA}`
(sem `--gravar`) e corrija o que ele apontar no seu lote.

## Relatório final

Quantas questões ficaram em cada nível de confiança, a lista das que não são "alta" com o motivo,
e qualquer imagem ilegível ou cortada.
