// Utilitários compartilhados: criação de DOM, markdown mínimo, registros do aluno e cache.
(function () {
  'use strict';

  const BQ = (window.BQ = window.BQ || {});

  // h('button.btn.primary', { onclick }, 'Texto', outroNo)
  BQ.h = function (seletor, attrs, ...filhos) {
    const partes = seletor.split('.');
    const el = document.createElement(partes[0] || 'div');
    if (partes.length > 1) el.className = partes.slice(1).join(' ');
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
        else if (k === 'html') el.innerHTML = v; // só recebe HTML produzido por BQ.md (já escapado)
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    const anexar = f => {
      if (f === null || f === undefined || f === false) return;
      if (Array.isArray(f)) f.forEach(anexar);
      else el.append(f instanceof Node ? f : document.createTextNode(String(f)));
    };
    filhos.forEach(anexar);
    return el;
  };

  BQ.escapeHtml = s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function imagemHtml(url, alt) {
    if (/broken-image/.test(url)) return '<span class="img-faltando">Imagem indisponível na fonte</span>';
    if (!/^https:\/\//i.test(url)) return '';
    return `<img class="q-img" src="${BQ.escapeHtml(url)}" alt="${BQ.escapeHtml(alt || 'Imagem da questão')}" loading="lazy">`;
  }
  BQ.imagemHtml = imagemHtml;

  // Markdown mínimo, suficiente para os enunciados: parágrafos, quebras, negrito, itálico, imagens e links.
  // Todo o texto é escapado antes de virar HTML.
  BQ.md = function (fonte) {
    if (!fonte) return '';
    const guardados = [];
    const guardar = html => `\u0000${guardados.push(html) - 1}\u0000`;

    let s = String(fonte).replace(/\r\n?/g, '\n');
    s = s.replace(/!\[([^\]]*)\]\(\s*([^\s)]+)\s*\)/g, (m, alt, url) => guardar(imagemHtml(url, alt)));
    s = s.replace(/\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/g, (m, texto, url) =>
      guardar(`<a href="${BQ.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${BQ.escapeHtml(texto)}</a>`));

    s = BQ.escapeHtml(s);
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(“"])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?”"]|$)/gm, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(“"])_([^_\s][^_\n]*?)_(?=[\s).,;:!?”"]|$)/gm, '$1<em>$2</em>');

    const html = s.split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(bloco => {
      if (/^(\u0000\d+\u0000\s*)+$/.test(bloco)) return `<figure class="q-fig">${bloco}</figure>`;
      return `<p>${bloco.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html.replace(/\u0000(\d+)\u0000/g, (m, i) => guardados[+i]);
  };

  BQ.debounce = function (fn, ms) {
    let t = null;
    const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
    d.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
    return d;
  };

  BQ.lerLocal = function (chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) { return padrao; }
  };
  BQ.gravarLocal = function (chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* armazenamento indisponível */ }
  };

  // Registros do aluno (resposta, conferência, anotações), por id de questão.
  // Ficam só neste navegador.
  const CHAVE_REGISTROS = 'bq:registros:v1';
  const registros = BQ.lerLocal(CHAVE_REGISTROS, {});
  const persistir = BQ.debounce(() => BQ.gravarLocal(CHAVE_REGISTROS, registros), 300);
  window.addEventListener('pagehide', () => persistir.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistir.flush(); });

  BQ.store = {
    get: id => registros[id] || null,
    set(id, mudancas) {
      registros[id] = Object.assign({}, registros[id], mudancas, { t: Date.now() });
      persistir();
      return registros[id];
    },
    ids: () => Object.keys(registros),
  };

  // Cache das questões baixadas (IndexedDB; cai para memória se o navegador bloquear).
  const memoria = new Map();
  let bancoPromise = null;
  function abrirBanco() {
    if (bancoPromise) return bancoPromise;
    bancoPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open('banco-questoes', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('cache');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return bancoPromise;
  }

  BQ.cache = {
    async get(chave) {
      if (memoria.has(chave)) return memoria.get(chave);
      const db = await abrirBanco();
      if (!db) return undefined;
      return new Promise(resolve => {
        try {
          const req = db.transaction('cache').objectStore('cache').get(chave);
          req.onsuccess = () => { if (req.result !== undefined) memoria.set(chave, req.result); resolve(req.result); };
          req.onerror = () => resolve(undefined);
        } catch (e) { resolve(undefined); }
      });
    },
    async set(chave, valor) {
      memoria.set(chave, valor);
      const db = await abrirBanco();
      if (!db) return;
      try { db.transaction('cache', 'readwrite').objectStore('cache').put(valor, chave); } catch (e) { /* segue só em memória */ }
    },
  };
})();
