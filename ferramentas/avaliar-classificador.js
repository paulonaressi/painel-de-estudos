// Mostra como o classificador (js/classificador.js) distribui as questões do ENEM por disciplina
// e assunto. Não mede acerto: serve para ver se uma mudança nas palavras-chave desequilibrou algo
// (o ENEM costuma ter cerca de 15 questões de cada disciplina em Natureza).
// Uso: node ferramentas/avaliar-classificador.js          anos locais (2025, 2024) + 2023 e 2019 pela API
'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
global.window = {};
require(path.join(raiz, 'js', 'classificador.js'));
const classificador = window.BQ.classificador;

const AREAS = [['linguagens', 1], ['humanas', 46], ['natureza', 91], ['matematica', 136]]; // ordem de 2017 em diante
const esperar = ms => new Promise(r => setTimeout(r, ms));
const assuntos = {};

function resumir(rotulo, questoes, area) {
  const porDisciplina = {};
  for (const q of questoes) {
    const c = classificador.classificar(q, area);
    porDisciplina[c.disciplina] = (porDisciplina[c.disciplina] || 0) + 1;
    const chave = `${c.disciplina} / ${c.assunto}`;
    assuntos[chave] = (assuntos[chave] || 0) + 1;
  }
  console.log(rotulo.padEnd(18), JSON.stringify(porDisciplina));
}

(async () => {
  for (const ano of [2025, 2024]) {
    const dados = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'enem', `${ano}.json`), 'utf8'));
    for (const [area] of AREAS) resumir(`${ano} ${area}`, dados.questoes.filter(q => q.area === area), area);
  }
  for (const ano of [2023, 2019]) {
    for (const [area, inicio] of AREAS) {
      const resp = await fetch(`https://api.enem.dev/v1/exams/${ano}/questions?offset=${inicio - 1}&limit=46`);
      const brutas = ((await resp.json()).questions || []).filter(q => q.index >= inicio && q.index < inicio + 45);
      resumir(`${ano} ${area}`, brutas.map(q => ({
        idioma: q.language,
        contexto: q.context,
        comando: q.alternativesIntroduction,
        alternativas: q.alternatives.map(a => ({ texto: a.text })),
      })), area);
      await esperar(1100); // a API aceita 10 requisições a cada 10 s
    }
  }
  console.log('--- assuntos (soma dos anos)');
  Object.entries(assuntos).sort().forEach(([chave, n]) => console.log(String(n).padStart(4), chave));
})();
