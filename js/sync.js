// Conta e sincronização do progresso com o Supabase (Auth + REST), sem biblioteca.
// Os registros continuam no localStorage (funciona offline); com a conta aberta, cada mudança
// sobe para a tabela `registros` e as mudanças feitas em outros aparelhos descem.
// Em cada questão vale o registro mais recente (campo t); o banco também garante isso.
(function () {
  'use strict';

  const BQ = window.BQ;
  const URL_BASE = 'https://jppthizijnsmogdwjpxn.supabase.co';
  // Chave pública ("publishable"): pode ficar no código; o que protege os dados é o RLS da tabela.
  const CHAVE = 'sb_publishable_8qKmld8snWVdfOhzrYJVcg_t12b63a5';
  const CHAVE_SESSAO = 'bq:sessao:v1';
  const CHAVE_ESTADO = 'bq:sync:v1';
  const POR_PAGINA = 1000; // limite padrão do PostgREST por requisição

  let sessao = BQ.lerLocal(CHAVE_SESSAO, null);
  let marca = BQ.lerLocal(CHAVE_ESTADO, {}); // { usuario, desde }
  const situacao = { estado: sessao ? 'ok' : 'fora', ultima: null, erro: null };
  const ouvintes = [];
  const avisar = () => ouvintes.forEach(f => f(BQ.sync.info()));

  function mudarSituacao(estado, erro) {
    situacao.estado = estado;
    situacao.erro = erro || null;
    if (estado === 'ok') situacao.ultima = new Date();
    avisar();
  }

  async function auth(caminho, corpo, token) {
    const resp = await fetch(URL_BASE + '/auth/v1/' + caminho, {
      method: 'POST',
      headers: Object.assign({ apikey: CHAVE, 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(corpo || {}),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const erro = new Error(dados.error_description || dados.msg || dados.message || 'Falha na autenticação');
      erro.status = resp.status;
      erro.codigo = dados.error_code || dados.error;
      throw erro;
    }
    return dados;
  }

  function guardarSessao(d) {
    sessao = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
      usuario: d.user.id,
      email: d.user.email,
    };
    BQ.gravarLocal(CHAVE_SESSAO, sessao);
  }

  function encerrarLocalmente() {
    sessao = null;
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada a fazer */ }
    mudarSituacao('fora');
  }

  let renovando = null;
  async function token() {
    if (!sessao) throw new Error('Sem sessão');
    if (sessao.expires_at - 60 > Date.now() / 1000) return sessao.access_token;
    if (!renovando) {
      renovando = auth('token?grant_type=refresh_token', { refresh_token: sessao.refresh_token })
        .then(guardarSessao)
        .catch(erro => {
          // Token de renovação recusado: a sessão acabou (senha trocada, conta removida…).
          if (erro.status === 400 || erro.status === 401) encerrarLocalmente();
          throw erro;
        })
        .finally(() => { renovando = null; });
    }
    await renovando;
    return sessao.access_token;
  }

  async function rest(caminho, opcoes) {
    const resp = await fetch(URL_BASE + '/rest/v1/' + caminho, Object.assign({}, opcoes, {
      headers: Object.assign({ apikey: CHAVE, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
        (opcoes && opcoes.headers) || {}),
    }));
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      const erro = new Error(dados.message || 'Erro ' + resp.status);
      erro.status = resp.status;
      throw erro;
    }
    return resp.status === 204 || resp.status === 201 ? null : resp.json();
  }

  async function baixar() {
    let recebidos = 0;
    for (;;) {
      const filtro = marca.desde ? '&atualizado_em=gte.' + encodeURIComponent(marca.desde) : '';
      const linhas = await rest(`registros?select=id,dados,t,atualizado_em&order=atualizado_em.asc,id.asc&limit=${POR_PAGINA}${filtro}`);
      recebidos += BQ.store.aplicarRemotos(linhas);
      if (linhas.length) {
        const ultimo = linhas[linhas.length - 1].atualizado_em;
        // Com o filtro "gte", uma página cheia de linhas com o mesmo instante nunca avançaria.
        if (ultimo === marca.desde && linhas.length === POR_PAGINA) break;
        marca.desde = ultimo;
        BQ.gravarLocal(CHAVE_ESTADO, marca);
      }
      if (linhas.length < POR_PAGINA) break;
    }
    return recebidos;
  }

  async function enviar() {
    const ids = BQ.store.pendentes();
    for (let i = 0; i < ids.length; i += 500) {
      const lote = ids.slice(i, i + 500).map(id => {
        const reg = BQ.store.get(id);
        if (!reg) return null;
        const { t, ...dados } = reg;
        return { id, dados, t };
      }).filter(Boolean);
      if (!lote.length) continue;
      await rest('registros?on_conflict=user_id,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(lote),
      });
      BQ.store.confirmarEnvio(lote);
    }
  }

  let emCurso = null;
  let deNovo = false;
  function sincronizar() {
    if (!sessao) return Promise.resolve();
    if (emCurso) { deNovo = true; return emCurso; }
    emCurso = (async () => {
      mudarSituacao('sincronizando');
      try {
        do {
          deNovo = false;
          const recebidos = await baixar();
          await enviar();
          if (recebidos) window.dispatchEvent(new CustomEvent('bq:registros-remotos', { detail: { recebidos } }));
        } while (deNovo && sessao);
        if (sessao) mudarSituacao('ok');
      } catch (erro) {
        if (sessao) mudarSituacao(navigator.onLine === false ? 'offline' : 'erro', erro.message);
      } finally {
        emCurso = null;
      }
    })();
    return emCurso;
  }

  const sincronizarLogo = BQ.debounce(sincronizar, 1500);

  BQ.sync = {
    info: () => ({
      logado: !!sessao,
      email: sessao ? sessao.email : null,
      estado: situacao.estado,
      ultima: situacao.ultima,
      erro: situacao.erro,
      pendentes: BQ.store.pendentes().length,
    }),
    aoMudar: f => ouvintes.push(f),
    sincronizar,

    async entrar(email, senha) {
      let d;
      try {
        d = await auth('token?grant_type=password', { email: email.trim(), password: senha });
      } catch (erro) {
        if (erro.codigo === 'invalid_credentials' || erro.status === 400) throw new Error('E-mail ou senha incorretos.');
        if (erro.codigo === 'email_not_confirmed') throw new Error('Este e-mail ainda não foi confirmado.');
        if (erro.status === 429) throw new Error('Muitas tentativas. Espere um pouco e tente de novo.');
        throw new Error(navigator.onLine === false ? 'Sem internet no momento.' : 'Não foi possível entrar agora.');
      }
      guardarSessao(d);
      // Outra pessoa (ou primeira vez neste aparelho): baixa tudo e envia tudo o que já existe aqui.
      if (marca.usuario !== sessao.usuario) {
        marca = { usuario: sessao.usuario, desde: null };
        BQ.gravarLocal(CHAVE_ESTADO, marca);
        BQ.store.marcarTodosPendentes();
      }
      await sincronizar();
    },

    async sair() {
      const t = sessao && sessao.access_token;
      encerrarLocalmente();
      if (t) auth('logout', {}, t).catch(() => { /* a sessão local já foi encerrada */ });
    },
  };

  // Gatilhos: mudança local, voltar à aba, voltar a internet, e ao abrir a página.
  BQ.store.aoMudar(() => { if (sessao) { avisar(); sincronizarLogo(); } });
  document.addEventListener('visibilitychange', () => {
    if (!sessao) return;
    if (document.hidden) sincronizarLogo.flush();
    else sincronizar();
  });
  window.addEventListener('online', () => sincronizar());
  if (sessao) sincronizar();
})();
