// Fontes do ENEM: API pública enem.dev (provas de 2009 a 2023) e, para os anos que ela não cobre,
// os cadernos do INEP em provas/enem, com as questões localizadas por ferramentas/extrair-questoes.py.
(function () {
  'use strict';

  const BQ = window.BQ;
  const API = 'https://api.enem.dev/v1';
  const POR_AREA = 45;

  const AREAS = [
    { id: 'linguagens', nome: 'Linguagens', nomeLongo: 'Linguagens, Códigos e suas Tecnologias', cor: '#b0563a' },
    { id: 'humanas', nome: 'Ciências Humanas', nomeLongo: 'Ciências Humanas e suas Tecnologias', cor: '#b08a2e' },
    { id: 'natureza', nome: 'Ciências da Natureza', nomeLongo: 'Ciências da Natureza e suas Tecnologias', cor: '#2f8a63' },
    { id: 'matematica', nome: 'Matemática', nomeLongo: 'Matemática e suas Tecnologias', cor: '#3f6fb5' },
  ];

  const IDIOMAS = { ingles: 'Inglês', espanhol: 'Espanhol' };
  const ANOS_LOCAIS = [2025, 2024]; // data/enem/<ano>.json
  const ANOS_PADRAO = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009];

  // A área vem da posição da questão na prova. O campo "discipline" da API tem
  // rótulos errados em todos os anos (dezenas de questões caem em ciencias-humanas).
  function ordemAreas(ano) {
    if (ano >= 2017) return ['linguagens', 'humanas', 'natureza', 'matematica'];
    if (ano >= 2010) return ['humanas', 'natureza', 'linguagens', 'matematica'];
    return ['natureza', 'humanas', 'linguagens', 'matematica'];
  }

  function faixa(ano, area) {
    const i = ordemAreas(ano).indexOf(area);
    return [i * POR_AREA + 1, (i + 1) * POR_AREA];
  }

  function areaDoNumero(ano, numero) {
    return ordemAreas(ano)[Math.floor((numero - 1) / POR_AREA)] || null;
  }

  const esperar = ms => new Promise(r => setTimeout(r, ms));

  // A API limita a 10 requisições a cada 10 s; em caso de 429, espera e tenta de novo.
  async function buscarJson(url) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      let resp;
      try { resp = await fetch(url); }
      catch (e) { throw new Error('Não foi possível falar com a API do ENEM. Verifique a conexão.'); }
      if (resp.status === 429) { await esperar(2500 * (tentativa + 1)); continue; }
      if (!resp.ok) {
        const erro = new Error(`A API do ENEM respondeu com erro ${resp.status}.`);
        erro.status = resp.status;
        throw erro;
      }
      return resp.json();
    }
    throw new Error('A API do ENEM está limitando as requisições. Tente de novo em alguns segundos.');
  }

  // A API responde 400 quando a prova daquele ano não tem o idioma pedido (ex.: 2009, inglês em 2011).
  async function buscarIdioma(url, idioma) {
    try {
      const dados = await buscarJson(`${url}&language=${idioma}`);
      return (dados.questions || []).filter(q => q.language === idioma);
    } catch (erro) {
      if (erro.status === 400 || erro.status === 404) return [];
      throw erro;
    }
  }

  // Palavras muito frequentes em cada língua e ausentes do português.
  function adivinharIdioma(q) {
    const texto = ` ${q.context || q.alternativesIntroduction || ''} `.toLowerCase().replace(/[^a-záéíóúüñ]+/g, '  ');
    const contar = palavras => palavras.reduce((n, p) => n + texto.split(` ${p} `).length - 1, 0);
    const ingles = contar(['the', 'and', 'of', 'is', 'to', 'in', 'it', 'you']);
    const espanhol = contar(['el', 'los', 'las', 'y', 'en', 'del', 'una', 'con']);
    if (ingles === espanhol) return null;
    return ingles > espanhol ? 'ingles' : 'espanhol';
  }

  function normalizar(q, ano, area) {
    const certa = q.correctAlternative || ((q.alternatives || []).find(a => a.isCorrect) || {}).letter || null;
    return {
      id: `enem:${ano}:${q.index}${q.language ? ':' + q.language : ''}`,
      ano,
      numero: q.index,
      area,
      idioma: q.language || null,
      contexto: q.context || '',
      comando: q.alternativesIntroduction || '',
      arquivos: q.files || [],
      alternativas: (q.alternatives || []).map(a => ({ letra: a.letter, texto: a.text || '', arquivo: a.file || null })),
      gabarito: certa,
    };
  }

  const locais = new Map();
  function carregarLocal(ano) {
    if (!locais.has(ano)) {
      const promessa = fetch(`data/enem/${ano}.json`).then(r => {
        if (!r.ok) throw new Error(`Não encontrei as questões do ENEM ${ano} (data/enem/${ano}.json).`);
        return r.json();
      });
      promessa.catch(() => locais.delete(ano));
      locais.set(ano, promessa);
    }
    return locais.get(ano);
  }

  // Questões vindas do PDF: o enunciado é recortado do caderno, então não há texto por alternativa.
  async function carregarAreaLocal(ano, area) {
    const dados = await carregarLocal(ano);
    return dados.questoes.filter(q => q.area === area).map(q => ({
      id: `enem:${ano}:${q.numero}${q.idioma ? ':' + q.idioma : ''}`,
      ano,
      numero: q.numero,
      area,
      idioma: q.idioma || null,
      contexto: '',
      comando: '',
      arquivos: [],
      alternativas: ['A', 'B', 'C', 'D', 'E'].map(letra => ({ letra, texto: '', arquivo: null })),
      gabarito: q.gabarito || null,
      pdf: q.pdf,
      apoio: q.apoio || [],
      recortes: q.recortes,
      texto: q.texto || '',
    }));
  }

  async function carregarArea(ano, area) {
    if (ANOS_LOCAIS.includes(ano)) return carregarAreaLocal(ano, area);
    const chave = `enem:v2:${ano}:${area}`;
    const emCache = await BQ.cache.get(chave);
    if (emCache) return emCache;

    const [ini, fim] = faixa(ano, area);
    // O offset da API é por número da questão, e o intervalo devolvido inclui as duas pontas;
    // pedir uma a mais de cada lado e filtrar aqui cobre as duas leituras possíveis.
    const base = `${API}/exams/${ano}/questions?offset=${ini - 1}`;
    let brutas = (await buscarJson(`${base}&limit=46`)).questions || [];
    if (area === 'linguagens') {
      // Sem "language" a API devolve só um dos idiomas nas 5 questões de língua estrangeira.
      const idiomas = await idiomasDoAno(ano);
      const porIdioma = await Promise.all(idiomas.map(i => buscarIdioma(`${base}&limit=6`, i)));
      brutas = brutas.concat(...porIdioma);
    }

    // As requisições se sobrepõem: descarta repetições idênticas, mas mantém versões diferentes do mesmo número.
    const assinaturas = new Set();
    const unicas = [];
    for (const q of brutas) {
      if (q.index < ini || q.index > fim) continue;
      const assinatura = [q.index, q.language, q.context, q.alternativesIntroduction,
        (q.alternatives || []).map(a => a.text || a.file).join('|')].join('\u0001');
      if (assinaturas.has(assinatura)) continue;
      assinaturas.add(assinatura);
      unicas.push(q);
    }

    // Em 2011 a fonte traz as duas versões de língua estrangeira sem dizer qual é qual.
    const semIdioma = new Map();
    unicas.filter(q => !q.language).forEach(q => semIdioma.set(q.index, (semIdioma.get(q.index) || []).concat(q)));
    semIdioma.forEach(grupo => { if (grupo.length > 1) grupo.forEach(q => { q.language = adivinharIdioma(q); }); });

    const ids = new Set();
    const questoes = unicas.map(q => {
      const n = normalizar(q, ano, area);
      while (ids.has(n.id)) n.id += ':b';
      ids.add(n.id);
      return n;
    });
    questoes.sort((a, b) => a.numero - b.numero || String(a.idioma).localeCompare(String(b.idioma)));

    if (questoes.length) await BQ.cache.set(chave, questoes);
    return questoes;
  }

  // Resoluções comentadas: data/resolucoes/indice.json diz para quais anos existem.
  let indiceResolucoes = null;
  const resolucoes = new Map();
  function anosComResolucao() {
    if (!indiceResolucoes) {
      indiceResolucoes = fetch('data/resolucoes/indice.json')
        .then(r => (r.ok ? r.json() : {}))
        .then(indice => indice.enem || [], () => []);
    }
    return indiceResolucoes;
  }

  // { questoes: { '91': { resolucao, confianca, pendencia }, '1:ingles': {...} } } ou null se o ano não tem.
  async function carregarResolucoes(ano) {
    if (!(await anosComResolucao()).includes(ano)) return null;
    if (!resolucoes.has(ano)) {
      resolucoes.set(ano, fetch(`data/resolucoes/enem-${ano}.json`).then(r => (r.ok ? r.json() : null), () => null));
    }
    return resolucoes.get(ano);
  }

  let provasPromise = null;
  function listarProvas() {
    if (!provasPromise) {
      provasPromise = (async () => {
        const chave = 'enem:v2:provas';
        const emCache = await BQ.cache.get(chave);
        if (emCache) return emCache;
        const provas = (await buscarJson(`${API}/exams`))
          .map(p => ({ ano: p.year, idiomas: (p.languages || []).map(l => l.value) }))
          .filter(p => Number.isFinite(p.ano))
          .sort((a, b) => b.ano - a.ano);
        if (provas.length) await BQ.cache.set(chave, provas);
        return provas;
      })();
      provasPromise.catch(() => { provasPromise = null; });
    }
    return provasPromise;
  }

  async function listarAnos() {
    const provas = await listarProvas();
    const anos = new Set(ANOS_LOCAIS.concat(provas.map(p => p.ano)));
    return provas.length ? [...anos].sort((a, b) => b - a) : ANOS_PADRAO;
  }

  async function idiomasDoAno(ano) {
    try {
      const prova = (await listarProvas()).find(p => p.ano === ano);
      if (prova) return prova.idiomas;
    } catch (e) { /* sem a lista de provas, tenta os dois idiomas */ }
    return Object.keys(IDIOMAS);
  }

  BQ.enem = { AREAS, IDIOMAS, ANOS_PADRAO, ANOS_LOCAIS, POR_AREA, anosComResolucao, carregarResolucoes, faixa, areaDoNumero, carregarArea, listarAnos };
})();
