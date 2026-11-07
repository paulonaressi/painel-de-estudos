# Banco de Questões — ENEM e Vunesp 2ª fase

Plataforma de estudos em construção: questões do ENEM e das provas discursivas (2ª fase) aplicadas
pela Vunesp, com campos à esquerda, enunciado ao centro e resposta + resolução à direita, e tema
claro/escuro. O dono do projeto fala português e trabalha por refinamentos sucessivos ("vamos
começar assim e depois refinamos"): entregue algo que funcione e diga com clareza o que ficou de fora.

Este arquivo registra o estado em 05/10/2026, quando o projeto saiu de uma sessão no Windows para
continuar no Mac.

## Publicação

- Repo público `paulonaressi/painel-de-estudos`; site no GitHub Pages (branch `main`, raiz):
  https://paulonaressi.github.io/painel-de-estudos/ — publicado em 06/11/2026 por escolha do dono,
  ciente de que os cadernos (Vunesp, Objetivo, Foco) ficam públicos.
- Os PDFs de `provas/` são versionados (o site precisa deles); `.nojekyll` na raiz.
- Cada push em `main` republica em ~1 min; o Pages guarda cache por ~10 min. Por isso os
  `<script>`/`<link>` do `index.html` levam `?v=N`: **ao mudar qualquer JS/CSS, suba o N em todos**,
  senão o navegador mistura arquivo novo com antigo (já quebrou a página uma vez).

## Conta e sincronização (`js/sync.js`)

- Supabase, projeto `painel-de-estudos` (ref `jppthizijnsmogdwjpxn`, sa-east-1, plano gratuito),
  falado por `fetch` direto (Auth + REST), sem biblioteca. A chave no código é a publicável.
- Tabela `public.registros (user_id, id, dados jsonb, t, atualizado_em)` com RLS por `auth.uid()`;
  `anon` sem acesso. Gatilho mantém a linha de maior `t` (aparelho offline não sobrescreve).
- O `localStorage` continua sendo a fonte da tela; `bq:pendentes:v1` guarda o que falta subir,
  `bq:sessao:v1` a sessão, `bq:sync:v1` o usuário e o último `atualizado_em` baixado.
- Contas são criadas pelo dono no painel do Supabase (cadastro aberto deve ficar desligado).
- Aviso "Leaked Password Protection Disabled" nos advisors do Supabase: aceito pelo dono
  (06/11/2026). Exige plano pago e o projeto fica no gratuito; só há duas contas. Não reportar.
- Sem conta, o site funciona como antes, só sem sincronizar.
- Projeto fora do iCloud desde 06/11/2026 (`~/Developer/painel-de-estudos`); a pasta antiga no
  iCloud é só backup.

## Como rodar

```bash
pip3 install -r requirements.txt   # PyMuPDF, só para os scripts de extração
python3 servidor.py                # http://localhost:5173
```

- Precisa de servidor (não abre por `file://`): a tela busca JSON e PDFs locais.
- O servidor manda `Cache-Control: no-cache`. Sem isso o navegador segura versões antigas dos
  scripts e as mudanças "não aparecem".
- `.claude/launch.json` chama `python`; no Mac troque para `python3`.
- Precisa de internet para o ENEM 2009–2023 (API), para o leitor de PDF (pdf.js via cdnjs) e
  para as fontes do Google Fonts.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html`, `css/estilo.css` | Página única; tema por `data-theme` em `<html>` |
| `js/util.js` | `BQ.h` (criação de DOM), `BQ.md` (markdown mínimo e escapado), registros do aluno, cache em IndexedDB |
| `js/enem.js` | Dados do ENEM: API enem.dev (2009–2010) e anos locais (2011–2025, `ANOS_LOCAIS`); proposta de redação dos anos locais; resoluções |
| `js/classificador.js` | Disciplina e assunto por palavras-chave |
| `js/recortes.js` | Mostra uma questão recortando-a do PDF (pdf.js) |
| `js/app.js` | Estado e telas |
| `data/vunesp-pesquisa.json` | Levantamento bruto das provas Vunesp (links, status HTTP, observações, lacunas) |
| `data/vunesp-catalogo.js` | Catálogo que a página carrega. **Gerado**, não editar |
| `data/questoes/<inst>/<arquivo>.json` | Índice de cada caderno: onde está cada questão no PDF + texto extraído. **Gerado** |
| `data/enem/<ano>.json` | ENEM extraído de PDF (2024, 2025). **Gerado** |
| `data/resolucoes/` | Resoluções comentadas do ENEM (`enem-2024.json`, `enem-2025.json`) e `indice.json` com os anos que têm |
| `data/respostas-modelo/` | Respostas-modelo das discursivas da Vunesp: um arquivo por caderno (mesmo caminho do índice em `data/questoes/`) e `indice.json`. **Gerado** por `ferramentas/respostas-modelo/validar.py` |
| `provas/` | PDFs baixados (206 MB) e `manifesto.json` (url → arquivo local) |
| `ferramentas/` | Scripts de download, extração, catálogo, avaliação e resoluções |

Sem etapa de build: JavaScript puro em scripts clássicos, tudo pendurado em `window.BQ`.

## De onde vêm os dados

**ENEM 2009 e 2010** (e qualquer ano fora de `ANOS_LOCAIS`): API aberta `https://api.enem.dev/v1`, consultada ao vivo e guardada em IndexedDB.
- Limite de 10 requisições a cada 10 s; `limit` máximo 50; `offset` é por **número da questão**
  e o intervalo devolvido inclui as duas pontas.
- O campo `discipline` da API está errado em dezenas de questões por ano. A área é calculada pela
  posição na prova (`ordemAreas` em `js/enem.js`): 2017+ Linguagens/Humanas/Natureza/Matemática;
  2010–2016 Humanas/Natureza/Linguagens/Matemática; 2009 Natureza/Humanas/Linguagens/Matemática.
- Sem `language` a API devolve só um idioma nas 5 questões de língua estrangeira; pedir um idioma
  que o ano não tem dá erro 400 (2009 não tem nenhum, 2011 só espanhol).
- Faltam na própria fonte algumas questões anuladas e algumas imagens (`broken-image.svg`).

**ENEM 2011 a 2025**: cadernos azuis do INEP (`ferramentas/baixar-enem.sh`, com a tabela dos nomes
antigos até 2019), 185 questões por ano com gabarito e a proposta de redação (`redacao` em
`data/enem/<ano>.json`; até 2016 ela fica na p. 2 do caderno do 2º dia). A numeração confere com a
API em 2011–2025. O gabarito da API erra em alguns anos (2011 q81, 2012 q165, 2018 q15, 8 de 2021,
2022 q143): o PDF do INEP confirmou o extraído — mais um motivo para não usar a API. O PDF de 2021
tem a fonte embaralhada (texto extraído ilegível; recortes e numeração certos), então disciplina e
assunto de 2021 saem ruins. 2009 e 2010 ficam na API: o extrator acha 172 e 143 questões (2010
tem texto cifrado) e o gabarito de 2010 só vem marcado no caderno; `processar_enem` não grava ano
incompleto. 2009: gabarito com as quatro cores em colunas. Anuladas: 157 (2022); 164 (2023); 129 (2024); 123, 132 e 174 (2025). Em 2023 a numeração da API
bate com a do caderno azul (178 conferidas por texto); a API não tem a 34 nem a 174 de 2023. Em 2022 as 185 conferem, inclusive inglês e espanhol. O `fetch` do Node falhou para
`download.inep.gov.br` no Windows (causa não investigada); `curl` funciona.

**Vunesp**: não existe base aberta. O catálogo aponta para PDFs:
- oficiais em `documento.vunesp.com.br` (2022+) e `vestibular.unesp.br` (2019–2021). A lista de
  documentos de um concurso fica em `https://documento.vunesp.com.br/Projeto/<CÓDIGO>/documento`
  (ex.: VNSP2504 = Unesp 2026). O site da Vunesp responde 403 a `curl` e a `requests`; o `fetch`
  do Node passa.
- cópias de terceiros (Curso Objetivo, Foco Medicina) onde não há oficial.
- resoluções comentadas: páginas do Curso Objetivo (links, não conteúdo).

## Pipeline

```bash
node ferramentas/baixar-cadernos.js [--copias] [--listar]   # Vunesp -> provas/ + manifesto.json
bash ferramentas/baixar-enem.sh [ano ...]                   # INEP  -> provas/enem
python3 ferramentas/extrair-questoes.py [vunesp|enem]       # -> data/questoes/**, data/enem/*.json
node ferramentas/gerar-catalogo.js                          # -> data/vunesp-catalogo.js
node ferramentas/avaliar-classificador.js                   # distribuição por disciplina/assunto
python3 ferramentas/exportar.py                             # pacotes zip em exportar/ (com e sem PDFs)
```

Sempre nessa ordem: baixar regrava a entrada do manifesto, extrair acrescenta nela `indice` e
`questoes`, e o catálogo só liga um caderno à cópia local se o índice existir.

### Como o extrator localiza as questões (`ferramentas/extrair-questoes.py`)

Lê as linhas de texto de cada página com posição (PyMuPDF), acha os "inícios" — marcador
`Questão N`, instrução de texto compartilhado ("…para responder às questões de 26 a 28"),
cabeçalho de seção, redação, fim da prova — e cada bloco vai de um início até o próximo, na ordem
de leitura. Grava, por questão, retângulos `[página, x0, y0, x1, y1]` em pontos e o texto.

Casos que já deram trabalho e estão tratados (não desfazer sem testar):
- **Uma questão por página** (cadernos discursivos): o conteúdo vai da tarja `Questão N` até a
  caixa "Resolução e resposta" (em 2010, só "Resolução"). A tarja alterna de lado em alguns anos.
- **Duas colunas** e **largura inteira misturadas**, às vezes na mesma página (ENEM 2025 tem
  muitas páginas de largura inteira): a página é fatiada nos inícios da coluna esquerda e cada
  fatia é classificada (`segmentos_em_colunas`).
- **Numeração que recomeça** no mesmo arquivo (Prova I e Prova II): vira `parte` 0, 1, 2…
- **Cadernos antigos sem tarja** (Unesp 2005–2009, Unifesp 2003–2011): a questão começa com o número
  em negrito, com dois dígitos ("01."); só vale no arquivo que não tem nenhuma "Questão N"
  (`MARCA_POR_NUMERO`). Nesses, o nome da disciplina ("FÍSICA") encerra o bloco anterior e a coluna
  direita é medida página a página. Itens da capa ("3. Esta prova…") têm um dígito e ficam de fora.
- **Número sozinho em negrito** (Famema 2022): modo `MARCA_POR_NUMERO = 'sozinho'`, só sem tarja e
  sem "01."; páginas com mais de 8 números soltos (folhas de resposta e de redação) são ignoradas.
- **Arquivo com uma parte defeituosa** (Famema 2024): `gerar-catalogo.js` aproveita as partes boas
  (contínuas, sem questão reduzida à tarja, 5+ questões) e descarta parte idêntica a outra.
- **Texto de apoio acima da tarja** numa prova de uma questão por página (Einstein 2024 q5, Unesp
  2016/2 q33, Unesp 2017 q32): se o bloco anterior terminou na caixa de resposta de outra página, o
  topo da página passa a ser da questão.
- **Apoio de uma questão só** ("…para responder à questão 01", Unesp 2019 q1, 2018/2 q25, Unifesp 2006
  q5): vira apoio `de = ate`, aceito inclusive na página 2 (a capa não usa essa frase).
- **Última linha encostada na caixa de resposta** (Unesp 2020 q18, Einstein 2020 q5, FMJ 2024 q6): o fim
  da página desce até o pé da última linha do enunciado, sem passar da caixa.
- **Cabeçalho de seção ao lado da coluna direita** (ENEM 2023 p. 20: "Questões de 46 a 90" à esquerda e
  a tarja da 48 à direita): não fatia a página. O início de questão fica 6 pt acima da tarja, mas não
  sobe além do pé da linha de cima (a alternativa E da 108 de 2023 encosta na tarja da 109).
- Seção de língua com dois-pontos ("Questões de 01 a 05 (opção: inglês)", ENEM 2022).
- **Figura sozinha na coluna direita** (ENEM 2021 p. 30): a faixa continua em duas colunas. Corrigiu
  também Unifesp 2009 (2º dia) 5–8, Famema 2022 33–37, Unesp 2007/2 1–8 e outros.
- Redação: "INSTRUÇÕES PARA A REDAÇÃO" + "PROPOSTA DE REDAÇÃO" na mesma página viram um bloco só (o tema
  estava faltando também em Unesp 2005/2, 2006/2 e 2009/2).
- **Formulário de Física e Matemática no fim do caderno** (Unifesp 2003–2006): pelo título ou por ser
  página sem questão com 40%+ das linhas contendo "=", encerra a prova (antes entrava na q25).
- **Número pendurado na margem** ("01." à esquerda do texto, Unifesp antiga): a coluna esquerda começa
  3 pt antes da mediana dos marcadores.
- **Linha que invade a tarja seguinte** (ENEM 2020: alternativa E da 114 encosta na tarja da 115): o
  corte fica 0,5 pt acima da tarja.
- **Faixa sem nada à direita** só vira largura inteira se a página não tiver coluna direita (ENEM 2020
  p. 30: a continuação da 86 fica no alto da coluna direita; Unifesp 2008 3º dia q19/q20 estavam trocadas).
- Marca-d'água "RASCUNHO" girada, marcador partido em dois pedaços ("questão" + "01"), marcador
  duplicado, "QUESTÃ" sem o O, instrução quebrada por hífen, redação sem título em texto.
- O relatório do script lista `FALTAM [...]` quando a numeração não bate com o catálogo. Os da
  FICSAE (51–55) são só rótulo do catálogo; o caderno numera 1–5.

Para conferir recortes, renderize com `page.get_pixmap(clip=...)` e olhe a imagem; contagem
certa não garante recorte certo. As coordenadas do PyMuPDF e do pdf.js coincidem (testado,
inclusive em PDF com CropBox deslocada).

### Catálogo (`ferramentas/gerar-catalogo.js`)

- Junta num caderno as cópias (oficial + terceiros) que cobrem as mesmas questões.
- `local` só entra se o índice tiver numeração contínua e nenhuma questão reduzida à tarja;
  senão o caderno abre como PDF inteiro.
- Com questões locais, as cópias redundantes saem da tela.
- Unesp: `numeracao_unica` (1–36 ou 1–60 de ponta a ponta) e `faixas` por campo, exceto nas
  edições marcadas `numeracao_por_caderno` (2005/2–2009/2: cada dia recomeça e o 2º dia tem três
  versões por área), que funcionam como as outras instituições (o id leva o índice do caderno).
- `partes` no caderno do levantamento dá nome e campos a cada parte de um arquivo (versões da Unesp
  antiga, inglês/francês da Unifesp 2008–2011); `versao` separa versões em arquivos distintos com a
  mesma numeração (Unesp 2005/2). Padrão
  confirmado pelas capas de 2011 em diante: Humanas 1–12, Natureza/Matemática 13–24, Linguagens
  25–36. Em 2010 era Natureza 1–12, Humanas 13–24. De 2021 a 2023 a 2ª fase foi objetiva
  (Linguagens 1–20, Humanas 21–40, Natureza/Matemática 41–60; ordem inferida, não conferida).

## Formatos

```jsonc
// data/questoes/<inst>/<arquivo>.json
{ "arquivo": "provas/…pdf", "paginas": 28, "layout": "pagina|colunas",
  "questoes": [{ "n": 13, "recortes": [[9, 48.7, 52, 580.4, 390.5]], "texto": "…", "parte": 1 }],  // parte só quando > 0
  "apoios":   [{ "de": 26, "ate": 28, "recortes": […], "texto": "…" }],
  "redacao":  { "recortes": […], "texto": "…" }, "avisos": [] }

// data/enem/<ano>.json
{ "ano": 2025, "questoes": [{ "numero": 91, "idioma": null, "area": "natureza", "gabarito": "B",
  "pdf": "provas/enem/…pdf", "apoio": […], "recortes": […], "texto": "…" }] }

// data/resolucoes/enem-<ano>.json — chave = número, ou "1:ingles" / "1:espanhol"
{ "ano": 2025, "questoes": { "91": { "resolucao": "…", "confianca": "alta|media|baixa", "pendencia": null } } }
```

Registros do aluno ficam só no navegador (`localStorage`): `bq:registros:v1` (por id de questão),
`bq:ui:v1`, `bq:tema`. Ids: `enem:<ano>:<numero>[:<idioma>]`;
`vunesp:<instituição>|<edição>|<fase>:[c<índice do caderno>:]q<numero>` (sem o `c…` na Unesp) e
`…:redacao`.

## Classificador (`js/classificador.js`)

Pontuação por palavras-chave, restrita às disciplinas da área; sem área conhecida concorrem todas.
É uma estimativa e erra: no piloto, a questão 150 de 2025 (proporção) saiu como "Geometria
espacial". Nunca foi medido contra uma amostra corrigida à mão; o que existe é a distribuição
(`avaliar-classificador.js`): Natureza fica em 12–16 por disciplina; Humanas oscila mais
(Geografia 12–22, História 9–14).

## Resoluções comentadas

Piloto feito para o ENEM 2025: 182 resoluções (as 3 anuladas ficam sem). Geradas por IA, uma
execução por área, lendo a **imagem** de cada questão; em todas o gabarito oficial foi alcançado
de forma independente; 6 marcadas como discutíveis (34, 41, 83, 89, 90, 133). Quem coordenou
conferiu quatro contra a imagem da prova (128, 150, 167, 180) e leu outras duas sem abrir a
questão (61, 95); as demais não tiveram revisão. A tela avisa isso em cada uma e só mostra a
resolução junto com o gabarito.

ENEM 2024 (06/11/2026): mesmo roteiro, 182 resoluções, todas chegaram ao gabarito oficial;
"media" em 28, 78, 90, 101 e 128 (na 24 o agente errou a primeira leitura e depois justificou o
gabarito). Quem coordenou conferiu 121, 140 e 74 contra a imagem. `preparar.py` e `validar.py`
foram ajustados para rodar no Python 3.9 do Mac.

Para repetir em outro ano extraído de PDF:

```bash
python3 ferramentas/resolucoes/preparar.py 2024                        # imagens + manifestos em trabalho/
# uma execução por área, seguindo ferramentas/resolucoes/instrucoes.md
python3 ferramentas/resolucoes/validar.py trabalho/resolucoes/enem-2024 --ano 2024 --mostrar natureza:95
python3 ferramentas/resolucoes/validar.py trabalho/resolucoes/enem-2024 --ano 2024 --gravar
```

Custo do piloto: cerca de 770 mil tokens e 10 a 28 minutos por área, em paralelo.

ENEM 2023 (07/11/2026): mesmo roteiro, depois de passar 2023 para caderno local; 184 resoluções (a 164
foi anulada), todas no gabarito oficial; "media" só em 45 e 84. Quem coordenou leu 151 e 120.

ENEM 2022 (07/11/2026): 184 resoluções (157 anulada), todas no gabarito oficial; "media" em 6, 23, 29,
39, 43 (linguagens) e 145 (enunciado ambíguo; na 23 o agente errou a primeira leitura).

ENEM 2021 (07/11/2026): 184 (138 anulada), todas no gabarito oficial; "media" em 6 de Linguagens e na
79. Lidas na imagem (o texto extraído de 2021 é ilegível).

ENEM 2020: 183 (135 e 157 anuladas), todas no gabarito oficial. Faltam resoluções de 2011–2019. Antes de 2017 a ordem das áreas é Humanas 1–45, Natureza 46–90,
Linguagens 91–135 (idiomas 91–95), Matemática 136–180: dê a faixa certa a cada agente.

## Gabarito das objetivas da Vunesp (`ferramentas/gabaritos-vunesp.py`)

Não há gabarito aberto (o site da Vunesp recusa programas). O script baixa as resoluções comentadas do
Curso Objetivo (PDF, em `trabalho/gabaritos/`, fora do site), parte em blocos pela letra da resposta e
casa cada objetiva recortada com o bloco de mais palavras em comum — o número não é usado. Três
formatos: "Resposta: X" depois da questão (2015+); "3" / "B" antes do enunciado (até 2014); só a letra
minúscula antes do enunciado (2003–2005). Saída: `data/gabaritos/<caminho do índice>.json`
("parte:número" → letra) e `indice.json`. A tela mostra "Conferir resposta" com o aviso de que não é
oficial. 07/11/2026: 1.393 de 1.565 objetivas. Faltam Famema 2016 e 2017 (o Objetivo só tem uma tabela
de gabarito, a de 2017 em imagem) e partes de Unifesp 2008–2012 (francês, partes). Conferido contra a
leitura pelo número na Unifesp 2024. Próximo passo combinado: resoluções comentadas dessas objetivas,
ancoradas nesse gabarito.

## Respostas-modelo das discursivas da Vunesp

Não há resposta oficial publicada (exceto gabaritos de objetivas). Geradas por IA lendo a imagem
de cada questão, em lotes de até 45, um agente por lote:

```bash
python3 ferramentas/respostas-modelo/preparar.py UNESP:2024-2026 FAMERP,FAMEMA,FCMSCSP,FICSAE,FMJ:2024-2027
# um agente por lote-NN.json, seguindo ferramentas/respostas-modelo/instrucoes.md
python3 ferramentas/respostas-modelo/validar.py trabalho/respostas-modelo/<data> --mostrar unesp/2026-2_1-dia#0:15
python3 ferramentas/respostas-modelo/validar.py trabalho/respostas-modelo/<data> --gravar
```

- Só entram cadernos com questões recortadas; objetivas (4+ alternativas no texto) e redação ficam
  de fora. Chave: `<caminho do índice>#<parte>:<número>`; na tela, `parte:número` no arquivo do caderno.
- A tela mostra o botão "Ver resposta-modelo" no cartão Resolução; o "visto" fica no registro
  (`modelo: true`) e sincroniza. Sempre com o aviso de IA, sem revisão humana.
- Bloco 2 (06/11/2026): 485 discursivas, Unesp 2017–2020 e Medicina 2018–2023 (447 alta, 33 média,
  5 baixa). Os quatro recortes incompletos (Unesp 2019 q1, Unesp 2018/2 q25, Einstein 2020 q5, Unesp
  2020 q18) e a FMJ 2024 q6 foram corrigidos no extrator e as respostas refeitas por quem coordenou.
- Bloco Unifesp (06/11/2026): 515 discursivas, 2003–2026 (471 alta, 42 média, 2 baixa: 2013 q15 com dados
  incoerentes na própria prova e reaplicação 2024 q18 sem a altura da pirâmide). Ficou de fora a 2009
  (2º dia) q8, que é objetiva com recorte errado (charge misturada às questões 5–7, sem alternativas).
  Recortes a melhorar na Unifesp antiga: q25 de 2004 e 2005 arrasta o formulário do fim do caderno; em
  2003–2004 o 1º dígito do número sai cortado na margem. Agentes em paralelo dividem o scratchpad: peça
  uma subpasta própria a cada um (no lote-02 um arquivo de rascunho sumiu e foi refeito).
- Primeira rodada: 06/11/2026, 436 discursivas (Unesp 2024–2026/2; Famerp, Famema, Santa Casa,
  Einstein e FMJ 2024–2027), escolha do dono do projeto, sem leitura prévia de amostra. 400 "alta",
  36 "media", nenhuma "baixa". Quem coordenou leu contra a imagem: Unesp 2026/2 q15, Famerp 2025
  q13, Santa Casa 2026 q7, Einstein 2024 q5 (reescrita) e Famema 2026 q3.
- Incidente da 1ª rodada: o nome da imagem usava só o nome do arquivo do índice, e
  famema/2025_prova-i-discursiva colidiu com fmj/2025_… (idem 2026); as 16 da Famema foram
  respondidas sobre imagens da FMJ e refeitas. O nome agora leva a pasta da instituição.
- Limites conhecidos: itens que pedem desenho ou completar figura são descritos em texto.

## Estado

- ENEM: 17 anos (2009–2025); 2011–2025 dos cadernos do INEP (com redação); resoluções em 2021–2025.
- Vunesp (06/11/2026): 108 edições no catálogo, 194 cadernos com questões extraídas, 4.290 questões
  na tela. Unesp 38 edições (1.857 questões), Unifesp 23 (1.440), Famema 11 (384), Famerp 12 (220),
  Santa Casa 10 (200), Einstein 10 (145), FMJ 4 (44).
- `provas/`: 168 PDFs da Vunesp (52 oficiais, 95 do Curso Objetivo, 21 do Foco Medicina) e 8 do
  INEP, 255 MB. As cópias de terceiros foram verificadas: sem JavaScript, ação automática ou anexo.
- Rodada de conteúdo de 06/11/2026: Einstein 2027; Famerp 2015–2017; Famema 2016–2017; Unifesp
  2003–2017 (exceto 2007); Unesp 2011 (25–36) e 2010/2 (1–24) pelo Foco; Unesp 2005/2–2009/2.
- Desde 11/2026 o site da Vunesp recusa (403) o `fetch` do Node e o `curl`, nas listas e nos PDFs;
  as listas de documentos ainda abrem num navegador de verdade. `baixar-cadernos.js` tenta o oficial
  e, com `--copias`, cai para a cópia do mesmo caderno (foi assim no Einstein 2027).

### Lacunas conhecidas

- Unesp 2016/2: só as questões 25–36 (o arquivo do Objetivo não traz o 1º dia; não há outra cópia).
- Layout que o extrator não entende, abre como PDF inteiro: Einstein 2018 (provavelmente não é prova da Vunesp). O painel de navegador do app não desenha PDF em iframe; num navegador comum aparece.
- Sem caderno nenhum: Famema 2023, Famerp 2018 (o Objetivo só tem a resolução).
- Unifesp 2007: o único caderno discursivo (Objetivo) é um pacote PDF com JavaScript e anexos;
  descartado. Unifesp 2004: sem o 2º dia.
- Unesp 2006 e 2007 (3º dia): a proposta de redação não tem título e fica dentro do recorte da
  questão 10. Unesp até 2005: o Objetivo só tem a 1ª fase (2005) ou nada (2001–2004/2).
- Unesp: não há respostas esperadas oficiais para as discursivas; gabarito oficial só de 2021–2023.
- Fora do catálogo: FMABC (só objetivas), Einstein de inverno 2017/2 e 2023/2 (só objetivas),
  UNILUS e outros; edições 2027 de Famerp e Famema (inscrições abertas em 06/11/2026), Unifesp
  2027 e Unesp 2027 (2ª fase ainda não aplicada).

## Combinado com o dono do projeto

- **Downloads autorizados até aqui**: cadernos oficiais (Vunesp, Unesp, INEP); cópias do Curso
  Objetivo nas edições sem oficial; Foco Medicina **só** nas seis edições da Unesp que o Objetivo
  não tem (2018/2, 2017, 2016, 2015, 2013, 2010) e, desde 06/11/2026, nas lacunas da Unesp 2011
  (25–36) e 2010/2 (1–24). Em 06/11/2026 ele pediu uma rodada de "caça" de cadernos faltantes e a
  incorporação deles; uma fonte nova (fora Vunesp, Unesp, INEP, Objetivo e Foco) ainda pede aval.
- **Direitos autorais**: as questões da Vunesp não são transcritas; a tela mostra o recorte do
  PDF, e o texto extraído serve só para classificar. Foi avisado que, se a plataforma for pública
  ou comercial, o licenciamento do conteúdo (Vunesp, cursinhos) é decisão dele.
- **Resoluções**: sempre rotuladas como geradas por IA e sem revisão humana. A sugestão feita foi
  ele ou um professor ler umas 20 antes de escalar; se aprovar, seguir por 2024 e depois 2023.

## Próximos passos possíveis

1. Resoluções do ENEM 2011–2020 (ver Resoluções comentadas); 2009 e 2010 pedem outra fonte de recorte.
2. Melhorar a classificação — as resoluções prontas dão um sinal melhor que palavras-chave — e
   medir o acerto contra uma amostra corrigida à mão.
3. Filtro por disciplina também na Vunesp (hoje é só etiqueta por questão).
4. Fechar as lacunas da Unesp (depende de autorização para novas fontes) e ensinar ao extrator os
   layouts que faltam.
5. Respostas-modelo para o resto da Vunesp (hoje: Unesp 2017–2026/2, Medicina 2018–2027 e Unifesp).
6. Busca por texto, cópia offline do ENEM 2009–2023, contas de usuário/sincronização do progresso.

## Convenções

- Interface, comentários e nomes de domínio em português; sem framework nem dependências no
  front-end.
- Todo texto vindo de fora passa por `BQ.md`/`BQ.escapeHtml` antes de virar HTML; `html:` em
  `BQ.h` só recebe saída de `BQ.md`.
- Não editar arquivos gerados; mude o script e rode o pipeline.
- Depois de mexer na tela, conferir no navegador nos dois temas. `requestAnimationFrame` e o
  desenho do pdf.js não rodam com a aba em segundo plano: se o recorte "não aparece" num teste
  automatizado, verifique se a aba está visível antes de procurar erro.
