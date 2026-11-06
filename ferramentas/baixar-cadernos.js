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
// Cadernos que só o Foco tem, nas edições em que o Objetivo cobre o resto (autorizado em 06/11/2026).
const FOCO_LACUNAS = { '2011': ['25-36'], '2010/2': ['1-12', '13-24'] };
const soListar = process.argv.includes('--listar');
const comCopias = process.argv.includes('--copias');

const pesquisa = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'vunesp-pesquisa.json'), 'utf8'));
const manifesto = fs.existsSync(arquivoManifesto) ? JSON.parse(fs.readFileSync(arquivoManifesto, 'utf8')) : {};

const esperar = ms => new Promise(r => setTimeout(r, ms));
const slug = texto => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Um alvo por caderno (mesmas questões e campos), com as fontes em ordem de preferência:
// oficial; com --copias, o Objetivo e, onde autorizado, o Foco. Baixa só a primeira que funcionar
// (o site da Vunesp passou a recusar downloads automatizados em 11/2026; aí vale a cópia).
// Nome de arquivo estável por fonte: provas/<instituição>/<edição>_<rótulo>.pdf
const alvos = [];
const hostDe = c => new URL(c.url).host;
const ehOficial = c => HOSTS_OFICIAIS.includes(hostDe(c));

function fontesPermitidas(ed, grupo) {
  const oficiais = grupo.filter(ehOficial);
  if (!comCopias) return oficiais;
  const objetivo = grupo.filter(c => hostDe(c) === HOST_OBJETIVO);
  const focoLiberado = ed.instituicao === 'UNESP' &&
    (UNESP_SO_NO_FOCO.includes(ed.edicao) || (FOCO_LACUNAS[ed.edicao] || []).includes(grupo[0].questoes));
  const foco = focoLiberado ? grupo.filter(c => hostDe(c) === HOST_FOCO) : [];
  return [...oficiais, ...objetivo, ...foco];
}

for (const ed of pesquisa.edicoes) {
  const grupos = new Map();
  for (const c of ed.cadernos || []) {
    const chave = `${c.questoes || ''}|${[...(c.areas || [])].sort().join(',')}|${c.versao || ''}`; // como em gerar-catalogo.js
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }
  const temOficial = (ed.cadernos || []).some(ehOficial);
  for (const grupo of grupos.values()) {
    // Edição com caderno oficial: as cópias só entram como reserva do oficial correspondente.
    if (temOficial && !grupo.some(ehOficial)) continue;
    const fontes = fontesPermitidas(ed, grupo);
    // Sem oficial e sem --copias não há o que baixar; sem oficial, o Objetivo de um grupo sem
    // o Foco liberado basta; cada grupo independe dos outros.
    if (!fontes.length) continue;
    const inst = slug(ed.instituicao.split(' ')[0]);
    alvos.push({
      rotulo: `${ed.instituicao} ${ed.edicao} — ${fontes[0].rotulo}`,
      fontes: fontes.map(cad => ({ url: cad.url, arquivo: `provas/${inst}/${slug(ed.edicao)}_${slug(cad.rotulo).slice(0, 60)}.pdf` })),
    });
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

  const baixado = f => manifesto[f.url] && fs.existsSync(path.join(raiz, manifesto[f.url].arquivo));
  for (const alvo of alvos) {
    const jaTem = alvo.fontes.some(baixado);
    if (soListar) {
      const f = alvo.fontes[0];
      try {
        const t = await tamanho(f.url);
        total += t.bytes;
        console.log(`${t.status} ${(t.bytes / 1e6).toFixed(1).padStart(5)} MB  ${f.arquivo}${jaTem ? '  (já baixado)' : ''}`);
        if (t.status !== 200 || !/pdf/.test(t.tipo)) falhas.push(`${alvo.rotulo}: ${t.status} ${t.tipo}`);
      } catch (erro) { falhas.push(`${alvo.rotulo}: ${erro.message}`); }
      await esperar(350);
      continue;
    }
    if (jaTem) continue;
    const erros = [];
    for (const f of alvo.fontes) {
      try {
        const bytes = await baixar(f);
        manifesto[f.url] = { arquivo: f.arquivo, bytes };
        fs.mkdirSync(pastaProvas, { recursive: true });
        fs.writeFileSync(arquivoManifesto, JSON.stringify(manifesto, null, 1));
        total += bytes;
        feitos++;
        console.log(`ok ${(bytes / 1e6).toFixed(1).padStart(5)} MB  ${f.arquivo}${erros.length ? '  (reserva)' : ''}`);
        erros.length = 0;
        break;
      } catch (erro) {
        erros.push(`${new URL(f.url).host}: ${erro.message}`);
      } finally {
        await esperar(350);
      }
    }
    if (erros.length) {
      falhas.push(`${alvo.rotulo}: ${erros.join('; ')}`);
      console.log(`FALHOU  ${alvo.rotulo}: ${erros.join('; ')}`);
    }
  }

  console.log(soListar
    ? `\n${alvos.length} cadernos,${(total / 1e6).toFixed(1)} MB no total`
    : `\n${feitos} baixados agora (${(total / 1e6).toFixed(1)} MB); ${Object.keys(manifesto).length} no manifesto`);
  if (falhas.length) console.log(`${falhas.length} falhas:\n - ${falhas.join('\n - ')}`);
})();
