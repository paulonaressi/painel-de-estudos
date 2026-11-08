# Instruções para as resoluções comentadas das objetivas da Vunesp

Roteiro das objetivas (Unifesp, Famema, Unesp 2021–2023, Einstein), usado a partir de 08/11/2026. O
material vem de `preparar.py --objetivas`; a conferência e a publicação são feitas por `validar.py`.
O gabarito de cada questão vem das resoluções do Curso Objetivo (`ferramentas/gabaritos-vunesp.py`) —
não é o oficial da Vunesp.

Troque `{LOTE}` e `{PASTA}`.

---

Você vai escrever resoluções comentadas para questões objetivas (alternativas A a E) de vestibulares
aplicados pela Vunesp. A estudante marca uma alternativa, confere o gabarito e então lê a sua
resolução para entender o porquê.

## Material

Pasta: `{PASTA}`

- `{LOTE}.json`: lista de questões, cada uma com `chave` (copie sem mudar), `instituicao`, `edicao`,
  `caderno`, `numero`, `gabarito` (a letra correta), `imagem` (caminho do PNG) e `texto_extraido`.
- Um PNG por questão, recortado do caderno (inclui o texto de apoio quando a questão depende de um
  texto compartilhado).

A imagem é a fonte de verdade: abra todas, uma por questão, com a ferramenta Read. O
`texto_extraido` é só apoio — pode vir fora de ordem e não traz figuras, gráficos nem tabelas.

## Como trabalhar cada questão

1. Leia a imagem inteira e resolva a questão por conta própria, antes de olhar o `gabarito`.
   Contas trabalhosas: confira com Python (`python3`).
2. Compare com o `gabarito`. Se chegou a ele, explique o caminho. Se não chegou, refaça; se continuar
   sem chegar, escreva a melhor justificativa honesta para o gabarito, marque `confianca: "baixa"` e
   diga em `pendencia` qual é a divergência. Nunca troque a letra do gabarito.
3. Se a imagem estiver cortada, ilegível ou faltar um dado, não invente: diga o que faltou em
   `pendencia` e marque "baixa" ou "media".

## Como escrever

- Português do Brasil, frases completas, sem enrolação. Questões em inglês ou francês: escreva em
  português e explique o sentido do trecho-chave.
- Diga em uma frase qual é o conceito ou a ideia cobrada; mostre por que a alternativa correta está
  certa e, quando ajudar, por que a mais tentadora está errada.
- Em contas: dados, relação usada, conta, resultado com unidade, uma conta por linha, com símbolos
  Unicode (·, ×, ÷, ², √, Δ, →) e fórmulas químicas com subscritos (H₂O). Sem LaTeX.
- Não transcreva o enunciado nem trechos longos da prova; no máximo algumas palavras entre aspas.
  Nunca reproduza letra de canção.
- Tamanho: 60 a 150 palavras (até 180 se houver contas).
- Termine com uma linha exatamente assim: `**Resposta: X**`, com a letra do gabarito.

## Entrega

Um único arquivo JSON válido (UTF-8), na mesma pasta, chamado `respostas-{LOTE}.json`, com uma
lista de objetos na ordem do manifesto, um por questão:

```json
[
  { "chave": "data/questoes/…json#0:15", "resposta": "…\n\n**Resposta: C**", "confianca": "alta", "pendencia": null }
]
```

- `confianca`: "alta" (chegou ao gabarito por conta própria e a justificativa é sólida), "media"
  (justifica o gabarito, mas a questão é discutível ou dependeu de detalhe pouco legível) ou "baixa".
- `pendencia`: null ou uma frase dirigida ao estudante; nas "media" e "baixa" ela aparece na tela.

Grave o arquivo a cada ~10 questões. Use para rascunhos só uma subpasta própria do scratchpad
(outros agentes trabalham em paralelo). Não use a internet, não baixe nada e não altere nenhum outro
arquivo. Antes de terminar, rode
`python3 ferramentas/respostas-modelo/validar.py {PASTA}` (na raiz do repositório)
(sem `--gravar`) e corrija o que ele apontar no seu lote.

## Relatório final

Quantas ficaram em cada nível de confiança, a lista das que não são "alta" com o motivo, e qualquer
imagem ilegível, cortada ou com a resposta marcada.
