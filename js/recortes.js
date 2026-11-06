// Mostra uma questão recortando-a do PDF da prova (pdf.js), a partir dos retângulos
// gravados por ferramentas/extrair-questoes.py: [página, x0, y0, x1, y1] em pontos.
(function () {
  'use strict';

  const BQ = window.BQ;
  const { h } = BQ;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  // Tamanho máximo na tela: 1 pt do PDF vira 1,9 px, para o texto de 9,5 pt das provas ficar com ~18 px.
  const PX_POR_PONTO = 1.9;
  const MAX_DOCUMENTOS = 3;

  let bibliotecaPromise = null;
  function carregarBiblioteca() {
    if (!bibliotecaPromise) {
      bibliotecaPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDFJS + 'pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        script.onerror = () => { bibliotecaPromise = null; reject(new Error('Não foi possível carregar o leitor de PDF.')); };
        document.head.append(script);
      });
    }
    return bibliotecaPromise;
  }

  const documentos = new Map(); // url -> Promise do documento aberto
  async function abrir(url) {
    const pdfjs = await carregarBiblioteca();
    if (!documentos.has(url)) {
      if (documentos.size >= MAX_DOCUMENTOS) {
        const [antiga, promessa] = documentos.entries().next().value;
        documentos.delete(antiga);
        promessa.then(doc => doc.destroy()).catch(() => {});
      }
      const promessa = pdfjs.getDocument({ url }).promise;
      promessa.catch(() => documentos.delete(url));
      documentos.set(url, promessa);
    }
    return documentos.get(url);
  }

  async function desenhar(canvas, url, recorte) {
    const [pagina, x0, y0, x1, y1] = recorte;
    const doc = await abrir(url);
    const page = await doc.getPage(pagina);
    if (!canvas.isConnected) return; // o aluno já foi para outra questão
    const densidade = Math.min(window.devicePixelRatio || 1, 2.5);
    const escala = ((canvas.clientWidth || 600) * densidade) / (x1 - x0);
    canvas.width = Math.round((x1 - x0) * escala);
    canvas.height = Math.round((y1 - y0) * escala);
    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport: page.getViewport({ scale: escala }),
      transform: [1, 0, 0, 1, -x0 * escala, -y0 * escala],
    }).promise;
    canvas.classList.add('pronto');
  }

  // grupos: [{ rotulo: 'Texto de apoio' | null, recortes: [[pag, x0, y0, x1, y1], ...] }]
  function montar(url, grupos, descricao) {
    const folha = h('div.folha', { role: 'img', 'aria-label': descricao || 'Questão reproduzida do caderno de prova' });
    const pendentes = [];
    for (const grupo of grupos) {
      if (!grupo.recortes.length) continue;
      if (grupo.rotulo) folha.append(h('p.folha-rotulo', null, grupo.rotulo));
      for (const recorte of grupo.recortes) {
        const largura = recorte[3] - recorte[1];
        const altura = recorte[4] - recorte[2];
        const canvas = h('canvas.recorte', {
          style: `width:min(100%, ${Math.round(largura * PX_POR_PONTO)}px); aspect-ratio:${largura.toFixed(1)} / ${altura.toFixed(1)}`,
        });
        folha.append(canvas);
        pendentes.push([canvas, recorte]);
      }
    }

    // Desenha depois que a folha entrou na página (a largura do canvas depende do layout).
    // setTimeout em vez de requestAnimationFrame: este não dispara com a aba em segundo plano.
    setTimeout(async () => {
      try {
        for (const [canvas, recorte] of pendentes) {
          if (!folha.isConnected) return;
          await desenhar(canvas, url, recorte);
        }
      } catch (erro) {
        if (!folha.isConnected) return;
        folha.replaceChildren(h('p.folha-erro', null,
          'Não foi possível mostrar a questão a partir do PDF. ',
          h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o caderno completo')));
      }
    }, 0);
    return folha;
  }

  // Índices por caderno (data/questoes/...json), carregados sob demanda.
  const indices = new Map();
  function carregarIndice(url) {
    if (!indices.has(url)) {
      const promessa = fetch(url).then(r => {
        if (!r.ok) throw new Error(`Índice do caderno indisponível (${r.status}).`);
        return r.json();
      });
      promessa.catch(() => indices.delete(url));
      indices.set(url, promessa);
    }
    return indices.get(url);
  }

  BQ.recortes = { montar, carregarIndice };
})();
