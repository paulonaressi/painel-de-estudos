# Instruções para escrever as resoluções comentadas

Este é o roteiro usado no piloto do ENEM 2025. Cada área foi entregue a um agente separado, com
o texto abaixo e os ajustes da tabela no fim. O material vem de `preparar.py`; a conferência e a
publicação são feitas por `validar.py`.

Troque `{AREA}`, `{area}`, `{FAIXA}`, `{ANO}`, `{N}` e `{PASTA}` e acrescente os ajustes da área.

---

Você vai escrever resoluções comentadas para as questões de {AREA} ({FAIXA}) do ENEM {ANO}. Um
estudante responde a questão, confere o gabarito e então lê a sua resolução para entender o porquê.

## Material

Pasta: `{PASTA}`

- `{area}.json`: lista das {N} questões, cada uma com `numero`, `idioma` (null, "ingles" ou
  "espanhol"), `gabarito` (letra oficial do INEP, ou null quando a questão foi anulada), `imagem`
  (caminho do PNG) e `texto_extraido`.
- Um PNG por questão, recortado do caderno oficial (inclui o texto de apoio quando a questão
  depende de um texto compartilhado).

A imagem é a fonte de verdade: abra todas, uma por questão. O `texto_extraido` é só um apoio — foi
tirado automaticamente do PDF, pode vir fora de ordem, embaralhar fórmulas e não traz figuras,
gráficos, mapas nem charges. Confira na imagem todo número que você usar.

## Como trabalhar cada questão

1. Leia a imagem e resolva a questão por conta própria, até o fim.
2. Compare com o `gabarito` oficial. Se a sua resposta for diferente, refaça com cuidado.
3. Se ainda assim você não conseguir justificar o gabarito oficial, não force uma justificativa
   nem ajuste a conta para "dar certo": escreva a melhor explicação que tiver, marque
   `confianca: "baixa"` e diga em `pendencia` onde está a divergência. Um erro apresentado com
   segurança é o pior resultado possível aqui.
4. Questão anulada (`gabarito` null): não resolva; entregue `resolucao: null`, `confianca: null`,
   `pendencia: "Questão anulada pelo INEP."`.

## Como escrever

- Português do Brasil, tom de professor direto.
- Comece pela ideia central, mostre o raciocínio que leva à alternativa correta e, quando ajudar,
  diga em uma frase por que a alternativa mais tentadora está errada.
- Não repita o enunciado nem transcreva trechos longos da prova: cite no máximo algumas palavras
  entre aspas quando for indispensável para apontar a pista.
- Texto simples: parágrafos separados por linha em branco; **negrito** com moderação. Sem títulos,
  sem listas longas, sem LaTeX (a tela não renderiza).
- Termine com uma linha no formato `**Resposta: X**`, com a letra do gabarito oficial.

## Entrega

Um único arquivo JSON válido (UTF-8), na mesma pasta, chamado `resolucoes-{area}.json`, com uma
lista de {N} objetos na ordem do manifesto:

```json
[
  { "numero": 91, "idioma": null, "gabarito": "B", "resolucao": "…", "confianca": "alta", "pendencia": null }
]
```

- `confianca`: "alta" (chegou ao gabarito por conta própria e a justificativa é sólida), "media"
  (justifica o gabarito, mas a questão é discutível ou dependeu de detalhe pouco legível na
  imagem) ou "baixa" (ver passo 3).
- `pendencia`: null ou uma frase. Nas questões "media" e "baixa" ela aparece para o estudante.

Grave o arquivo a cada ~15 questões, para não perder trabalho. Não use a internet, não baixe nada
e não altere nenhum outro arquivo.

## Relatório final

Quantas questões ficaram em cada nível de confiança, a lista das que não são "alta" com o motivo,
e qualquer imagem ilegível ou cortada.

---

## Ajustes por área

| Área (`{area}`) | Questões | Tamanho | Ênfase |
|---|---|---|---|
| Linguagens (`linguagens`) | 1 a 45; as 1 a 5 existem em inglês e em espanhol | 60 a 150 palavras | Dizer o que o texto ou a imagem faz e qual conceito está em jogo. Em inglês e espanhol, escrever em português e explicar o sentido do trecho-chave. |
| Ciências Humanas (`humanas`) | 46 a 90 | 60 a 150 palavras | Situar o conteúdo cobrado (período, conceito, autor, processo geográfico) antes de ligar o texto à alternativa. |
| Ciências da Natureza (`natureza`) | 91 a 135 | 70 a 180 palavras | Nomear a lei ou o conceito e mostrar o passo a passo: dados, relação usada, conta, resultado com unidade. Contas em texto simples, uma por linha, com símbolos Unicode (·, ×, ÷, ², √, Δ, →) e fórmulas químicas com subscritos (H₂O). |
| Matemática (`matematica`) | 136 a 180 | 60 a 180 palavras | Dizer em uma frase qual é a ideia (regra de três, área, função afim…) e mostrar as contas com os números da questão, uma por linha. Conferir aritmética trabalhosa com Python. Apontar o erro típico que leva à alternativa mais tentadora. |

A numeração acima vale de 2017 em diante (1º dia: Linguagens e Humanas; 2º dia: Natureza e Matemática).
