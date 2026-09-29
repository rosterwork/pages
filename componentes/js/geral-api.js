/* ============================================================
   API — comunicação autenticada com o banco (compartilhada)
   Um único lugar para a URL/chave do Supabase, o token da sessão e
   a renovação automática. RosterWork.apiFetch(caminho, opcoes)
   injeta a chave e o token; se o token tiver vencido (401), renova
   com o refresh_token e refaz a chamada uma vez — falhando a
   renovação, encerra a sessão (RosterWork.expirarSessao). Também
   concentra a renovação proativa (usada pelo vigia de sessão) e a
   saída (logout). Ver js/index-sessao-vigia.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

  /* ---------- sessão (sessionStorage) ---------- */

  function obterSessao() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) { return null; }
  }

  function obterToken() {
    var s = obterSessao();
    return s && s.access_token ? s.access_token : null;
  }

  function salvarSessao(accessToken, refreshToken) {
    sessionStorage.setItem('rosterwork_session', JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken
    }));
  }

  function limparSessao() {
    /* limpa TUDO: em PC compartilhado nenhuma chave pode vazar ao próximo usuário */
    sessionStorage.clear();
  }

  /* ---------- saída (logout voluntário) ---------- */

  function sair() {
    var token = obterToken();
    if (token) {
      /* keepalive: a chamada de logout completa mesmo durante a ida ao login */
      fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token },
        keepalive: true
      }).catch(function () {});
    }
    limparSessao();
    window.location.replace('login.html');
  }

  /* ---------- encerramento forçado (token inválido ou inatividade) ---------- */

  var encerrando = false;   /* um aviso só, mesmo se várias chamadas falharem juntas */

  function expirarSessao(mensagem) {
    if (encerrando) return;
    encerrando = true;
    limparSessao();
    function irParaLogin() { window.location.replace('login.html'); }
    if (window.RosterWork.avisar) {
      window.RosterWork.avisar({
        tipo: 'erro',
        mensagem: mensagem || window.RosterWork.mensagens.sessao.expirada,
        textoOk: window.RosterWork.mensagens.botoes.irParaLogin,
        aoConfirmar: irParaLogin
      });
    } else {
      irParaLogin();
    }
  }

  /* ---------- renovação do token (refresh_token) ---------- */

  var renovacaoEmAndamento = null;   /* deduplica renovações simultâneas */

  function renovarSessao() {
    if (renovacaoEmAndamento) return renovacaoEmAndamento;
    var sessao = obterSessao();
    if (!sessao || !sessao.refresh_token) return Promise.reject(new Error('sem refresh_token'));

    renovacaoEmAndamento = fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    }).then(function (resp) {
      if (!resp.ok) throw new Error('falha ao renovar a sessão');
      return resp.json();
    }).then(function (dados) {
      if (!dados || !dados.access_token) throw new Error('renovação sem token');
      salvarSessao(dados.access_token, dados.refresh_token);
      return dados.access_token;
    });

    /* libera a próxima renovação independentemente do resultado */
    renovacaoEmAndamento.then(liberar, liberar);
    function liberar() { renovacaoEmAndamento = null; }

    return renovacaoEmAndamento;
  }

  /* ---------- chamada autenticada (com tratamento de 401) ---------- */

  function requisitar(caminho, token, opcoes) {
    var init = {
      method: opcoes.metodo || 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + (token || SUPABASE_KEY),
        'Content-Type': 'application/json'
      }
    };
    if (opcoes.corpo !== undefined) init.body = JSON.stringify(opcoes.corpo);
    return fetch(SUPABASE_URL + caminho, init);
  }

  function apiFetch(caminho, opcoes) {
    opcoes = opcoes || {};
    var token = obterToken();
    return requisitar(caminho, token, opcoes).then(function (resp) {
      /* token vencido: renova com o refresh_token e refaz a chamada uma vez */
      if (resp.status === 401 && token) {
        return renovarSessao().then(function (novoToken) {
          return requisitar(caminho, novoToken, opcoes);
        }).catch(function () {
          expirarSessao();
          return resp;   /* devolve o 401 original para o chamador tratar */
        });
      }
      return resp;
    });
  }

  /* troca a senha do usuário logado. Exige a senha ATUAL (confirma com um login),
     troca via PUT /auth/v1/user e renova a sessão com a senha nova (a troca pode
     invalidar a sessão antiga). Resolve num marcador:
     { ok: true } | { erro: 'atual' } (senha atual errada) | { erro: 'servidor' } | { erro: 'conexao' } */
  function trocarSenha(email, atual, nova) {
    return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: atual })
    }).then(function (r) {
      if (!r.ok) return { erro: 'atual' };
      return r.json().then(function (t) {
        return fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'PUT',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + t.access_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: nova })
        }).then(function (u) {
          if (!u.ok) return { erro: 'servidor' };
          return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
            method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: nova })
          }).then(function (r2) { return r2.ok ? r2.json() : null; })
            .then(function (t2) { if (t2 && t2.access_token) salvarSessao(t2.access_token, t2.refresh_token); return { ok: true }; })
            .catch(function () { return { ok: true }; });   // a senha JÁ mudou; renovar a sessão é best-effort (a sessão renova depois), não é falha
        });
      });
    }).catch(function () { return { erro: 'conexao' }; });
  }

  /* atalho de RPC: POST em /rest/v1/rpc/<nome>, devolve o JSON ou null se a resposta não foi ok.
     NÃO trata a queda de rede (a promessa rejeita): quem precisa engolir a falha encadeia .catch();
     quem quer avisar usa o handler de rejeição do .then. */
  function rpc(nome, corpo) {
    return apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (resp) { return resp.ok ? resp.json() : null; });
  }

  window.RosterWork.apiFetch = apiFetch;
  window.RosterWork.rpc = rpc;
  window.RosterWork.renovarSessao = renovarSessao;
  window.RosterWork.expirarSessao = expirarSessao;
  window.RosterWork.obterToken = obterToken;
  window.RosterWork.trocarSenha = trocarSenha;
  window.RosterWork.sair = sair;
})();
