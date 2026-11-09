// Prepara o material para escrever resoluções comentadas de um ano do ENEM que a tela busca na API
// enem.dev (hoje só 2009 e 2010; os outros anos vêm do caderno: preparar.py). Usa o próprio js/enem.js, para que número, idioma e gabarito sejam exatamente
// os da tela. Por questão: enunciado em texto (contexto, comando e alternativas), figuras baixadas
// para img/ e o gabarito. Um manifesto por área, no mesmo formato que validar.py confere.
//
// Uso: node ferramentas/resolucoes/preparar-api.js 2023 [pasta de saída]
// Saída padrão: trabalho/resolucoes/enem-<ano>/
'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const ano = Number(process.argv[2]);
if (!ano || ano < 2009 || ano > 2023) {
  console.error('uso: node ferramentas/resolucoes/preparar-api.js <ano da API: 2009 ou 2010> [pasta de saída]');
  process.exit(1);
}
const destino = path.resolve(process.argv[3] || path.join(raiz, 'trabalho', 'resolucoes', `enem-${ano}`));
const pastaImg = path.join(destino, 'img');
fs.mkdirSync(pastaImg, { recursive: true });

// js/enem.js espera um navegador: só precisa de window.BQ.cache (aqui, sem cache) e de fetch
// para arquivos do projeto.
global.window = { BQ: { cache: { get: async () => null, set: async () => {} } } };
const fetchDaRede = global.fetch;
global.fetch = (url, ...resto) => (/^https?:/.test(url) ? fetchDaRede(url, ...resto) : Promise.resolve({
  ok: fs.existsSync(path.join(raiz, url)),
  json: async () => JSON.parse(fs.readFileSync(path.join(raiz, url), 'utf8')),
}));
require(path.join(raiz, 'js', 'enem.js'));
const ENEM = window.BQ.enem;
if (ENEM.ANOS_LOCAIS.includes(ano)) {
  console.error(`${ano} vem do caderno do INEP: use python3 ferramentas/resolucoes/preparar.py ${ano}`);
  process.exit(1);
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
const IMAGEM = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const EXTENSOES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp' };
const { execFileSync } = require('child_process');

// Baixa uma figura; devolve o caminho local ou null (quebrada ou indisponível).
const baixadas = new Map();
async function baixar(url, nomeBase) {
  if (baixadas.has(url)) return baixadas.get(url);
  let local = null;
  if (/broken-image/.test(url)) {
    baixadas.set(url, null);
    return null;
  }
  try {
    const resp = await fetch(url);
    const tipo = (resp.headers.get('content-type') || '').split(';')[0].trim();
    if (resp.ok && EXTENSOES[tipo]) {
      local = path.join(pastaImg, nomeBase + EXTENSOES[tipo]);
      fs.writeFileSync(local, Buffer.from(await resp.arrayBuffer()));
      if (tipo === 'image/bmp') { // alternativas em BMP (2013, 2014): converte para PNG, que o leitor de imagens abre
        const png = local.replace(/\.bmp$/, '.png');
        execFileSync('sips', ['-s', 'format', 'png', local, '--out', png], { stdio: 'ignore' });
        fs.unlinkSync(local);
        local = png;
      }
    }
  } catch (e) { /* fica null */ }
  baixadas.set(url, local);
  return local;
}

async function preparar(q) {
  const base = `q${String(q.numero).padStart(3, '0')}${q.idioma ? '-' + q.idioma : ''}`;
  const figuras = [];
  let quebradas = 0;
  let k = 0;
  const figura = async url => {
    const local = await baixar(url, `${base}-${++k}`);
    if (!local) { quebradas++; return '[FIGURA INDISPONÍVEL NA FONTE]'; }
    figuras.push(local);
    return `[FIGURA ${figuras.length}: ${path.basename(local)}]`;
  };
  const trocar = async texto => {
    let saida = '';
    let ultimo = 0;
    for (const m of String(texto || '').matchAll(IMAGEM)) {
      // A API escreve fórmulas como "imagem" .latex com a fórmula no texto alternativo.
      const trecho = /\.latex$/i.test(m[2]) ? `[fórmula: ${m[1]}]` : await figura(m[2]);
      saida += texto.slice(ultimo, m.index) + trecho;
      ultimo = m.index + m[0].length;
    }
    return saida + String(texto || '').slice(ultimo);
  };

  const partes = [await trocar(q.contexto)];
  const noTexto = new Set([...String(q.contexto || '').matchAll(IMAGEM)].map(m => m[2]));
  for (const url of q.arquivos) if (!noTexto.has(url)) partes.push(await figura(url));
  partes.push(await trocar(q.comando));
  for (const a of q.alternativas) {
    partes.push(`(${a.letra}) ${await trocar(a.texto)}${a.arquivo ? ' ' + await figura(a.arquivo) : ''}`);
  }
  return {
    numero: q.numero,
    idioma: q.idioma,
    gabarito: q.gabarito,
    enunciado: partes.filter(p => String(p).trim()).join('\n\n'),
    figuras,
    figuras_indisponiveis: quebradas,
    id: q.id,
  };
}

(async () => {
  for (const area of ENEM.AREAS.map(a => a.id)) {
    const questoes = await ENEM.carregarArea(ano, area);
    const itens = [];
    for (const q of questoes) itens.push(await preparar(q));
    const faltam = [];
    const [ini, fim] = ENEM.faixa(ano, area);
    for (let n = ini; n <= fim; n++) if (!itens.some(i => i.numero === n)) faltam.push(n);
    const estranhos = itens.filter(i => i.id.endsWith(':b')).map(i => i.id); // versões repetidas do mesmo número
    fs.writeFileSync(path.join(destino, `${area}.json`), JSON.stringify(itens.map(({ id, ...i }) => i), null, 1) + '\n');
    console.log(`${area}: ${itens.length} questões, ${itens.reduce((n, i) => n + i.figuras.length, 0)} figuras, ` +
      `${itens.filter(i => i.figuras_indisponiveis).map(i => i.numero).join(',') || 'nenhuma'} com figura indisponível` +
      `${faltam.length ? `; faltam na fonte: ${faltam.join(',')}` : ''}${estranhos.length ? `; REPETIDAS: ${estranhos.join(',')}` : ''}`);
    await esperar(3000); // limite da API: 10 requisições a cada 10 s
  }
  console.log('material em', destino);
})();
