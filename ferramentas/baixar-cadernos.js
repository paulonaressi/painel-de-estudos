// Baixa para provas/ os cadernos do catálogo e registra cada arquivo em provas/manifesto.json
// (url -> arquivo local). Por padrão, só os hospedados nos sites oficiais (Vunesp e Unesp).
// Uso: node ferramentas/baixar-cadernos.js            baixa os oficiais que faltam
//      node ferramentas/baixar-cadernos.js --copias   inclui cópias de terceiros nas edições sem caderno oficial
//      node ferramentas/baixar-cadernos.js --listar   só mostra o que seria baixado e o tamanho
'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pastaProvas = path.join(raiz, 'provas');
const arquivoManifesto = path.join(pastaProvas, 'manifesto.json');
const HOSTS_OFICIAIS = ['documento.vunesp.com.br', 'vestibular.unesp.br'];
// Cópias de terceiros, usadas só onde não há caderno oficial: as do Curso Objetivo e,
// nas edições da Unesp que o Objetivo não tem, as do Foco Medicina.
const HOST_OBJETIVO = 'www.curso-objetivo.br';
const HOST_FOCO = 'focomedicina.com.br';
const UNESP_SO_NO_FOCO = ['2018/2', '2017', '2016', '2015', '2013', '2010'];
const soListar = process.argv.includes('--listar');
const comCopias = process.argv.includes('--copias');

const pesquisa = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'vunesp-pesquisa.json'), 'utf8'));
const manifesto = fs.existsSync(arquivoManifesto) ? JSON.parse(fs.readFileSync(arquivoManifesto, 'utf8')) : {};

const esperar = ms => new Promise(r => setTimeout(r, ms));
const slug = texto => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Um nome de arquivo estável por caderno: provas/<instituição>/<edição>_<rótulo>.pdf
const alvos = [];
const doHost = (ed, host) => (ed.cadernos || []).filter(c => new URL(c.url).host === host);
function cadernosParaBaixar(ed) {
  const oficiais = (ed.cadernos || []).filter(c => HOSTS_OFICIAIS.includes(new URL(c.url).host));
  if (oficiais.length || !comCopias) return oficiais;
  const objetivo = doHost(ed, HOST_OBJETIVO);
  if (objetivo.length) return objetivo;
  return ed.instituicao === 'UNESP' && UNESP_SO_NO_FOCO.includes(ed.edicao) ? doHost(ed, HOST_FOCO) : [];
}

for (const ed of pesquisa.edicoes) {
  for (const cad of cadernosParaBaixar(ed)) {
    const inst = slug(ed.instituicao.split(' ')[0]);
    const nome = `${slug(ed.edicao)}_${slug(cad.rotulo).slice(0, 60)}.pdf`;
    alvos.push({ url: cad.url, arquivo: `provas/${inst}/${nome}`, rotulo: `${ed.instituicao} ${ed.edicao} — ${cad.rotulo}` });
  }
}

async function tamanho(url) {
  const controle = new AbortController();
  const resp = await fetch(url, { signal: controle.signal });
  const bytes = +resp.headers.get('content-length') || 0;
  const tipo = resp.headers.get('content-type') || '';
  controle.abort();
  return { status: resp.status, bytes, tipo };
}

async function baixar(alvo) {
  const resp = await fetch(alvo.url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const dados = Buffer.from(await resp.arrayBuffer());
  if (dados.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('a resposta não é um PDF');
  const destino = path.join(raiz, alvo.arquivo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, dados);
  return dados.length;
}

(async () => {
  let total = 0;
  let feitos = 0;
  const falhas = [];

  for (const alvo of alvos) {
    const jaTem = manifesto[alvo.url] && fs.existsSync(path.join(raiz, manifesto[alvo.url].arquivo));
    try {
      if (soListar) {
        const t = await tamanho(alvo.url);
        total += t.bytes;
        console.log(`${t.status} ${(t.bytes / 1e6).toFixed(1).padStart(5)} MB  ${alvo.arquivo}${jaTem ? '  (já baixado)' : ''}`);
        if (t.status !== 200 || !/pdf/.test(t.tipo)) falhas.push(`${alvo.rotulo}: ${t.status} ${t.tipo}`);
      } else if (!jaTem) {
        const bytes = await baixar(alvo);
        manifesto[alvo.url] = { arquivo: alvo.arquivo, bytes };
        fs.mkdirSync(pastaProvas, { recursive: true });
        fs.writeFileSync(arquivoManifesto, JSON.stringify(manifesto, null, 1));
        total += bytes;
        feitos++;
        console.log(`ok ${(bytes / 1e6).toFixed(1).padStart(5)} MB  ${alvo.arquivo}`);
      }
    } catch (erro) {
      falhas.push(`${alvo.rotulo}: ${erro.message}`);
      console.log(`FALHOU  ${alvo.arquivo}: ${erro.message}`);
    }
    await esperar(350);
  }

  console.log(soListar
    ? `\n${alvos.length} cadernos,${(total / 1e6).toFixed(1)} MB no total`
    : `\n${feitos} baixados agora (${(total / 1e6).toFixed(1)} MB); ${Object.keys(manifesto).length} no manifesto`);
  if (falhas.length) console.log(`${falhas.length} falhas:\n - ${falhas.join('\n - ')}`);
})();
