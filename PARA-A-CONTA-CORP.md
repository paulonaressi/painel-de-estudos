# Instruções para o Claude da conta corporativa (09/11/2026)

## Situação

- **Versão oficial** (a que está no site): o repositório `github.com/paulonaressi/painel-de-estudos`,
  ramo `main`, commit `a28858d` ou posterior. Tem login e sincronização, o ENEM 2011–2025 pelo caderno
  do INEP com redação e resoluções, 1.886 respostas-modelo, gabaritos em `data/gabaritos/` e 450
  resoluções de objetivas.
- **Versão corp**: a pasta `iCloud Drive/Documents/Painel de estudos`, onde você trabalhou. Ela partiu
  de um backup antigo (06/11, sem git) e é uma linha paralela. Não continue nela.
- Objetivo: levar para a versão oficial o que só existe na versão corp, sem perder nada da oficial.

## Regras

- Não faça push e não use contas conectadas. A entrega é um arquivo `git bundle` (passo 8).
- Leia o `CLAUDE.md` da versão oficial antes de começar; ele manda sobre o seu.
- Nunca edite arquivos gerados à mão; mude o script e rode o pipeline.
- **Proteja as chaves:** as respostas-modelo, os gabaritos e as resoluções são indexados por
  `parte:número` em cada índice `data/questoes/...`. Antes de qualquer mudança no extrator ou no
  catálogo, copie `data/questoes` e `data/enem`. Depois, confira que nenhuma chave com conteúdo em
  `data/respostas-modelo` ou `data/gabaritos` mudou de questão. Se um recorte com conteúdo mudar,
  olhe a imagem.
- Commits pequenos, um por passo, com mensagem em português.

## Passos

1. **Clone a versão oficial** numa pasta nova: `git clone https://github.com/paulonaressi/painel-de-estudos.git ~/painel-oficial`.
   Daqui em diante, trabalhe só nela. A pasta corp fica como fonte, só para leitura.
2. **Provas objetivas novas, de 2022 em diante** (Conhecimentos Gerais da Famerp e da Santa Casa,
   Prova I do Einstein, 1ª fase da Unesp e Prova II da FMJ):
   - Traga `ferramentas/acrescentar-objetivas.py` e rode-o sobre o `data/vunesp-pesquisa.json` oficial.
   - Baixe os cadernos (`baixar-cadernos.js --copias`, ou copie os PDFs da pasta corp com a mesma
     entrada no manifesto).
   - Rode `extrair-questoes.py vunesp` e depois `gerar-catalogo.js`.
3. **Gabaritos.** A tela lê `data/gabaritos/<caminho do índice>.json` (`{"questoes": {"parte:n": "A"}}`,
   mais `indice.json`).
   - Converta o gabarito oficial da corp (`provas/gabaritos-vunesp/` → `gabaritos-vunesp.py` da corp)
     para esse formato.
   - Onde houver gabarito oficial, ele substitui o do Objetivo.
   - Junte as duas origens num único script do repositório oficial.
   - Registre a origem de cada gabarito, para a tela dizer "oficial" ou "Curso Objetivo".
4. **Resoluções das objetivas.** A tela mostra a resolução, depois de "Conferir resposta", a partir de
   `data/respostas-modelo/<caminho do índice>.json` (chave `parte:n`, campos `resposta`, `confianca`,
   `pendencia`).
   - Converta as 2.355 resoluções corp (`data/resolucoes/vunesp-<inst>.json`, chave
     `<pdf>#<parte>:<n>`) para esse formato. Use o manifesto e o catálogo para ligar cada PDF ao seu índice.
   - A resposta precisa terminar em `**Resposta: X**` igual ao gabarito.
   - Ao juntar, não sobrescreva o que já existe.
5. **Objetivas antigas que faltam** (seção "TRABALHO EM ANDAMENTO" do `CLAUDE.md` oficial):
   - Lotes 04, 06, 07, 11, 14 e 15 a 28 de `preparar.py --objetivas`.
   - Antes, tire dos lotes as chaves que já ganharam resolução no passo 4.
   - Um agente por lote, seguindo `ferramentas/respostas-modelo/instrucoes-objetivas.md`.
   - No fim, rode `validar.py ... --gravar`.
6. **Melhorias de código da corp, nesta ordem**, cada uma com o teste de chaves do item "Proteja as chaves":
   - **a.** Os ajustes do extrator listados no `CLAUDE.md` corp (faixas, coluna direita, instrução de
     apoio em inglês, hífen invisível, capa na página 2, tabela larga), só os que a versão oficial ainda não tem.
   - **b.** As estruturas por caderno (`ESTRUTURAS`: disciplina fixa por bloco) e o classificador novo
     (comando com peso maior, `tambem`).
   - **c.** O aviso de questão incompleta da API (`falhasDaFonte`), que só vale para 2009 e 2010.
   - **Não traga** o ENEM 2021–2023 pela API nem `gabaritos-inep`/`corrigirGabarito`: a versão oficial
     já usa o caderno e o gabarito do INEP.
7. **Teste e documentação:**
   - Suba o `?v=N` no `index.html`.
   - Rode `python3 servidor.py` e confira no navegador, **sem login**: ENEM e Vunesp, uma objetiva
     nova (gabarito e resolução depois de conferir), os dois temas e nenhum erro no console.
   - Atualize o `CLAUDE.md` oficial: estado, contagens, regras novas; apague a seção
     "TRABALHO EM ANDAMENTO" se ela tiver acabado e apague este arquivo.
8. **Entrega:**
   - `git -C ~/painel-oficial bundle create ~/Library/Mobile\ Documents/com~apple~CloudDocs/Documents/painel-corp.bundle origin/main..main`
   - Espere o iCloud terminar de enviar.
   - Diga ao Paulo para rodar no Mac pessoal:
     ```
     cd ~/Developer/painel-de-estudos
     git pull ~/Library/Mobile\ Documents/com~apple~CloudDocs/Documents/painel-corp.bundle main
     git push
     ```
   - O `git pull` é só avanço (fast-forward): ninguém mais mexe no `main` até lá.

Se faltar fôlego, entregue um bundle a cada passo concluído, na mesma pasta e com o mesmo nome: o
`pull` aproveita o que estiver pronto.
