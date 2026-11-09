// Interface: campos à esquerda, enunciado ao centro, resposta e resolução à direita.
(function () {
  'use strict';

  const BQ = window.BQ;
  const { h, md, store } = BQ;
  const ENEM = BQ.enem;
  const CATALOGO = (window.VUNESP_CATALOGO && window.VUNESP_CATALOGO.edicoes) || [];

  const CAMPOS_VUNESP = [
    { id: 'todos', nome: 'Todos os campos', cor: '#8a8474' },
    { id: 'linguagens', nome: 'Linguagens', cor: '#b0563a' },
    { id: 'humanas', nome: 'Ciências Humanas', cor: '#b08a2e' },
    { id: 'natureza-matematica', nome: 'Natureza e Matemática', cor: '#2f8a63' },
    { id: 'redacao', nome: 'Redação', cor: '#3f6fb5' },
  ];

  const ICONES = {
    esq: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dir: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M11 7H7a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function icone(nome) {
    const molde = document.createElement('template');
    molde.innerHTML = ICONES[nome];
    return molde.content.firstChild;
  }

  const elSidebar = document.getElementById('sidebar');
  const elEnunciado = document.getElementById('enunciado');
  const elResposta = document.getElementById('resposta');
  const elResumo = document.getElementById('resumo');
  const elScrim = document.getElementById('scrim');
  const btnMenu = document.getElementById('btn-menu');
  const btnTema = document.getElementById('btn-tema');

  // ---------- Estado ----------
  const CHAVE_UI = 'bq:ui:v1';
  const salvo = BQ.lerLocal(CHAVE_UI, {});

  const chaveEdicao = ed => `${ed.instituicao}|${ed.edicao}|${ed.fase || ''}`;
  const instituicoes = [...new Set(CATALOGO.map(ed => ed.instituicao))]
    .sort((a, b) => (b === 'UNESP') - (a === 'UNESP') || a.localeCompare(b));

  const estado = {
    prova: salvo.prova === 'vunesp' ? 'vunesp' : 'enem',
    enem: {
      anos: ENEM.ANOS_PADRAO,
      ano: ENEM.ANOS_PADRAO.includes(salvo.ano) ? salvo.ano : ENEM.ANOS_PADRAO[0], // número ou "2024-reaplicacao"
      area: ENEM.AREAS.some(a => a.id === salvo.area) ? salvo.area : 'linguagens',
      idioma: salvo.idioma === 'espanhol' ? 'espanhol' : 'ingles',
      filtro: 'todas',
      ocultarIncompletas: salvo.ocultarIncompletas !== false, // questões que a API entregou sem dado essencial
      incompletas: 0,         // quantas o filtro atual teria, ocultas ou não
      disciplina: 'todas',
      assunto: 'todos',
      questoes: [],
      resolucoes: null,       // resoluções comentadas do ano aberto, quando existem
      anosComResolucao: [],
      lista: [],
      atualId: salvo.atualId || null,
      verRedacao: false,      // proposta de redação aberta no lugar das questões (anos tirados do PDF)
      redacao: undefined,     // undefined: carregando; null: o ano não tem
      carregando: false,
      erro: null,
      pedido: 0,
    },
    vunesp: {
      instituicao: instituicoes.includes(salvo.instituicao) ? salvo.instituicao : instituicoes[0] || null,
      campo: 'todos',
      disciplina: 'todas',   // estimada pelo classificador; vale para todas as edições da instituição
      edicao: salvo.edicao || null,
      caderno: 0,
      questao: 1,
      verPdf: true,
    },
  };

  function salvarUi() {
    BQ.gravarLocal(CHAVE_UI, {
      prova: estado.prova,
      ano: estado.enem.ano,
      area: estado.enem.area,
      idioma: estado.enem.idioma,
      atualId: estado.enem.atualId,
      ocultarIncompletas: estado.enem.ocultarIncompletas,
      instituicao: estado.vunesp.instituicao,
      edicao: estado.vunesp.edicao,
    });
  }

  // ---------- Peças comuns ----------
  function seg(opcoes, atual, aoEscolher, classe) {
    return h('div.seg', { class: classe, role: 'group' }, opcoes.map(o =>
      h('button', { type: 'button', 'aria-pressed': String(o.v === atual), 'data-v': o.v, onclick: () => aoEscolher(o.v) }, o.t)));
  }

  function campoDeTexto(rotulo, valor, placeholder, aoDigitar, classe) {
    const area = h('textarea', { class: classe, placeholder, spellcheck: 'true', oninput: ev => aoDigitar(ev.target.value) });
    area.value = valor || '';
    return h('label.campo-texto', null, rotulo ? h('span', null, rotulo) : null, area);
  }

  function irAoTopo() {
    elEnunciado.scrollTop = 0;
    elResposta.scrollTop = 0;
    if (document.documentElement.scrollTop > 0) window.scrollTo(0, 0);
  }

  function fecharMenu() {
    document.body.classList.remove('menu-aberto');
    elScrim.hidden = true;
    btnMenu.setAttribute('aria-expanded', 'false');
  }

  // ---------- ENEM: dados ----------
  function questaoAtual() {
    const e = estado.enem;
    return e.questoes.find(q => q.id === e.atualId) || null;
  }

  function idiomasDisponiveis() {
    const presentes = new Set(estado.enem.questoes.map(q => q.idioma).filter(Boolean));
    return Object.keys(ENEM.IDIOMAS).filter(i => presentes.has(i));
  }

  function questoesDoIdioma() {
    const e = estado.enem;
    return e.questoes.filter(q => !q.idioma || q.idioma === e.idioma);
  }

  function contar(lista, chave) {
    const total = new Map();
    lista.forEach(item => total.set(chave(item), (total.get(chave(item)) || 0) + 1));
    return total;
  }

  // A lista é fotografada ao trocar de área/filtro, para a questão não sumir da tela ao ser conferida.
  function recalcularLista() {
    const e = estado.enem;
    const idiomas = idiomasDisponiveis();
    if (idiomas.length && !idiomas.includes(e.idioma)) e.idioma = idiomas[0];
    let qs = questoesDoIdioma();
    if (!qs.some(q => q.classe.disciplina === e.disciplina)) e.disciplina = 'todas';
    if (e.disciplina !== 'todas') qs = qs.filter(q => q.classe.disciplina === e.disciplina);
    if (!qs.some(q => q.classe.assunto === e.assunto)) e.assunto = 'todos';
    if (e.assunto !== 'todos') qs = qs.filter(q => q.classe.assunto === e.assunto);
    if (e.filtro === 'pendentes') qs = qs.filter(q => !(store.get(q.id) || {}).conf);
    if (e.filtro === 'erradas') qs = qs.filter(q => { const r = store.get(q.id); return r && r.conf && !r.ok; });
    const incompleta = q => ENEM.falhasDaFonte(q).length > 0;
    e.incompletas = qs.filter(incompleta).length;
    if (e.ocultarIncompletas) qs = qs.filter(q => !incompleta(q));
    e.lista = qs.map(q => q.id);
    if (!e.lista.includes(e.atualId)) e.atualId = e.lista[0] || null;
  }

  async function carregarEnem() {
    const e = estado.enem;
    const pedido = ++e.pedido;
    e.carregando = true;
    e.erro = null;
    e.questoes = [];
    e.resolucoes = null;
    e.lista = [];
    renderTudo();
    ENEM.carregarResolucoes(e.ano).then(dados => {
      if (pedido !== e.pedido) return;
      e.resolucoes = dados;
      if (!e.carregando) renderResposta();
    });
    try {
      const questoes = await ENEM.carregarArea(e.ano, e.area);
      if (pedido !== e.pedido) return; // o aluno já trocou de área enquanto carregava
      questoes.forEach(q => { q.classe = BQ.classificador.classificar(q, e.area); });
      e.questoes = questoes;
      recalcularLista();
    } catch (erro) {
      if (pedido !== e.pedido) return;
      e.erro = (erro && erro.message) || String(erro);
    }
    e.carregando = false;
    salvarUi();
    renderTudo();
  }

  function progressoEnem(ano, areaId) {
    const [ini, fim] = ENEM.faixa(ano, areaId);
    const porNumero = new Map();
    const prefixo = `enem:${ano}:`;
    for (const id of store.ids()) {
      if (!id.startsWith(prefixo)) continue;
      const numero = +id.split(':')[2];
      const reg = store.get(id);
      if (numero < ini || numero > fim || !reg.conf) continue;
      porNumero.set(numero, porNumero.get(numero) || !!reg.ok);
    }
    let acertos = 0;
    porNumero.forEach(ok => { if (ok) acertos++; });
    return { feitas: porNumero.size, acertos };
  }

  // ---------- ENEM: ações ----------
  function trocarAno(ano) {
    const e = estado.enem;
    Object.assign(e, { ano, atualId: null, disciplina: 'todas', assunto: 'todos' });
    if (e.verRedacao && !ENEM.ANOS_LOCAIS.includes(ano)) e.verRedacao = false;
    if (e.verRedacao) carregarRedacao();
    carregarEnem();
  }

  function carregarRedacao() {
    const e = estado.enem;
    const ano = e.ano;
    e.redacao = undefined;
    ENEM.carregarRedacao(ano)
      .then(r => { if (e.ano === ano) { e.redacao = r; renderEnunciado(); renderResposta(); } })
      .catch(() => { if (e.ano === ano) { e.redacao = null; renderEnunciado(); } });
  }

  function abrirRedacao() {
    fecharMenu();
    const e = estado.enem;
    if (e.verRedacao) return;
    e.verRedacao = true;
    carregarRedacao();
    irAoTopo();
    renderTudo();
  }

  function trocarArea(area) {
    fecharMenu();
    if (estado.enem.verRedacao) {
      estado.enem.verRedacao = false;
      if (area === estado.enem.area && !estado.enem.erro) { irAoTopo(); renderTudo(); return; }
    }
    if (area === estado.enem.area && !estado.enem.erro) return;
    Object.assign(estado.enem, { area, atualId: null, disciplina: 'todas', assunto: 'todos' });
    irAoTopo();
    carregarEnem();
  }

  function trocarDisciplina(disciplina) {
    fecharMenu();
    Object.assign(estado.enem, { disciplina, assunto: 'todos' });
    recalcularLista();
    salvarUi();
    renderTudo();
    irAoTopo();
  }

  function trocarAssunto(assunto) {
    estado.enem.assunto = assunto;
    recalcularLista();
    renderEnunciado();
    renderResposta();
  }

  function trocarIdioma(idioma) {
    estado.enem.idioma = idioma;
    recalcularLista();
    salvarUi();
    renderTudo();
  }

  function alternarIncompletas() {
    estado.enem.ocultarIncompletas = !estado.enem.ocultarIncompletas;
    recalcularLista();
    salvarUi();
    renderEnunciado();
    renderResposta();
  }

  function trocarFiltro(filtro) {
    estado.enem.filtro = filtro;
    recalcularLista();
    renderEnunciado();
    renderResposta();
  }

  function irPara(id) {
    if (!id || id === estado.enem.atualId) return;
    estado.enem.atualId = id;
    salvarUi();
    renderEnunciado();
    renderResposta();
    irAoTopo();
  }

  function vizinha(delta) {
    const e = estado.enem;
    const i = e.lista.indexOf(e.atualId);
    return i < 0 ? null : e.lista[i + delta] || null;
  }

  function escolher(q, letra) {
    const reg = store.get(q.id) || {};
    if (reg.conf) return;
    store.set(q.id, { r: reg.r === letra ? null : letra });
    renderResposta();
    atualizarNavegador();
  }

  function conferir(q) {
    const reg = store.get(q.id);
    if (!reg || !reg.r || !q.gabarito) return;
    store.set(q.id, { conf: true, ok: reg.r === q.gabarito });
    renderResposta();
    atualizarNavegador();
    renderSidebar();
    renderResumo();
  }

  function refazer(q) {
    store.set(q.id, { r: null, conf: false, ok: null, visto: false });
    renderResposta();
    atualizarNavegador();
    renderSidebar();
    renderResumo();
  }

  // ---------- ENEM: telas ----------
  function sidebarEnem() {
    const e = estado.enem;
    const selAno = h('select.select', { 'aria-label': 'Ano da prova', onchange: ev => trocarAno(ENEM.provaDoValor(ev.target.value)) },
      e.anos.map(ano => {
        const op = h('option', { value: ano }, `${ENEM.rotulo(ano)}${e.anosComResolucao.includes(ano) ? ' · com resoluções' : ''}`);
        op.selected = ano === e.ano;
        return op;
      }));

    const idiomas = idiomasDisponiveis();
    const campos = h('ul.campos', null, ENEM.AREAS.map(a => {
      const p = progressoEnem(e.ano, a.id);
      const ativa = a.id === e.area && !e.verRedacao;
      return h('li', null,
        h('button.campo', { type: 'button', style: `--dot:${a.cor}`, 'aria-current': String(ativa), onclick: () => trocarArea(a.id) },
          h('span.campo-dot'),
          h('span.campo-nome', null, a.nome),
          h('span.campo-num', { title: `${p.acertos} acertos em ${p.feitas} conferidas` }, `${p.feitas}/${ENEM.POR_AREA}`),
          h('span.campo-bar', null, h('i', { style: `width:${Math.min(100, (p.feitas / ENEM.POR_AREA) * 100)}%` }))),
        ativa && idiomas.length > 1
          ? h('div.sub-idioma', null, seg(idiomas.map(i => ({ v: i, t: ENEM.IDIOMAS[i] || i })), e.idioma, trocarIdioma, 'sm'))
          : null,
        ativa ? subcamposEnem() : null);
    }));
    if (ENEM.ANOS_LOCAIS.includes(e.ano)) {
      campos.append(h('li', null,
        h('button.campo', { type: 'button', style: '--dot:#3f6fb5', 'aria-current': String(e.verRedacao), onclick: abrirRedacao },
          h('span.campo-dot'),
          h('span.campo-nome', null, 'Redação'),
          h('span.campo-num', null, store.get(`enem:${e.ano}:redacao`) && store.get(`enem:${e.ano}:redacao`).texto ? 'escrita' : ''))));
    }

    return [
      h('div', null, h('span.side-label', null, 'Ano'), selAno),
      h('div', null, h('span.side-label', null, 'Campos'), campos),
    ];
  }

  // Disciplinas dentro do campo aberto (estimadas pelo classificador), com a contagem de questões.
  function subcamposEnem() {
    const e = estado.enem;
    const visiveis = questoesDoIdioma();
    const porDisciplina = contar(visiveis, q => q.classe.disciplina);
    if (porDisciplina.size < 2) return null;
    const botao = (id, nome, n) => h('li', null,
      h('button.subcampo', { type: 'button', 'aria-current': String(e.disciplina === id), onclick: () => trocarDisciplina(id) },
        h('span', null, nome), h('span.campo-num', null, n)));
    return h('ul.subcampos', { 'aria-label': 'Disciplinas' },
      botao('todas', 'Todas', visiveis.length),
      BQ.classificador.disciplinas(e.area).filter(d => porDisciplina.has(d.id)).map(d => botao(d.id, d.nome, porDisciplina.get(d.id))));
  }

  function seletorDeAssunto() {
    const e = estado.enem;
    let base = questoesDoIdioma();
    if (e.disciplina !== 'todas') base = base.filter(q => q.classe.disciplina === e.disciplina);
    const porAssunto = [...contar(base, q => q.classe.assunto)].sort((a, b) => b[1] - a[1]);
    if (porAssunto.length < 2) return null;
    const seletor = h('select.select.sm', { 'aria-label': 'Assunto', onchange: ev => trocarAssunto(ev.target.value) },
      h('option', { value: 'todos' }, 'Todos os assuntos'),
      porAssunto.map(([nome, n]) => h('option', { value: nome }, `${nome} (${n})`)));
    seletor.value = e.assunto;
    return seletor;
  }

  function classeNavEnem(q) {
    const reg = store.get(q.id);
    const incompleta = ENEM.falhasDaFonte(q).length ? ' is-incompleta' : '';
    if (!reg) return incompleta.trim();
    if (reg.conf) return (reg.ok ? 'is-ok' : 'is-bad') + incompleta;
    return (reg.r ? 'is-marcada' : '') + incompleta;
  }

  function navegadorEnem() {
    const e = estado.enem;
    const porId = new Map(e.questoes.map(q => [q.id, q]));
    return h('nav.q-nav', { id: 'q-nav', 'aria-label': 'Questões' }, e.lista.map(id => {
      const q = porId.get(id);
      return h('button', {
        type: 'button',
        class: classeNavEnem(q),
        'aria-current': String(id === e.atualId),
        'aria-label': `Questão ${q.numero}${ENEM.falhasDaFonte(q).length ? ' (incompleta na fonte)' : ''}`,
        title: ENEM.falhasDaFonte(q).length ? 'Incompleta na fonte: ' + ENEM.falhasDaFonte(q).join('; ') : null,
        onclick: () => irPara(id),
      }, q.numero);
    }));
  }

  function atualizarNavegador() {
    const antigo = document.getElementById('q-nav');
    if (!antigo) return;
    antigo.replaceWith(estado.prova === 'enem' ? navegadorEnem() : navegadorVunesp(edicaoAtual()));
  }

  function enunciadoRedacaoEnem() {
    const e = estado.enem;
    const wrap = h('div.q-wrap', null,
      h('p.crumbs', null, ENEM.rotulo(e.ano), h('span.sep', null, '·'), 'Redação'),
      h('div.q-title-row', null, h('h1', null, 'Proposta de redação')));
    if (e.redacao === undefined) {
      wrap.append(h('div.skel', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, () => h('i'))));
    } else if (!e.redacao) {
      wrap.append(h('div.estado', null, h('h2', null, 'Proposta indisponível'), h('p', null, `Não encontrei a proposta de redação do ${ENEM.rotulo(e.ano)}.`)));
    } else {
      wrap.append(
        BQ.recortes.montar(e.redacao.pdf, [{ rotulo: null, recortes: e.redacao.recortes }], `Proposta de redação do ${ENEM.rotulo(e.ano)}, reproduzida do caderno de prova`),
        h('p.nota-rodape', null, 'Reproduzida do caderno azul do INEP. ',
          h('a', { href: e.redacao.pdf, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o caderno completo')));
    }
    return wrap;
  }

  function enunciadoEnem() {
    const e = estado.enem;
    if (e.verRedacao) return enunciadoRedacaoEnem();
    const area = ENEM.AREAS.find(a => a.id === e.area);
    const wrap = h('div.q-wrap', null,
      h('p.crumbs', null, ENEM.rotulo(e.ano), h('span.sep', null, '·'), area.nomeLongo));

    if (e.carregando) {
      wrap.append(
        h('div.q-title-row', null, h('h1', null, 'Carregando questões…')),
        h('div.skel', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, () => h('i'))));
      return wrap;
    }

    if (e.erro) {
      wrap.append(h('div.estado', { role: 'alert' },
        h('h2', null, 'Não deu para carregar as questões'),
        h('p', null, e.erro),
        h('button.btn.primary', { type: 'button', onclick: carregarEnem }, 'Tentar de novo')));
      return wrap;
    }

    const q = questaoAtual();
    const anterior = vizinha(-1);
    const proxima = vizinha(1);

    wrap.append(
      h('div.q-title-row', null,
        h('h1', null, q ? `Questão ${q.numero}` : 'Nenhuma questão'),
        q ? h('span.tag.accent', null, BQ.classificador.nome(q.classe.disciplina)) : null,
        q && q.classe.assunto ? h('span.tag', { title: 'Assunto estimado automaticamente pelas palavras do enunciado' }, q.classe.assunto) : null,
        h('span.grow'),
        h('div.pager', null,
          h('button.btn.sm', { type: 'button', disabled: !anterior, title: 'Anterior (←)', onclick: () => irPara(anterior) }, icone('esq'), h('span', null, 'Anterior')),
          h('button.btn.sm', { type: 'button', disabled: !proxima, title: 'Próxima (→)', onclick: () => irPara(proxima) }, h('span', null, 'Próxima'), icone('dir')))),
      h('div.q-tools', null,
        seg([{ v: 'todas', t: 'Todas' }, { v: 'pendentes', t: 'Pendentes' }, { v: 'erradas', t: 'Erradas' }], e.filtro, trocarFiltro, 'sm'),
        seletorDeAssunto(),
        e.incompletas ? h('button.chip.sm', {
          type: 'button',
          'aria-pressed': String(e.ocultarIncompletas),
          title: 'Questões que a fonte (API enem.dev) entregou sem figura, texto ou alternativa',
          onclick: alternarIncompletas,
        }, e.ocultarIncompletas
          ? `${e.incompletas} ${e.incompletas === 1 ? 'incompleta oculta' : 'incompletas ocultas'} · mostrar`
          : `Ocultar ${e.incompletas} ${e.incompletas === 1 ? 'incompleta' : 'incompletas'}`) : null,
        h('span.hint', null, `${e.lista.length} ${e.lista.length === 1 ? 'questão' : 'questões'}`)),
      navegadorEnem());

    if (!q) {
      const mensagens = {
        todas: 'Não há questões para este filtro.',
        pendentes: 'Você já conferiu todas as questões desta área.',
        erradas: 'Nenhuma questão errada nesta área.',
      };
      wrap.append(h('div.estado', null, h('h2', null, 'Nada por aqui'), h('p', null, mensagens[e.filtro])));
      return wrap;
    }

    if (q.recortes) {
      wrap.append(
        BQ.recortes.montar(q.pdf, [
          { rotulo: q.apoio.length ? 'Texto de apoio' : null, recortes: q.apoio },
          { rotulo: null, recortes: q.recortes },
        ], `Questão ${q.numero} do ${ENEM.rotulo(q.ano)}, reproduzida do caderno de prova`),
        h('p.nota-rodape', null, 'Reproduzida do caderno azul do INEP. ',
          h('a', { href: q.pdf, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o caderno completo')));
      return wrap;
    }

    const falhas = ENEM.falhasDaFonte(q);
    if (falhas.length) {
      const lista = falhas.join('; ');
      wrap.append(h('div.aviso.aviso-fonte', { role: 'note' },
        h('p', null, h('strong', null, 'Questão incompleta na fonte: '), lista.charAt(0).toUpperCase() + lista.slice(1) + '.'),
        h('p', null, 'A API aberta de onde vêm as questões de 2009 e 2010 perdeu parte desta. Para resolver, abra a prova de ',
          `${q.ano} no `,
          h('a', { href: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos', target: '_blank', rel: 'noopener noreferrer' }, 'site do INEP'),
          ' ou pule para a próxima.')));
    }

    const avulsas = q.arquivos.filter(url => !q.contexto.includes(url));
    wrap.append(h('article.q-body', null,
      q.contexto ? h('div.q-contexto', { html: md(q.contexto) }) : null,
      avulsas.length ? h('div', { html: avulsas.map(url => `<figure class="q-fig">${BQ.imagemHtml(url)}</figure>`).join('') }) : null,
      q.comando ? h('div.q-comando', { class: q.contexto || avulsas.length ? '' : 'sozinho', html: md(q.comando) }) : null));
    return wrap;
  }

  function linkDeBusca(q) {
    const trecho = (q.comando || q.contexto || q.texto || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[*_#>\[\]()]/g, ' ')
      .split(/\s+/).filter(Boolean).slice(0, 12).join(' ');
    return 'https://www.google.com/search?q=' + encodeURIComponent(`${ENEM.rotulo(q.ano)} resolução comentada ${trecho}`);
  }

  function respostaRedacaoEnem() {
    const id = `enem:${estado.enem.ano}:redacao`;
    const reg = store.get(id) || {};
    return [h('div.card', null,
      h('h2', null, 'Sua redação', h('span.tag', null, ENEM.rotulo(estado.enem.ano))),
      campoDeTexto(null, reg.texto, 'Escreva sua redação… (até 30 linhas na folha oficial)',
        valor => { store.set(id, { texto: valor }); }, 'alto'),
      h('p.nota-rodape', null, 'Salvo automaticamente neste navegador.')),
    h('div.card', null,
      h('h2', null, 'Correção'),
      h('p.nota-rodape', { style: 'margin:0 0 12px' }, 'O ENEM corrige a redação em cinco competências, de 0 a 200 pontos cada: norma-padrão, compreensão da proposta, organização dos argumentos, coesão e proposta de intervenção que respeite os direitos humanos.'),
      campoDeTexto('Suas anotações da correção', reg.nota, 'Notas por competência, o que melhorar…',
        valor => store.set(id, { nota: valor })))];
  }

  function respostaEnem() {
    if (estado.enem.verRedacao) return respostaRedacaoEnem();
    const q = estado.enem.carregando || estado.enem.erro ? null : questaoAtual();
    if (!q) return [];
    const reg = store.get(q.id) || {};
    const conferida = !!reg.conf;
    const aberto = conferida || !!reg.visto;

    // Nas questões recortadas do PDF as alternativas já aparecem no enunciado: aqui ficam só as letras.
    const compactas = q.alternativas.every(a => !a.texto && !a.arquivo);
    const alternativas = h('div.alts', { class: compactas ? 'compactas' : '' }, q.alternativas.map(a => {
      const marcada = reg.r === a.letra;
      const classes = [];
      if (aberto && a.letra === q.gabarito) classes.push('is-ok');
      else if (conferida && marcada) classes.push('is-bad');
      else if (marcada) classes.push('is-sel');
      return h('button.alt', {
        type: 'button',
        class: classes.join(' '),
        disabled: conferida,
        'aria-pressed': String(marcada),
        onclick: () => escolher(q, a.letra),
      },
        h('span.alt-letra', null, a.letra),
        compactas ? null : h('span.alt-texto', { html: md(a.texto) + (a.arquivo ? BQ.imagemHtml(a.arquivo, `Alternativa ${a.letra}`) : '') }));
    }));

    let veredito = null;
    if (!q.gabarito) veredito = h('p.veredito.info', null, 'A fonte não traz gabarito para esta questão (pode ter sido anulada).');
    else if (conferida) {
      veredito = reg.ok
        ? h('p.veredito.ok', null, 'Você acertou.')
        : h('p.veredito.bad', null, `Você marcou ${reg.r}. A resposta correta é ${q.gabarito}.`);
    }

    const cartaoResposta = h('div.card', null,
      h('h2', null, 'Sua resposta', h('span.tag', null, `Questão ${q.numero}`)),
      alternativas,
      h('div.acoes', null,
        conferida
          ? h('button.btn', { type: 'button', onclick: () => refazer(q) }, 'Refazer')
          : h('button.btn.primary', { type: 'button', disabled: !reg.r || !q.gabarito, onclick: () => conferir(q) }, 'Conferir resposta'),
        conferida && vizinha(1)
          ? h('button.btn.primary', { type: 'button', onclick: () => irPara(vizinha(1)) }, 'Próxima questão', icone('dir'))
          : null),
      veredito);

    const certa = q.alternativas.find(a => a.letra === q.gabarito);
    const gabarito = aberto && q.gabarito
      ? h('div.gabarito', null,
          h('span.letra', null, q.gabarito),
          h('div', null, h('small', null, 'Gabarito oficial'), certa && certa.texto ? h('div.txt', { html: md(certa.texto) }) : null))
      : h('div.gabarito.fechado', null,
          h('span', null, q.gabarito ? 'O gabarito aparece quando você conferir.' : 'Sem gabarito na fonte.'),
          q.gabarito ? h('button.btn.ghost.sm', { type: 'button', onclick: () => { store.set(q.id, { visto: true }); renderResposta(); } }, 'Ver agora') : null);

    const chave = q.id.split(':').slice(2).join(':');
    const comentada = (estado.enem.resolucoes && estado.enem.resolucoes.questoes[chave]) || null;
    let resolucao = null;
    if (comentada && comentada.resolucao && aberto) {
      resolucao = h('div.resolucao', null,
        h('div.resolucao-texto', { html: md(comentada.resolucao) }),
        comentada.confianca !== 'alta' && comentada.pendencia
          ? h('p.resolucao-alerta', null, h('b', null, 'Questão discutível. '), comentada.pendencia) : null,
        h('p.nota-rodape', null, 'Resolução gerada por IA a partir do caderno e do gabarito oficial, sem revisão humana. Pode conter erros.'));
    } else if (comentada && comentada.resolucao) {
      resolucao = h('p.nota-rodape', { style: 'margin:0 0 12px' }, 'A resolução comentada aparece junto com o gabarito.');
    }

    const cartaoResolucao = h('div.card', null,
      h('h2', null, 'Resolução', comentada && comentada.resolucao ? h('span.tag.accent', null, 'comentada') : null),
      gabarito,
      resolucao,
      campoDeTexto('Sua resolução e anotações', reg.nota,
        'Registre o raciocínio, a pegadinha, o conteúdo a revisar…',
        valor => store.set(q.id, { nota: valor })),
      h('div.acoes', null,
        h('a.btn.sm', { href: linkDeBusca(q), target: '_blank', rel: 'noopener noreferrer' }, 'Buscar resolução comentada', icone('ext'))),
      h('p.nota-rodape', null, 'Anotações ficam salvas neste navegador.'));

    return [cartaoResposta, cartaoResolucao];
  }

  // ---------- Vunesp: dados ----------
  // "1-10", "1-10,31-35" (vários blocos) ou "5" (um número só)
  const faixaParaLista = texto => {
    const numeros = [];
    for (const pedaco of String(texto || '').split(',')) {
      const m = /^(\d+)(?:\s*[-–a]\s*(\d+))?$/.exec(pedaco.trim());
      if (m && m[2] === undefined) m[2] = m[1];
      if (!m || +m[2] < +m[1] || m[2] - m[1] > 200) return null;
      for (let n = +m[1]; n <= +m[2]; n++) numeros.push(n);
    }
    return numeros.length ? numeros : null;
  };

  // Faixas por campo: as do caderno (estrutura fixa, onde cada prova recomeça do 1) ou as da edição (Unesp).
  const faixasDe = (ed, cad) => (cad && cad.faixas) || (ed && ed.faixas) || {};

  // Muitos cadernos fora da Unesp não informam as áreas; nesse caso o campo não os esconde.
  function cadernoCobre(cad, campo) {
    const areas = cad.areas || [];
    if (campo === 'redacao') return areas.includes('redacao');
    return areas.includes(campo) || !areas.some(a => a !== 'redacao');
  }

  function combinaCampo(ed, campo) {
    if (campo === 'todos') return true;
    const cadernos = ed.cadernos || [];
    if (!cadernos.length) return true;
    return cadernos.some(c => cadernoCobre(c, campo));
  }

  function edicoesVisiveis() {
    const v = estado.vunesp;
    const lista = CATALOGO.filter(ed => ed.instituicao === v.instituicao && combinaCampo(ed, v.campo));
    if (v.disciplina === 'todas') return lista;
    const contagem = contagemPorDisciplina();
    if (!contagem.completa) return lista;
    return lista.filter(ed => (contagem.porEdicao.get(ed) || new Map()).get(v.disciplina) > 0);
  }

  function edicaoAtual() {
    const lista = edicoesVisiveis();
    return lista.find(ed => chaveEdicao(ed) === estado.vunesp.edicao) || lista[0] || null;
  }

  function cadernoAtual(ed) {
    const cadernos = (ed && ed.cadernos) || [];
    return cadernos[estado.vunesp.caderno] || cadernos[0] || null;
  }

  // Números das questões do caderno; com um campo escolhido, só os daquele campo (quando a edição informa as faixas).
  function numerosDoCampo(ed, cad) {
    const todos = cad && cad.local ? cad.local.numeros : faixaParaLista(cad && cad.questoes);
    const campo = estado.vunesp.campo;
    const doCampo = faixaParaLista(faixasDe(ed, cad)[campo]);
    if (!todos || !doCampo) return todos;
    const filtrados = todos.filter(n => doCampo.includes(n));
    return filtrados.length ? filtrados : todos;
  }

  // Com uma disciplina escolhida, só as questões que o classificador atribuiu a ela (pode sobrar lista vazia).
  function numerosDoCaderno(ed, cad) {
    const numeros = numerosDoCampo(ed, cad);
    const disciplina = estado.vunesp.disciplina;
    if (disciplina === 'todas' || !numeros) return numeros;
    const classes = classesDoCaderno(ed, cad);
    if (!classes) return cad && cad.local ? [] : numeros;
    return numeros.filter(n => disciplinasDaQuestao(classes.get(n)).includes(disciplina));
  }

  // A principal e, nas questões com itens que cobram outra disciplina (poema + gramática), também essa.
  function disciplinasDaQuestao(classe) {
    if (!classe || !classe.disciplina) return [];
    return [classe.disciplina, ...(classe.tambem || [])];
  }

  function disciplinasDoCampo(campo) {
    if (campo === 'redacao') return [];
    if (campo !== 'todos') return BQ.classificador.disciplinas(campo);
    const vistas = new Set();
    return ['linguagens', 'humanas', 'natureza-matematica'].flatMap(a => BQ.classificador.disciplinas(a))
      .filter(d => !vistas.has(d.id) && vistas.add(d.id));
  }

  // Quantas questões de cada disciplina há em cada edição da instituição e do campo abertos.
  // Fica "incompleta" enquanto algum índice de caderno ainda está carregando.
  const contagensProntas = new Map();
  function contagemPorDisciplina() {
    const v = estado.vunesp;
    const chave = `${v.instituicao}|${v.campo}`;
    if (contagensProntas.has(chave)) return contagensProntas.get(chave);
    const permitidas = new Set(disciplinasDoCampo(v.campo).map(d => d.id));
    const total = new Map();
    const porEdicao = new Map();
    let completa = true;
    let semRecorte = 0;
    let questoes = 0; // todas as questões recortadas, inclusive as que o classificador não soube atribuir
    const edicoes = CATALOGO.filter(ed => ed.instituicao === v.instituicao && combinaCampo(ed, v.campo));
    for (const ed of edicoes) {
      const daEdicao = new Map();
      const cadernos = (ed.cadernos || []).filter(c => c.local && (v.campo === 'todos' || cadernoCobre(c, v.campo)));
      if (!cadernos.length) semRecorte++;
      for (const cad of cadernos) {
        const classes = classesDoCaderno(ed, cad);
        if (classes === undefined) { completa = false; continue; }
        if (!classes) continue;
        for (const n of numerosDoCampo(ed, cad) || []) {
          questoes++;
          for (const d of disciplinasDaQuestao(classes.get(n))) {
            if (!permitidas.has(d)) continue;
            daEdicao.set(d, (daEdicao.get(d) || 0) + 1);
            total.set(d, (total.get(d) || 0) + 1);
          }
        }
      }
      porEdicao.set(ed, daEdicao);
    }
    const contagem = { total, porEdicao, completa, semRecorte, questoes };
    if (completa) contagensProntas.set(chave, contagem);
    return contagem;
  }

  function temRedacao(ed, cad) {
    if (!cad) return /reda[çc][ãa]o/i.test((ed && ed.estrutura) || '');
    return (cad.areas || []).includes('redacao') || !!(cad.local && cad.local.redacao);
  }

  function idVunesp(ed, questao) {
    const q = questao === undefined ? estado.vunesp.questao : questao;
    if (q === 'redacao') return `vunesp:${chaveEdicao(ed)}:redacao`;
    // Onde cada caderno recomeça a numeração, o caderno entra na chave.
    return `vunesp:${chaveEdicao(ed)}:${ed.numeracao_unica ? '' : 'c' + estado.vunesp.caderno + ':'}q${q}`;
  }

  function primeiraQuestao(ed, cad) {
    const numeros = numerosDoCaderno(ed, cad);
    if (estado.vunesp.campo === 'redacao' && temRedacao(ed, cad)) return 'redacao';
    if (!numeros) return 1;
    return numeros.length ? numeros[0] : null; // null: nenhuma questão da disciplina neste caderno
  }

  // Ao escolher um campo, abre o caderno que contém aquele campo.
  function ajustarCaderno() {
    const v = estado.vunesp;
    const ed = edicaoAtual();
    const cadernos = (ed && ed.cadernos) || [];
    let i = v.campo === 'todos' ? 0 : cadernos.findIndex(c => (c.areas || []).includes(v.campo));
    if (i < 0) i = 0;
    if (v.disciplina !== 'todas') {
      const comDisciplina = cadernos.findIndex(c => (numerosDoCaderno(ed, c) || []).length > 0);
      if (comDisciplina >= 0) i = comDisciplina;
    }
    v.caderno = i;
    v.questao = primeiraQuestao(ed, cadernos[i]);
  }

  // ---------- Vunesp: ações ----------
  function trocarInstituicao(inst) {
    estado.vunesp.instituicao = inst;
    estado.vunesp.edicao = null;
    estado.vunesp.disciplina = 'todas';
    ajustarCaderno();
    salvarUi();
    renderTudo();
  }

  function trocarCampo(campo) {
    fecharMenu();
    estado.vunesp.campo = campo;
    if (!disciplinasDoCampo(campo).some(d => d.id === estado.vunesp.disciplina)) estado.vunesp.disciplina = 'todas';
    ajustarCaderno();
    renderTudo();
    irAoTopo();
  }

  function trocarDisciplinaVunesp(disciplina) {
    fecharMenu();
    estado.vunesp.disciplina = disciplina;
    ajustarCaderno();
    renderTudo();
    irAoTopo();
  }

  function trocarEdicao(chave) {
    fecharMenu();
    estado.vunesp.edicao = chave;
    ajustarCaderno();
    salvarUi();
    renderTudo();
    irAoTopo();
  }

  function trocarCaderno(i) {
    const ed = edicaoAtual();
    estado.vunesp.caderno = i;
    estado.vunesp.questao = primeiraQuestao(ed, ed.cadernos[i]);
    renderEnunciado();
    renderResposta();
  }

  function trocarQuestaoVunesp(q) {
    estado.vunesp.questao = q;
    renderEnunciado();
    renderResposta();
  }

  // ---------- Vunesp: telas ----------
  function sidebarVunesp() {
    const v = estado.vunesp;
    if (!CATALOGO.length) return [];
    const atual = edicaoAtual();

    const selInst = h('select.select', { 'aria-label': 'Instituição', onchange: ev => trocarInstituicao(ev.target.value) },
      instituicoes.map(nome => {
        const op = h('option', { value: nome }, nome);
        op.selected = nome === v.instituicao;
        return op;
      }));

    carregarIndicesDaInstituicao(v.instituicao);
    const contagem = contagemPorDisciplina();
    const filtrando = v.disciplina !== 'todas' && contagem.completa;

    const campos = h('ul.campos', null, CAMPOS_VUNESP.map(c =>
      h('li', null,
        h('button.campo', { type: 'button', style: `--dot:${c.cor}`, 'aria-current': String(c.id === v.campo), onclick: () => trocarCampo(c.id) },
          h('span.campo-dot'), h('span.campo-nome', null, c.nome)),
        c.id === v.campo ? subcamposVunesp(contagem) : null)));

    const edicoes = h('ul.edicoes', null, edicoesVisiveis().map(ed =>
      h('li', null, h('button.edicao', { type: 'button', 'aria-current': String(ed === atual), onclick: () => trocarEdicao(chaveEdicao(ed)) },
        h('span', null, ed.edicao),
        ed.fase === '1ª fase' ? h('span.tag', null, '1ª fase') : ed.formato === 'objetiva' ? h('span.tag', null, 'objetiva') : null,
        filtrando ? h('span.campo-num', { title: `Questões de ${BQ.classificador.nome(v.disciplina)} nesta edição` },
          contagem.porEdicao.get(ed).get(v.disciplina)) : null))));

    return [
      h('div', null, h('span.side-label', null, 'Instituição'), selInst),
      h('div', null, h('span.side-label', null, 'Campos'), campos),
      h('div', null,
        h('span.side-label', null, filtrando ? `Edições com ${BQ.classificador.nome(v.disciplina)}` : 'Edições'),
        edicoes,
        filtrando && contagem.semRecorte
          ? h('p.nota-rodape', null, `${contagem.semRecorte} ${contagem.semRecorte === 1 ? 'edição abre' : 'edições abrem'} só como PDF inteiro e não ${contagem.semRecorte === 1 ? 'entra' : 'entram'} no filtro.`)
          : null),
    ];
  }

  // Disciplinas do campo aberto, somando todas as edições da instituição (estimadas pelo classificador).
  function subcamposVunesp(contagem) {
    const v = estado.vunesp;
    const disciplinas = disciplinasDoCampo(v.campo);
    if (!disciplinas.length) return null;
    if (!contagem.completa) return h('p.nota-rodape.subcampos-nota', null, 'Contando questões por disciplina…');
    const presentes = disciplinas.filter(d => contagem.total.has(d.id));
    if (presentes.length < 2) return null;
    const botao = (id, nome, n) => h('li', null,
      h('button.subcampo', { type: 'button', 'aria-current': String(v.disciplina === id), onclick: () => trocarDisciplinaVunesp(id) },
        h('span', null, nome), h('span.campo-num', null, n)));
    return h('ul.subcampos', { 'aria-label': 'Disciplinas' },
      botao('todas', 'Todas', contagem.questoes),
      presentes.map(d => botao(d.id, d.nome, contagem.total.get(d.id))));
  }


  function classeNavVunesp(ed, q) {
    const reg = store.get(idVunesp(ed, q));
    if (!reg) return '';
    if (reg.auto === 'certa') return 'is-ok';
    if (reg.auto === 'errada') return 'is-bad';
    if (reg.auto === 'parcial') return 'is-marcada';
    return reg.texto || reg.r ? 'is-escrita' : '';
  }

  function navegadorVunesp(ed) {
    const v = estado.vunesp;
    const cad = cadernoAtual(ed);
    const numeros = numerosDoCaderno(ed, cad);
    const redacao = temRedacao(ed, cad) && v.disciplina === 'todas';

    if (numeros && !numeros.length && !redacao) {
      return h('p.aviso', { id: 'q-nav' }, `Nenhuma questão de ${BQ.classificador.nome(v.disciplina)} neste caderno.`);
    }

    if (!numeros) {
      // Sem a numeração do caderno no catálogo, o aluno informa o número da questão.
      const entrada = h('input', {
        type: 'number', min: '1', max: '200', inputmode: 'numeric',
        onchange: ev => trocarQuestaoVunesp(Math.max(1, Math.min(200, Math.round(+ev.target.value) || 1))),
      });
      entrada.value = v.questao === 'redacao' ? '' : v.questao;
      return h('div.q-tools', { id: 'q-nav' },
        h('label.passo', null, 'Respondendo a questão nº', entrada),
        redacao ? h('button.chip', { type: 'button', 'aria-pressed': String(v.questao === 'redacao'), onclick: () => trocarQuestaoVunesp('redacao') }, 'Redação') : null);
    }

    const itens = redacao ? numeros.concat(['redacao']) : numeros;
    return h('nav.q-nav', { id: 'q-nav', 'aria-label': 'Questões do caderno' }, itens.map(q =>
      h('button', {
        type: 'button',
        class: classeNavVunesp(ed, q),
        'aria-current': String(q === v.questao),
        'aria-label': q === 'redacao' ? 'Redação' : `Questão ${q}`,
        onclick: () => trocarQuestaoVunesp(q),
      }, q === 'redacao' ? 'Red.' : q)));
  }

  // Índice do caderno baixado: null = caderno sem cópia local; undefined = ainda carregando.
  const indicesProntos = new Map();
  const indicesPedidos = new Map();
  const aguardandoTela = new Set();
  function pedirIndice(cad) {
    const url = cad.local.indice;
    if (!indicesPedidos.has(url)) {
      indicesPedidos.set(url, BQ.recortes.carregarIndice(url)
        .then(dados => indicesProntos.set(url, dados), () => indicesProntos.set(url, { erro: true })));
    }
    return indicesPedidos.get(url);
  }

  function indiceDoCaderno(cad) {
    if (!cad || !cad.local) return null;
    const url = cad.local.indice;
    if (!indicesProntos.has(url) && !aguardandoTela.has(url)) {
      aguardandoTela.add(url);
      pedirIndice(cad).then(() => {
        aguardandoTela.delete(url);
        if (estado.prova === 'vunesp' && cadernoAtual(edicaoAtual()) === cad) renderEnunciado();
      });
    }
    return indicesProntos.get(url);
  }

  // Para contar as disciplinas, carrega de uma vez os índices de todos os cadernos da instituição (~1 MB na Unesp).
  const instituicoesPedidas = new Set();
  function carregarIndicesDaInstituicao(inst) {
    if (instituicoesPedidas.has(inst)) return;
    instituicoesPedidas.add(inst);
    const cadernos = CATALOGO.filter(ed => ed.instituicao === inst).flatMap(ed => (ed.cadernos || []).filter(c => c.local));
    Promise.all(cadernos.map(pedirIndice)).then(() => {
      if (estado.prova === 'vunesp' && estado.vunesp.instituicao === inst) renderSidebar();
    });
  }

  // Disciplina e assunto de cada questão do caderno, calculados uma vez por caderno.
  const classesProntas = new Map();
  function classesDoCaderno(ed, cad) {
    if (classesProntas.has(cad)) return classesProntas.get(cad);
    const indice = indiceDoCaderno(cad);
    if (!indice || indice.erro) return indice === undefined ? undefined : null;
    const daParte = x => (x.parte || 0) === (cad.local.parte || 0); // arquivos com Prova I e Prova II
    const mapa = new Map();
    indice.questoes.filter(daParte).forEach(q => {
      if (mapa.has(q.n)) return;
      const apoios = indice.apoios.filter(a => a.de <= q.n && q.n <= a.ate && daParte(a));
      // Bloco de uma disciplina só (estrutura fixa do caderno, no catálogo): a disciplina vem dali.
      const fixa = Object.entries(cad.disciplinas || {}).find(([, faixa]) => (faixaParaLista(faixa) || []).includes(q.n));
      mapa.set(q.n, BQ.classificador.classificar({ apoio: apoios.map(a => a.texto).join(' '), texto: q.texto },
        areaDaQuestao(ed, cad, q.n), fixa ? fixa[0] : null, !!cad.disciplinas));
    });
    classesProntas.set(cad, mapa);
    return mapa;
  }

  function areaDaQuestao(ed, cad, numero) {
    for (const [campo, faixa] of Object.entries(faixasDe(ed, cad))) {
      if ((faixaParaLista(faixa) || []).includes(numero)) return campo;
    }
    const areas = (cad.areas || []).filter(a => a !== 'redacao');
    return areas.length === 1 ? areas[0] : null; // sem área conhecida, o classificador considera todas as disciplinas
  }

  function questaoRecortada(ed, cad) {
    const numero = estado.vunesp.questao;
    const indice = indiceDoCaderno(cad);
    if (indice === undefined) return h('div.skel', { 'aria-hidden': 'true' }, Array.from({ length: 6 }, () => h('i')));
    if (indice.erro) {
      return h('p.aviso', null, 'Não foi possível carregar as questões deste caderno. Use “Abrir caderno completo”.');
    }

    const ehRedacao = numero === 'redacao';
    const titulo = ehRedacao ? 'Redação' : `Questão ${numero}`;
    const daParte = x => (x.parte || 0) === (cad.local.parte || 0); // arquivos com Prova I e Prova II
    const q = ehRedacao ? indice.redacao : indice.questoes.find(x => x.n === numero && daParte(x));
    const apoios = ehRedacao ? [] : indice.apoios.filter(a => a.de <= numero && numero <= a.ate && daParte(a));
    const classe = q && !ehRedacao ? (classesDoCaderno(ed, cad) || new Map()).get(numero) : null;

    const cabecalho = h('div.q-sub', null,
      h('h2', null, titulo),
      classe && classe.disciplina ? h('span.tag.accent', null, BQ.classificador.nome(classe.disciplina)) : null,
      (classe && classe.tambem || []).map(d => h('span.tag.accent', { title: 'Um dos itens da questão cobra também esta disciplina' }, BQ.classificador.nome(d))),
      classe && classe.disciplina && classe.assunto
        ? h('span.tag', { title: 'Assunto estimado automaticamente pelas palavras do enunciado' }, classe.assunto) : null);

    if (!q) {
      return h('div', null, cabecalho,
        h('p.aviso', null, 'Esta parte não foi localizada no caderno. Use “Abrir caderno completo”.'));
    }
    const apoio = apoios.flatMap(a => a.recortes);
    return h('div', null, cabecalho, BQ.recortes.montar(cad.local.pdf, [
      { rotulo: apoio.length ? 'Texto de apoio' : null, recortes: apoio },
      { rotulo: null, recortes: q.recortes },
    ], `${titulo} — ${ed.instituicao} ${ed.edicao}, reproduzida do caderno de prova`));
  }

  function enunciadoVunesp() {
    const v = estado.vunesp;
    const ed = edicaoAtual();
    const wrap = h('div.q-wrap');

    if (!ed) {
      wrap.append(h('div.estado', null,
        h('h2', null, 'Nenhuma prova catalogada'),
        h('p', null, CATALOGO.length ? 'Não há edições para este filtro.' : 'O catálogo de provas da Vunesp ainda não foi carregado.')));
      return wrap;
    }

    const cadernos = ed.cadernos || [];
    const cad = cadernoAtual(ed);
    const fontes = (cad && cad.fontes) || [];
    const principal = fontes[0] || null;
    const embutida = fontes.find(f => f.embutir) || null;

    wrap.append(
      h('p.crumbs', null, 'Vunesp', h('span.sep', null, '·'), ed.fase || '2ª fase'),
      h('div.q-title-row', null,
        h('h1', null, `${ed.instituicao} ${ed.edicao}`),
        ed.formato ? h('span.tag.accent', null, ed.formato) : null),
      ed.estrutura ? h('p.ed-meta', null, ed.estrutura) : '');

    if (cadernos.length > 1) {
      wrap.append(h('div.chips', null, cadernos.map((c, i) =>
        h('button.chip', {
          type: 'button', 'aria-pressed': String(c === cad), onclick: () => trocarCaderno(i),
          disabled: v.disciplina !== 'todas' && c.local && !(numerosDoCaderno(ed, c) || []).length ? '' : null,
        }, c.rotulo || `Caderno ${i + 1}`))));
    }

    const local = cad && cad.local;
    // as fontes além da que está aberta (com recorte local, a aberta é a do arquivo, não a primeira da lista)
    const aberta = local && local.fonte ? fontes.find(f => f.nome === local.fonte && f.oficial === local.oficial) : principal;
    const outras = fontes.filter(f => f !== aberta);
    if (principal) {
      wrap.append(
        h('div.q-tools', null,
          local
            ? h('a.btn.sm', { href: local.pdf, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir caderno completo', icone('ext'))
            : h('a.btn.primary.sm', { href: principal.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir caderno em nova aba', icone('ext')),
          !local && embutida ? h('button.btn.sm', { type: 'button', onclick: () => { v.verPdf = !v.verPdf; renderEnunciado(); } }, v.verPdf ? 'Ocultar caderno' : 'Mostrar caderno aqui') : null,
          // com recorte local, vale a origem do arquivo aberto (a cópia do Objetivo, quando o site da Vunesp não deixou baixar o oficial)
          (local && local.fonte ? local.oficial : principal.oficial)
            ? h('span.tag.accent', null, `fonte oficial · ${local && local.fonte ? local.fonte : principal.nome}`)
            : h('span.tag.warn', {
              title: principal.oficial
                ? 'O caderno oficial existe (link em "Outras cópias"), mas o site da Vunesp não permite baixá-lo; este é o mesmo caderno na cópia de terceiros.'
                : 'O caderno oficial desta edição não foi localizado; esta é uma cópia hospedada por terceiros.',
            }, `cópia · ${local && local.fonte ? local.fonte : principal.nome}`)),
        outras.length
          ? h('p.outras', null, 'Outras fontes: ', outras.map((f, i) =>
              [i ? ' · ' : '', h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.nome)]))
          : ''); // append() escreveria "null" na tela
    }

    wrap.append(navegadorVunesp(ed));
    if (local && v.questao === null) return wrap; // nenhuma questão da disciplina escolhida neste caderno

    if (local) {
      wrap.append(questaoRecortada(ed, cad));
      return wrap;
    }

    if (!cad) {
      wrap.append(h('p.aviso', null,
        'O caderno desta edição não foi localizado em PDF. Use a página de resolução ao lado: ela traz os enunciados junto das respostas.'));
    } else if (embutida && v.verPdf) {
      if (embutida !== principal) {
        wrap.append(h('p.nota-rodape', null,
          `Exibindo a cópia de ${embutida.nome}: o site oficial não permite mostrar o arquivo dentro de outra página.`));
      }
      // Abre o leitor de PDF sem o painel de miniaturas e ajustado à largura.
      const src = embutida.url + (embutida.url.includes('#') ? '' : '#navpanes=0&view=FitH');
      wrap.append(h('iframe.pdf', { src, title: `Caderno de prova — ${ed.instituicao} ${ed.edicao}`, loading: 'lazy' }));
    } else if (!embutida) {
      const outro = cadernos.findIndex(c => c !== cad && c.fontes.some(f => f.embutir));
      wrap.append(h('div.aviso', null,
        h('p', null, 'O site oficial não permite mostrar este caderno dentro de outra página. Abra em nova aba e deixe lado a lado com o campo de resposta.'),
        outro >= 0
          ? h('button.btn.sm', { type: 'button', onclick: () => trocarCaderno(outro) }, `Mostrar “${cadernos[outro].rotulo}” aqui`)
          : null));
    }

    return wrap;
  }

  // ---------- Vunesp: respostas-modelo ----------
  // data/respostas-modelo/indice.json lista os cadernos (caminho do índice em data/questoes/) que têm
  // respostas; cada um tem um arquivo no mesmo caminho relativo, com as respostas por "parte:número".
  let listaDeModelos = null;
  const modelos = new Map(); // caminho do índice -> objeto carregado, null (não tem) ou undefined (carregando)
  function modeloDaQuestao(local, numero) {
    if (!modelos.has(local.indice)) {
      modelos.set(local.indice, undefined);
      if (!listaDeModelos) {
        listaDeModelos = fetch('data/respostas-modelo/indice.json')
          .then(r => (r.ok ? r.json() : []), () => []).then(lista => new Set(lista));
      }
      listaDeModelos
        .then(lista => (lista.has(local.indice)
          ? fetch('data/respostas-modelo/' + local.indice.replace(/^data\/questoes\//, '')).then(r => (r.ok ? r.json() : null), () => null)
          : null))
        .then(dados => {
          modelos.set(local.indice, dados);
          const atual = cadernoAtual(edicaoAtual());
          if (dados && estado.prova === 'vunesp' && atual && atual.local && atual.local.indice === local.indice) renderResposta();
        });
    }
    const dados = modelos.get(local.indice);
    return (dados && dados.questoes[`${local.parte}:${numero}`]) || null;
  }

  // ---------- Vunesp: gabarito das objetivas ----------
  // data/gabaritos/ tem o mesmo formato (indice.json + um arquivo por caderno), com a letra por
  // "parte:número". As chaves listadas em "oficial" vêm do gabarito da Vunesp (versão do dia da
  // prova); as demais, das resoluções comentadas do Curso Objetivo (não oficial).
  let listaDeGabaritos = null;
  const gabaritos = new Map();
  function gabaritoDaQuestao(local, numero) {
    if (!gabaritos.has(local.indice)) {
      gabaritos.set(local.indice, undefined);
      if (!listaDeGabaritos) {
        listaDeGabaritos = fetch('data/gabaritos/indice.json')
          .then(r => (r.ok ? r.json() : []), () => []).then(lista => new Set(lista));
      }
      listaDeGabaritos
        .then(lista => (lista.has(local.indice)
          ? fetch('data/gabaritos/' + local.indice.replace(/^data\/questoes\//, '')).then(r => (r.ok ? r.json() : null), () => null)
          : null))
        .then(dados => {
          gabaritos.set(local.indice, dados);
          const atual = cadernoAtual(edicaoAtual());
          if (dados && estado.prova === 'vunesp' && atual && atual.local && atual.local.indice === local.indice) renderResposta();
        });
    }
    const dados = gabaritos.get(local.indice);
    return (dados && dados.questoes[`${local.parte}:${numero}`]) || null;
  }
  // 'oficial', 'anulada' ou 'objetivo' (só faz sentido depois que o arquivo do caderno chegou)
  function origemDoGabarito(local, numero) {
    const dados = gabaritos.get(local.indice);
    const chave = `${local.parte}:${numero}`;
    if (!dados) return null;
    if ((dados.anuladas || []).includes(chave)) return 'anulada';
    return (dados.oficial || []).includes(chave) ? 'oficial' : 'objetivo';
  }

  function respostaVunesp() {
    const v = estado.vunesp;
    const ed = edicaoAtual();
    if (!ed || v.questao === null) return [];
    const id = idVunesp(ed);
    const reg = store.get(id) || {};
    const ehRedacao = v.questao === 'redacao';
    const cad = cadernoAtual(ed);
    const gabarito = !ehRedacao && cad && cad.local ? gabaritoDaQuestao(cad.local, v.questao) : null;
    const origem = !ehRedacao && cad && cad.local ? origemDoGabarito(cad.local, v.questao) : null;
    const objetiva = (ed.formato === 'objetiva' || !!gabarito || origem === 'anulada') && !ehRedacao;
    const notaDoGabarito = origem === 'oficial'
      ? 'Gabarito oficial da Vunesp (versão do dia da prova, antes dos recursos).'
      : 'Gabarito tirado da resolução comentada do Curso Objetivo (não é o gabarito oficial da Vunesp).';

    const marcarNav = () => {
      const botao = document.querySelector('#q-nav button[aria-current="true"]');
      if (botao && botao.closest('nav')) botao.className = classeNavVunesp(ed, v.questao);
    };

    const cartaoResposta = h('div.card', null,
      h('h2', null, 'Sua resposta', h('span.tag', null, ehRedacao ? 'Redação' : `Questão ${v.questao}`)),
      objetiva
        ? h('div.acoes', { style: 'margin:0 0 12px' }, seg(['A', 'B', 'C', 'D', 'E'].map(l => ({ v: l, t: l })), reg.r || null,
            letra => { store.set(id, { r: reg.r === letra ? null : letra, conf: false, ok: null }); renderResposta(); marcarNav(); }))
        : null,
      gabarito && !reg.conf
        ? h('div.acoes', { style: 'margin:0 0 12px' },
            h('button.btn.primary.sm', { type: 'button', disabled: !reg.r, onclick: () => {
              const ok = reg.r === gabarito;
              store.set(id, { conf: true, ok, auto: ok ? 'certa' : 'errada' });
              renderResposta(); marcarNav(); renderResumo();
            } }, 'Conferir resposta'))
        : null,
      gabarito && reg.conf
        ? h('div', { style: 'margin:0 0 12px' },
            reg.ok
              ? h('p.veredito.ok', null, `Você acertou: ${gabarito}.`)
              : h('p.veredito.bad', null, `Você marcou ${reg.r}. A resposta é ${gabarito}.`),
            h('p.nota-rodape', null, notaDoGabarito))
        : null,
      origem === 'anulada' ? h('p.veredito.info', { style: 'margin:0 0 12px' }, 'Questão anulada pela Vunesp.') : null,
      campoDeTexto(objetiva ? 'Justificativa' : null, reg.texto,
        ehRedacao ? 'Escreva sua redação…' : 'Escreva sua resposta como escreveria na prova…',
        valor => { store.set(id, { texto: valor }); marcarNav(); },
        objetiva ? '' : 'alto'),
      h('div.auto', null,
        h('span', null, 'Depois de ver a resolução:'),
        seg([{ v: 'certa', t: 'Acertei' }, { v: 'parcial', t: 'Parcial' }, { v: 'errada', t: 'Errei' }], reg.auto || null,
          valor => { store.set(id, { auto: reg.auto === valor ? null : valor }); renderResposta(); marcarNav(); renderResumo(); }, 'sm')),
      h('p.nota-rodape', null, 'Salvo automaticamente neste navegador.'));

    const oficiais = ed.oficiais || [];
    const resolucoes = ed.resolucoes || [];
    const link = (item, tipo) => h('li', null,
      h('a', { href: item.url, target: '_blank', rel: 'noopener noreferrer' },
        h('span', null, item.fonte || tipo, ' ', h('small', null, tipo)), icone('ext')));

    // Resposta-modelo (gerada por IA), quando existe para esta questão: fica atrás de um botão,
    // para a estudante escrever a dela antes de comparar.
    const modelo = !ehRedacao && cad && cad.local ? modeloDaQuestao(cad.local, v.questao) : null;
    let blocoModelo = null;
    if (modelo && gabarito) {
      // objetiva: a resolução comentada só aparece depois de conferir a resposta
      blocoModelo = reg.conf
        ? h('div.resolucao', null,
            h('div.resolucao-texto', { html: md(modelo.resposta) }),
            modelo.confianca !== 'alta' && modelo.pendencia
              ? h('p.resolucao-alerta', null, h('b', null, modelo.confianca === 'baixa' ? 'Atenção. ' : 'Questão discutível. '), modelo.pendencia) : null,
            h('p.nota-rodape', null, `Resolução gerada por IA a partir do caderno e do gabarito ${origem === 'oficial' ? 'oficial da Vunesp' : 'do Curso Objetivo (não oficial)'}, sem revisão humana. Pode conter erros.`))
        : h('p.nota-rodape', { style: 'margin:0 0 12px' }, 'A resolução comentada aparece depois que você conferir a resposta.');
    } else if (modelo && reg.modelo) {
      blocoModelo = h('div.resolucao', null,
        h('div.resolucao-texto', { html: md(modelo.resposta) }),
        modelo.confianca !== 'alta' && modelo.pendencia
          ? h('p.resolucao-alerta', null, h('b', null, modelo.confianca === 'baixa' ? 'Atenção. ' : 'Questão aberta ou discutível. '), modelo.pendencia) : null,
        h('p.nota-rodape', null, 'Resposta-modelo gerada por IA a partir da imagem do caderno, sem revisão humana. Não há resposta oficial publicada: use como referência, não como gabarito. Pode conter erros.'),
        h('div.acoes', null, h('button.btn.ghost.sm', { type: 'button', onclick: () => { store.set(id, { modelo: false }); renderResposta(); } }, 'Ocultar resposta-modelo')));
    } else if (modelo) {
      blocoModelo = h('div.gabarito.fechado', null,
        h('span', null, reg.texto ? 'Compare com a sua resposta.' : 'Escreva a sua resposta antes de comparar.'),
        h('button.btn.primary.sm', { type: 'button', onclick: () => { store.set(id, { modelo: true }); renderResposta(); } }, 'Ver resposta-modelo'));
    }

    const cartaoResolucao = h('div.card', null,
      h('h2', null, 'Resolução', modelo ? h('span.tag.accent', null, gabarito ? 'comentada' : 'resposta-modelo') : null),
      blocoModelo,
      oficiais.length || resolucoes.length
        ? h('ul.links', null, oficiais.map(i => link(i, 'resposta oficial')), resolucoes.map(i => link(i, 'resolução comentada')))
        : h('p.nota-rodape', { style: 'margin:0 0 12px' }, 'Nenhuma resolução catalogada para esta edição.'),
      campoDeTexto('Suas anotações da correção', reg.nota,
        'O que faltou na sua resposta? O que a banca esperava?',
        valor => store.set(id, { nota: valor })));

    return [cartaoResposta, cartaoResolucao];
  }

  // ---------- Render ----------
  function renderSidebar() {
    const fonte = estado.prova === 'enem'
      ? 'ENEM (INEP): 2011 a 2025 recortados dos cadernos oficiais, com a reaplicação de 2021 a 2025 e a aplicação de Belém (2025); 2009 e 2010 pela API aberta enem.dev. Disciplina e assunto são estimados automaticamente.'
      : 'Cadernos oficiais da Vunesp e da Unesp; onde o oficial não pode ser baixado, cópias de terceiros. Disciplina e assunto são estimados automaticamente.';
    elSidebar.replaceChildren(
      h('div', null,
        h('span.side-label', null, 'Prova'),
        seg([{ v: 'enem', t: 'ENEM' }, { v: 'vunesp', t: 'Vunesp' }], estado.prova, trocarProva)),
      ...(estado.prova === 'enem' ? sidebarEnem() : sidebarVunesp()),
      h('p.side-foot', null, fonte));
  }

  function renderEnunciado() {
    elEnunciado.replaceChildren(estado.prova === 'enem' ? enunciadoEnem() : enunciadoVunesp());
  }

  function renderResposta() {
    elResposta.replaceChildren(...(estado.prova === 'enem' ? respostaEnem() : respostaVunesp()));
  }

  function renderResumo() {
    let conferidas = 0;
    let acertos = 0;
    let discursivas = 0;
    for (const id of store.ids()) {
      const reg = store.get(id);
      if (reg.conf) { conferidas++; if (reg.ok) acertos++; } // ENEM e objetivas da Vunesp com gabarito
      else if (id.startsWith('vunesp:') && reg.texto) discursivas++;
    }
    const partes = [];
    if (conferidas) {
      partes.push(h('span', null, h('b', null, conferidas), ` ${conferidas === 1 ? 'conferida' : 'conferidas'} · `,
        h('b', null, `${Math.round((acertos / conferidas) * 100)}%`), ' de acerto'));
    }
    if (discursivas) partes.push(h('span', null, conferidas ? ' · ' : '', h('b', null, discursivas), ` ${discursivas === 1 ? 'discursiva' : 'discursivas'}`));
    elResumo.replaceChildren(...partes);
  }

  function renderTudo() {
    renderSidebar();
    renderEnunciado();
    renderResposta();
    renderResumo();
  }

  function trocarProva(prova) {
    if (prova === estado.prova) return;
    estado.prova = prova;
    salvarUi();
    irAoTopo();
    if (prova === 'enem' && !estado.enem.questoes.length) carregarEnem();
    else renderTudo();
  }

  // ---------- Tema, menu e teclado ----------
  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    btnTema.setAttribute('aria-checked', String(tema === 'dark'));
  }

  btnTema.addEventListener('click', () => {
    const novo = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    aplicarTema(novo);
    try { localStorage.setItem('bq:tema', novo); } catch (e) { /* segue sem lembrar */ }
  });

  btnMenu.addEventListener('click', () => {
    const abrir = !document.body.classList.contains('menu-aberto');
    document.body.classList.toggle('menu-aberto', abrir);
    elScrim.hidden = !abrir;
    btnMenu.setAttribute('aria-expanded', String(abrir));
  });
  elScrim.addEventListener('click', fecharMenu);

  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'Escape') { fecharMenu(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || estado.prova !== 'enem') return;
    const q = questaoAtual();
    if (!q) return;
    if (ev.key === 'ArrowLeft') irPara(vizinha(-1));
    else if (ev.key === 'ArrowRight') irPara(vizinha(1));
    else if (/^[a-e]$/i.test(ev.key)) escolher(q, ev.key.toUpperCase());
    else if (ev.key === 'Enter' && ev.target.tagName !== 'BUTTON' && ev.target.tagName !== 'A') conferir(q);
  });

  // ---------- Conta e sincronização ----------
  const btnConta = document.getElementById('btn-conta');
  const dlgConta = document.getElementById('dlg-conta');
  const SYNC = BQ.sync;

  function textoSituacao(info) {
    if (info.estado === 'sincronizando') return 'Sincronizando…';
    if (info.estado === 'offline') return 'Sem internet. As mudanças sobem quando a conexão voltar.';
    if (info.estado === 'erro') return 'Não foi possível sincronizar agora. Tentaremos de novo.';
    if (info.ultima) {
      const hora = info.ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return info.pendentes ? `Última sincronização às ${hora}.` : `Tudo sincronizado às ${hora}.`;
    }
    return 'Conta conectada.';
  }

  function renderConta() {
    const info = SYNC.info();
    btnConta.dataset.estado = info.logado ? info.estado : 'fora';
    if (info.logado) {
      btnConta.replaceChildren(h('span.ponto', { 'aria-hidden': 'true' }), h('span.email', null, info.email));
      btnConta.setAttribute('aria-label', `Conta ${info.email}: ${textoSituacao(info)}`);
      btnConta.title = textoSituacao(info);
    } else {
      btnConta.replaceChildren(h('span.ponto', { 'aria-hidden': 'true' }), h('span', null, 'Entrar'));
      btnConta.setAttribute('aria-label', 'Entrar para sincronizar o progresso');
      btnConta.title = 'Entre para levar o progresso a outros aparelhos';
    }
    if (dlgConta.open && info.logado && dlgConta.dataset.tela === 'conta') telaConta();
  }

  function telaEntrar() {
    dlgConta.dataset.tela = 'entrar';
    const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: 'false' });
    const senha = h('input', { type: 'password', name: 'senha', autocomplete: 'current-password', required: true });
    const erro = h('p.erro', { role: 'alert', hidden: true });
    const btnEntrar = h('button.btn.primary', { type: 'submit' }, 'Entrar');
    const form = h('form', { method: 'dialog' },
      h('h2', { id: 'dlg-conta-titulo' }, 'Entrar'),
      h('p', null, 'Com a conta aberta, as respostas e anotações acompanham você em qualquer aparelho. Sem entrar, tudo continua salvo só neste navegador.'),
      h('label', null, 'E-mail', email),
      h('label', null, 'Senha', senha),
      erro,
      h('div.acoes', null,
        h('button.btn.ghost', { type: 'button', onclick: () => dlgConta.close() }, 'Cancelar'),
        btnEntrar));
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      erro.hidden = true;
      btnEntrar.disabled = true;
      btnEntrar.textContent = 'Entrando…';
      try {
        await SYNC.entrar(email.value, senha.value);
        dlgConta.close();
      } catch (e) {
        erro.textContent = e.message;
        erro.hidden = false;
        btnEntrar.disabled = false;
        btnEntrar.textContent = 'Entrar';
      }
    });
    dlgConta.replaceChildren(form);
    return email;
  }

  function telaConta() {
    dlgConta.dataset.tela = 'conta';
    const info = SYNC.info();
    dlgConta.replaceChildren(h('div.conta-corpo', null,
      h('h2', { id: 'dlg-conta-titulo' }, 'Sua conta'),
      h('p', null, h('strong', null, info.email)),
      h('p', { 'aria-live': 'polite' }, textoSituacao(info)),
      h('div.acoes', null,
        h('button.btn.ghost', { type: 'button', onclick: async () => { await SYNC.sair(); dlgConta.close(); } }, 'Sair'),
        h('button.btn', { type: 'button', onclick: () => SYNC.sincronizar() }, 'Sincronizar agora'),
        h('button.btn.primary', { type: 'button', onclick: () => dlgConta.close() }, 'Fechar'))));
  }

  btnConta.addEventListener('click', () => {
    const foco = SYNC.info().logado ? (telaConta(), null) : telaEntrar();
    dlgConta.showModal();
    if (foco) foco.focus();
  });
  dlgConta.addEventListener('click', ev => { if (ev.target === dlgConta) dlgConta.close(); }); // clique fora

  SYNC.aoMudar(renderConta);
  renderConta();

  // Progresso que chegou de outro aparelho: redesenha, sem atrapalhar quem está digitando.
  window.addEventListener('bq:registros-remotos', () => {
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !dlgConta.contains(el)) {
      renderSidebar();
      renderResumo();
      if (estado.prova === 'enem') atualizarNavegador();
    } else {
      renderTudo();
    }
  });

  // ---------- Início ----------
  aplicarTema(document.documentElement.getAttribute('data-theme') || 'light');
  ajustarCaderno();
  if (estado.prova === 'enem') carregarEnem();
  else renderTudo();

  ENEM.anosComResolucao().then(anos => {
    estado.enem.anosComResolucao = anos;
    if (estado.prova === 'enem') renderSidebar();
  });

  ENEM.listarAnos().then(anos => {
    estado.enem.anos = anos;
    if (estado.prova === 'enem') renderSidebar();
  }).catch(() => { /* fica com a lista padrão de anos */ });
})();
