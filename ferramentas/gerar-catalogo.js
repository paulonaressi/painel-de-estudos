// Gera data/vunesp-catalogo.js (o que a página carrega) a partir de data/vunesp-pesquisa.json
// (o levantamento bruto, com status HTTP e observações de cada link).
// Uso: node ferramentas/gerar-catalogo.js
'use strict';

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pesquisa = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'vunesp-pesquisa.json'), 'utf8'));

// Cadernos já baixados (provas/manifesto.json) e com as questões localizadas (data/questoes/...).
const arquivoManifesto = path.join(raiz, 'provas', 'manifesto.json');
const manifesto = fs.existsSync(arquivoManifesto) ? JSON.parse(fs.readFileSync(arquivoManifesto, 'utf8')) : {};

// Devolve uma entrada por "parte" do arquivo: alguns PDFs trazem duas provas com a numeração
// recomeçando (Prova I e Prova II). Arquivo sem questões localizadas, ou com buracos na
// numeração (layout que o extrator não entende), fica sem cópia local e abre como PDF inteiro.
function copiasLocais(grupo) {
  for (const c of grupo) {
    const item = manifesto[c.url];
    if (!item || !item.indice || !fs.existsSync(path.join(raiz, item.indice))) continue;
    const indice = JSON.parse(fs.readFileSync(path.join(raiz, item.indice), 'utf8'));
    const partes = [...new Set(indice.questoes.map(q => q.parte || 0))].sort((a, b) => a - b);
    const locais = partes.map(parte => {
      const numeros = indice.questoes.filter(q => (q.parte || 0) === parte).map(q => q.n).sort((a, b) => a - b);
      return {
        pdf: item.arquivo,
        indice: item.indice,
        fonte: nomeDaFonte(c),          // de onde veio o arquivo aberto na tela (a cópia, quando o oficial não baixou)
        oficial: c.host_oficial === true,
        parte,
        numeros,
        redacao: !!indice.redacao && (indice.redacao.parte || 0) === parte,
      };
    });
    const continuas = l => l.numeros[l.numeros.length - 1] - l.numeros[0] + 1 === l.numeros.length;
    const altura = q => q.recortes.reduce((soma, r) => soma + r[4] - r[2], 0);
    const soTarja = parte => indice.questoes.some(q => (q.parte || 0) === parte && altura(q) < 25); // sobrou só o marcador "Questão N"
    const boa = l => continuas(l) && !soTarja(l.parte);
    // uma parte idêntica a outra (Famema 2024: o arquivo traz a Prova I duas vezes) não se repete
    const assinatura = l => indice.questoes.filter(q => (q.parte || 0) === l.parte).map(q => q.texto.slice(0, 80)).join('|');
    if (locais.length && locais.every(boa)) {
      const vistas = new Set();
      return locais.filter(l => !vistas.has(assinatura(l)) && vistas.add(assinatura(l)));
    }
    // Arquivo com várias partes e alguma com defeito: ficam as partes boas, também sem repetir.
    if (locais.length > 1) {
      const vistas = new Set();
      const boas = locais.filter(l => boa(l) && l.numeros.length >= 5) // parte com 1 ou 2 "questões" é ruído
        .filter(l => !vistas.has(assinatura(l)) && vistas.add(assinatura(l)));
      if (boas.length) return boas;
    }
  }
  return [];
}

// Unesp com as questões numeradas de ponta a ponta na 2ª fase (2010 em diante). Até 2009 cada dia
// recomeçava do 1 e o 2º dia tinha versões por área: aí vale a numeração de cada caderno, como nas
// outras instituições (o levantamento marca essas edições com numeracao_por_caderno).
const unespContinua = ed => ed.instituicao === 'UNESP' && !ed.numeracao_por_caderno;

// Cópias do mesmo caderno têm a mesma numeração e os mesmos campos; versões diferentes da prova
// (ex.: por área de carreira) se distinguem pelo campo "versao" do levantamento.
const chaveDoCaderno = c => `${c.questoes || ''}|${[...(c.areas || [])].sort().join(',')}|${c.versao || ''}`;

const NOMES_AREA = {
  humanas: 'Ciências Humanas',
  'natureza-matematica': 'Natureza e Matemática',
  linguagens: 'Linguagens',
  redacao: 'Redação',
};
const ORDEM_AREA = Object.keys(NOMES_AREA);

// Numeração das questões por campo na 2ª fase da Unesp, conforme o formato da edição.
const FAIXAS_UNESP = {
  discursiva: { humanas: '1-12', 'natureza-matematica': '13-24', linguagens: '25-36' },
  objetiva: { linguagens: '1-20', humanas: '21-40', 'natureza-matematica': '41-60' },
};

function nomeDaFonte(caderno) {
  const espelho = /\(espelho ([^)]+)\)/.exec(caderno.rotulo);
  if (espelho) return espelho[1];
  const host = new URL(caderno.url).host;
  if (host === 'documento.vunesp.com.br') return 'Vunesp';
  if (host === 'vestibular.unesp.br') return 'Unesp';
  return host;
}

function rotuloCurto(edicao, grupo) {
  const principal = grupo[0];
  const base = principal.rotulo
    .replace(/\s*\(espelho [^)]+\)/, '')
    .replace(/\(([^,;)]+)[,;][^)]*\)/g, '($1)')
    .trim();
  if (!unespContinua(edicao)) return base;

  const areas = ORDEM_AREA.filter(a => (principal.areas || []).includes(a));
  const conteudo = areas.filter(a => a !== 'redacao');
  if (!conteudo.length) return base;
  if (conteudo.length === 3) return 'Prova completa';
  const dia = /^([12]º dia)/.exec(base);
  return (dia ? dia[1] + ' · ' : '') + areas.map(a => NOMES_AREA[a]).join(' + ');
}

// Junta num mesmo caderno as cópias (oficial e espelhos) que cobrem as mesmas questões.
function agruparCadernos(edicao) {
  const grupos = new Map();
  for (const c of edicao.cadernos || []) {
    let chave = chaveDoCaderno(c);
    // Dois cadernos oficiais com a mesma numeração são provas diferentes (ex.: reaplicação), não cópias.
    if (c.host_oficial && (grupos.get(chave) || []).some(o => o.host_oficial)) chave += `|${c.rotulo}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }

  const oficialPrimeiro = (a, b) => (b.host_oficial === true) - (a.host_oficial === true);
  const lista = [...grupos.values()].map(grupo => grupo.sort(oficialPrimeiro));
  lista.sort((a, b) => oficialPrimeiro(a[0], b[0]));

  if (unespContinua(edicao)) {
    // Na Unesp a numeração é contínua: ordena pelo número da questão e deixa por último
    // o arquivo que cobre a prova inteira.
    const faixa = grupo => { const m = /(\d+)\D+(\d+)/.exec(grupo[0].questoes || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
    const contem = (a, b) => { const [ai, af] = faixa(a); const [bi, bf] = faixa(b); return ai <= bi && af >= bf && af - ai > bf - bi; };
    const abrangente = new Map(lista.map(g => [g, lista.some(o => o !== g && contem(g, o))]));
    lista.sort((a, b) => abrangente.get(a) - abrangente.get(b) || faixa(a)[0] - faixa(b)[0]);
  }

  return lista.flatMap(grupo => {
    const caderno = {
      rotulo: rotuloCurto(edicao, grupo),
      areas: ORDEM_AREA.filter(a => (grupo[0].areas || []).includes(a)),
      questoes: grupo[0].questoes || null,
      local: null,
      fontes: grupo.map(c => ({
        nome: nomeDaFonte(c),
        url: c.url,
        oficial: c.host_oficial === true,
        embutir: /^https:\/\//.test(c.url) && !c.x_frame_options && !c.csp_frame_ancestors,
      })),
    };
    const locais = copiasLocais(grupo);
    if (locais.length < 2) return [{ ...caderno, local: locais[0] || null }];
    // um caderno por parte, cada um com a sua numeração; o levantamento pode dar nome e campos a cada parte
    const nomes = grupo[0].partes || [];
    return locais.map((local, i) => {
      const info = nomes[local.parte];
      const faixa = `questões ${local.numeros[0]} a ${local.numeros[local.numeros.length - 1]}`;
      return {
        ...caderno,
        rotulo: info ? `${caderno.rotulo} · ${info.nome}` : `${caderno.rotulo} · parte ${i + 1} (${faixa})`,
        areas: info && info.areas ? ORDEM_AREA.filter(a => info.areas.includes(a)) : (local.redacao ? ['redacao'] : []),
        local,
      };
    });
  });
}

const numerosDaFaixa = texto => {
  const m = /(\d+)\D+(\d+)/.exec(texto || '');
  return m ? Array.from({ length: m[2] - m[1] + 1 }, (_, i) => +m[1] + i) : [];
};

// Estrutura fixa dos cadernos fora da Unesp, por instituição e quantidade de questões (é assim que o
// caderno é reconhecido; cada prova recomeça do 1, então tudo vale só dentro do caderno). Cada bloco
// tem um campo e, quando é de uma disciplina só, a disciplina: aí a tela não estima, usa a daqui.
// Conferido no texto dos cadernos (início e fim de cada bloco em pelo menos dois anos); as capas não
// trazem essa divisão. Blocos sem disciplina (Português/Literatura, Humanas, interdisciplinares)
// continuam com o classificador, restrito ao campo.
const NM = 'natureza-matematica';
const B = (faixa, area, disciplina = null) => ({ faixa, area, disciplina });
const ESTRUTURAS = {
  FAMEMA: { // 2018–2026
    8: { rotulo: 'Prova I (discursiva) · Química e Biologia', blocos: [B('1-4', NM, 'quimica'), B('5-8', NM, 'biologia')] },
    40: {
      rotulo: 'Prova II (objetiva) e redação',
      blocos: [B('1-10', 'linguagens'), B('11-20', NM, 'matematica'), B('21-30', 'humanas'), B('31-35', 'linguagens', 'ingles'), B('36-40', NM, 'fisica')],
    },
  },
  UNIFESP: { // 1º dia: Português + Inglês; 2º dia: 5 de cada (Biologia, Química, Física, Matemática)
    25: { blocos: [B('1-15', 'linguagens'), B('16-25', 'linguagens', 'ingles')] },
    45: { blocos: [B('1-30', 'linguagens'), B('31-45', 'linguagens', 'ingles')] }, // 2018 e 2019
    20: { blocos: [B('1-5', NM, 'biologia'), B('6-10', NM, 'quimica'), B('11-15', NM, 'fisica'), B('16-20', NM, 'matematica')] },
  },
  'FCMSCSP (Santa Casa de SP)': { // Conhecimentos Específicos (20) e Gerais (80)
    80: { // Conhecimentos Gerais (objetiva), 2022 em diante
      blocos: [B('1-10', 'linguagens'), B('11-20', 'linguagens', 'ingles'), B('21-30', 'humanas', 'historia'), B('31-40', 'humanas', 'geografia'),
        B('41-50', NM, 'biologia'), B('51-60', NM, 'quimica'), B('61-70', NM, 'fisica'), B('71-80', NM, 'matematica')],
    },
    20: { blocos: [B('1-8', NM, 'biologia'), B('9-12', NM, 'quimica'), B('13-16', NM, 'fisica'), B('17-20', 'linguagens')] },
  },
  FAMERP: { // 2º dia, Conhecimentos Específicos (20); 1º dia, Conhecimentos Gerais (80)
    80: { // Conhecimentos Gerais (objetiva), 2022 em diante
      blocos: [B('1-10', 'linguagens'), B('11-20', 'linguagens', 'ingles'), B('21-30', 'humanas', 'historia'), B('31-40', 'humanas', 'geografia'),
        B('41-50', NM, 'biologia'), B('51-60', NM, 'quimica'), B('61-70', NM, 'fisica'), B('71-80', NM, 'matematica')],
    },
    20: { blocos: [B('1-8', NM, 'biologia'), B('9-14', NM, 'quimica'), B('15-20', NM, 'fisica')] },
  },
  'FICSAE (Albert Einstein)': {
    50: { // Prova I (só nos arquivos únicos do Objetivo, 2019 e 2020); 41–50: matemática em contexto interdisciplinar
      rotulo: 'Prova I (objetiva)',
      blocos: [B('1-10', 'linguagens'), B('11-15', 'linguagens', 'ingles'), B('16-25', 'humanas'), B('26-30', NM, 'biologia'),
        B('31-35', NM, 'quimica'), B('36-40', NM, 'fisica'), B('41-50', NM)],
    },
    5: { // Prova II; a 4 é de Matemática de 2024 em diante, antes variava
      rotulo: 'Prova II (discursiva) e redação',
      blocos: [B('1', NM, 'biologia'), B('2', NM, 'quimica'), B('3', NM, 'fisica'), B('4', NM), B('5', 'linguagens', 'ingles')],
    },
  },
  FMJ: { // Prova I (discursiva)
    8: { blocos: [B('1-4', NM, 'quimica'), B('5-8', NM, 'biologia')] },
    20: { blocos: [B('1-10', NM, 'quimica'), B('11-20', NM, 'biologia')] }, // 2024
    40: { // Prova II (objetiva), 2025 em diante: mesma divisão da Prova II da Famema
      blocos: [B('1-10', 'linguagens'), B('11-20', NM, 'matematica'), B('21-30', 'humanas'), B('31-35', 'linguagens', 'ingles'), B('36-40', NM, 'fisica')],
    },
    60: { // Prova II de 2024
      blocos: [B('1-10', 'linguagens'), B('11-20', NM, 'matematica'), B('21-30', 'humanas', 'geografia'), B('31-40', 'humanas', 'historia'),
        B('41-50', 'linguagens', 'ingles'), B('51-60', NM, 'fisica')],
    },
  },
  UNESP: { // só a 1ª fase tem 90 questões (a 2ª usa faixasDaUnesp); dentro de cada área os blocos variam de ano a ano
    90: { blocos: [B('1-20', 'linguagens'), B('21-30', 'linguagens', 'ingles'), B('31-60', 'humanas'), B('61-90', NM)] },
  },
};

// Anos em que a divisão foi conferida; antes disso (Famema 2016–2017, Famerp 2015–2017, Unifesp até 2017,
// com cadernos de 20, 25 e 45 questões de outra composição) a tela continua estimando.
const ESTRUTURA_DESDE = { FAMEMA: 2018, FAMERP: 2019, UNIFESP: 2018 };

function aplicarEstrutura(ed, cadernos) {
  const porTamanho = ESTRUTURAS[ed.instituicao];
  if (!porTamanho || ed.ano < (ESTRUTURA_DESDE[ed.instituicao] || 0)) return cadernos;
  const juntar = (mapa, chave, faixa) => { if (chave) mapa[chave] = mapa[chave] ? `${mapa[chave]},${faixa}` : faixa; };
  for (const c of cadernos) {
    const tipo = c.local && porTamanho[c.local.numeros.length];
    if (!tipo) continue;
    const faixas = {};
    const disciplinas = {};
    for (const b of tipo.blocos) { juntar(faixas, b.area, b.faixa); juntar(disciplinas, b.disciplina, b.faixa); }
    if (tipo.rotulo) c.rotulo = c.local.redacao ? tipo.rotulo : tipo.rotulo.replace(' e redação', '');
    c.areas = ORDEM_AREA.filter(a => (a === 'redacao' ? c.local.redacao : a in faixas));
    c.faixas = faixas;
    c.disciplinas = disciplinas;
  }
  return cadernos;
}

// Numeração de cada campo na Unesp. Quando há cadernos separados por campo com as questões já
// localizadas, vale o que está neles; senão, o padrão. Sem evidência, não se informa faixa.
function faixasDaUnesp(ed, cadernos) {
  const medidas = {};
  for (const c of cadernos) {
    const areas = c.areas.filter(a => a !== 'redacao');
    if (areas.length !== 1 || !c.local || !c.local.numeros.length) continue;
    medidas[areas[0]] = `${c.local.numeros[0]}-${c.local.numeros[c.local.numeros.length - 1]}`;
  }
  // completa com o padrão os campos não medidos, desde que não colidam com o que foi medido
  // (as capas dos cadernos confirmam essa ordem de 2011 em diante; em 2010 era outra)
  const padrao = ed.ano >= 2011 ? FAIXAS_UNESP[ed.formato] || {} : {};
  const ocupados = new Set(Object.values(medidas).flatMap(numerosDaFaixa));
  for (const [campo, faixa] of Object.entries(padrao)) {
    if (!medidas[campo] && !numerosDaFaixa(faixa).some(n => ocupados.has(n))) medidas[campo] = faixa;
  }
  return Object.keys(medidas).length ? medidas : null;
}

const link = item => ({ fonte: item.fonte, url: item.url });

// Com as questões de um arquivo já localizadas, as outras cópias das mesmas questões só poluem
// a tela; ficam apenas os cadernos que cobrem questões ainda não disponíveis localmente.
function enxugar(ed, cadernos) {
  const locais = cadernos.filter(c => c.local);
  if (!locais.length) return cadernos;
  const cobertas = new Set(locais.flatMap(c => c.local.numeros));
  const restantes = cadernos.filter(c => {
    if (c.local) return false;
    const numeros = numerosDaFaixa(c.questoes);
    return unespContinua(ed) && numeros.length > 0 && !numeros.every(n => cobertas.has(n));
  });
  if (unespContinua(ed)) {
    // arquivo que não traz o que o rótulo do catálogo promete passa a se chamar pelo que contém
    const total = ed.formato === 'objetiva' ? 60 : 36;
    for (const c of locais) {
      const n = c.local.numeros;
      const previsto = numerosDaFaixa(c.questoes);
      const umCampo = c.areas.filter(a => a !== 'redacao').length === 1; // caderno de um campo só: vale o rótulo
      if (umCampo || (previsto.length === n.length && previsto[0] === n[0])) continue;
      c.rotulo = n.length === total ? 'Prova completa' : `Questões ${n[0]} a ${n[n.length - 1]}`;
      if (n.length !== total) c.areas = c.areas.filter(a => a === 'redacao' && c.local.redacao);
    }
    const inicio = c => (c.local ? c.local.numeros[0] : numerosDaFaixa(c.questoes)[0]) || 0;
    return locais.concat(restantes).sort((x, y) => inicio(x) - inicio(y));
  }
  return locais.concat(restantes);
}

const edicoes = pesquisa.edicoes.map(ed => {
  const saida = {
    instituicao: ed.instituicao,
    edicao: ed.edicao,
    ano: ed.ano,
    fase: ed.fase,
    formato: ed.formato,
    estrutura: ed.estrutura,
    cadernos: aplicarEstrutura(ed, enxugar(ed, agruparCadernos(ed))),
    resolucoes: (ed.resolucoes || []).map(link),
    oficiais: (ed.respostas_esperadas || []).map(link),
  };
  if (unespContinua(ed)) {
    saida.numeracao_unica = true; // as questões são numeradas de ponta a ponta, mesmo em cadernos separados
    // a 1ª fase (90 objetivas de Conhecimentos Gerais) não segue a numeração por campo da 2ª
    const faixas = ed.fase === '1ª fase' ? null : faixasDaUnesp(ed, saida.cadernos);
    if (faixas) saida.faixas = faixas;
  }
  return saida;
});

const cabecalho = '// Gerado por ferramentas/gerar-catalogo.js a partir de data/vunesp-pesquisa.json. Não edite à mão.\n';
const corpo = `window.VUNESP_CATALOGO = ${JSON.stringify({ gerado_em: pesquisa.gerado_em, edicoes }, null, 1)};\n`;
fs.writeFileSync(path.join(raiz, 'data', 'vunesp-catalogo.js'), cabecalho + corpo, 'utf8');

const cadernos = edicoes.flatMap(e => e.cadernos);
const locais = cadernos.filter(c => c.local);
console.log(`${edicoes.length} edições, ${cadernos.length} cadernos (${locais.length} com questões extraídas, ` +
  `${locais.reduce((n, c) => n + c.local.numeros.length, 0)} questões) -> data/vunesp-catalogo.js`);
