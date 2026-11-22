/* ============================================================
   API — comunicação autenticada com o banco (compartilhada)
   Um único lugar para a URL/chave do Supabase, o token da sessão e
   a renovação automática. RosterWork.apiFetch(caminho, opcoes)
   injeta a chave e o token; se o token tiver vencido (401), renova
   com o refresh_token e refaz a chamada uma vez. Só encerra a sessão
   (RosterWork.expirarSessao) quando o servidor recusa a chave (4xx,
   fora o 429); sem internet, servidor fora ou excesso de pedidos, a
   sessão fica, a chamada devolve a falha à tela e o vigia renova de
   novo no minuto seguinte. Também
   concentra a renovação proativa (usada pelo vigia de sessão) e a
   saída (logout). Ver js/index-sessao-vigia.js. No modo treino, a
   chamada vai pelo RosterWork.treino.passar (geral-treino.js): só
   passa o que lê, e as leituras ganham os exemplos do treino.
   A leitura que o banco cortou por tempo, ou que não chegou, é pedida
   de novo uma vez, sozinha, 3 s depois (nunca a gravação); a falha
   fica anotada (RosterWork.ultimaFalha, para a frase do que fazer,
   geral-falha.js) e o corte vai para a aba Erros do Programador.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var SUPABASE_URL = 'https://oadzjrekpuddagfydfzn.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NKSki2dWOD6k6_jle3Ha7w_uq1nYcXx';

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
    /* Manter-me conectado: o aparelho guarda a chave nova e conta o uso */
    if (window.RosterWork.conectado) window.RosterWork.conectado.atualizar(accessToken, refreshToken);
  }

  function limparSessao() {
    /* limpa TUDO: em PC compartilhado nenhuma chave pode vazar ao próximo usuário */
    sessionStorage.clear();
  }

  /* o aparelho esquece o login lembrado quando ele é desta conta */
  function esquecerLembrado(token) {
    var conectado = window.RosterWork.conectado;
    if (conectado && conectado.daSessao(token)) conectado.esquecer();
  }

  /* ---------- saída (logout voluntário) ---------- */

  /* sai só deste aparelho (scope=local): o app do celular e os outros aparelhos seguem conectados */
  function sair() {
    /* sair da conta é de verdade: o modo treino termina antes */
    if (window.RosterWork.treino) window.RosterWork.treino.apagar();
    var token = obterToken();
    var notificacoes = window.RosterWork.notificacoesCelular;
    /* antes, o aparelho para de receber as notificações desta conta (computador compartilhado) */
    var antes = token && notificacoes ? notificacoes.desligarAoSair() : Promise.resolve();
    antes.then(function () {
      if (token) {
        esquecerLembrado(token);
        /* keepalive: a chamada de logout completa mesmo durante a ida ao login */
        fetch(SUPABASE_URL + '/auth/v1/logout?scope=local', {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token },
          keepalive: true
        }).catch(function () {});
      }
      limparSessao();
      window.location.replace('login.html');
    });
  }

  /* encerra a sessão em todos os aparelhos (scope=global), inclusive no app do celular, e as
     notificações no celular de todos eles. Resolve false quando o servidor não confirmou (a sessão segue aberta) */
  function sairDeTodos() {
    /* no modo treino, nada muda: o aviso diz */
    var treino = window.RosterWork.treino;
    if (treino && treino.recusar(window.RosterWork.mensagens.treino.aparelhosContinuam)) return Promise.resolve(false);
    var notificacoes = window.RosterWork.notificacoesCelular;
    var antes = notificacoes ? notificacoes.desligarTodos() : Promise.resolve();
    return antes.then(function () {
      return apiFetch('/auth/v1/logout?scope=global', { metodo: 'POST' });
    }).then(function (resp) {
      if (!resp.ok) return false;
      esquecerLembrado(obterToken());
      limparSessao();
      window.location.replace('login.html');
      return true;
    }, function () { return false; });
  }

  /* ---------- encerramento forçado (token inválido ou inatividade) ---------- */

  var encerrando = false;   /* um aviso só, mesmo se várias chamadas falharem juntas */

  function expirarSessao(mensagem) {
    if (encerrando) return;
    encerrando = true;
    /* o login lembrado fica: na tela de entrada, o servidor diz se ele ainda vale */
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

  /* a falha da renovação diz se o servidor recusou a chave (recusada: a sessão acabou) ou se foi passageira */
  function falhaDeRenovacao(recusada) {
    var erro = new Error(recusada ? 'a chave de renovação foi recusada' : 'falha passageira ao renovar a sessão');
    erro.recusada = recusada;
    return erro;
  }

  function renovarSessao() {
    if (renovacaoEmAndamento) return renovacaoEmAndamento;
    var sessao = obterSessao();
    if (!sessao || !sessao.refresh_token) return Promise.reject(falhaDeRenovacao(true));

    /* Manter-me conectado: renova pela chave mais nova do aparelho, que outra aba pode já ter trocado */
    var lembrado = window.RosterWork.conectado ? window.RosterWork.conectado.daSessao(sessao.access_token) : null;
    var chave = lembrado ? lembrado.refresh_token : sessao.refresh_token;

    renovacaoEmAndamento = fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: chave })
    }).then(function (resp) {
      /* a régua da entrada pelo login lembrado (geral-entrada.js): 4xx, fora o 429, é a chave recusada;
         5xx e 429 são passageiros, como a falta de resposta (o fetch rejeita) */
      if (!resp.ok) throw falhaDeRenovacao(resp.status >= 400 && resp.status < 500 && resp.status !== 429);
      return resp.json();
    }).then(function (dados) {
      if (!dados || !dados.access_token) throw falhaDeRenovacao(false);
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
    /* modo treino (geral-treino.js): só passa o que lê, e o pedido pode ir ajeitado (buscar, com o corpo novo) */
    var treino = window.RosterWork.treino;
    if (!treino || !treino.ligado()) return fetch(SUPABASE_URL + caminho, init);
    return treino.passar(caminho, init.method, opcoes.corpo, function (corpo) {
      if (corpo !== undefined) init.body = JSON.stringify(corpo);
      return fetch(SUPABASE_URL + caminho, init);
    });
  }

  /* ---------- a leitura que falhou: tenta mais uma vez ---------- */

  /* o banco cortou por tempo, não teve a vez (trava) ou desfez por conflito: na segunda vez pode passar; a recusa de
     propósito (4xx) e o erro do sistema, não */
  var CODIGOS_DE_TEMPO = ['57014', '55P03', '40001', '40P01'];
  var ESPERA_REPETIR_MS = 3000;
  /* a falha que chega depois disto é de conta grande (60 s no banco): repetir sozinha só pesaria mais o banco cheio */
  var REPETE_ATE_MS = 25000;
  /* a queda que chega depois disto é corte no caminho (o servidor desistiu sem resposta), não falta de internet */
  var CORTE_SEM_RESPOSTA_MS = 10000;
  var ultimaFalha = null;   // { motivo: 'internet' | 'demorou' | 'erro', quando }

  function nomeDaRpc(caminho) {
    var achou = /^\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(caminho);
    return achou ? achou[1] : null;
  }

  function depois(ms) { return new Promise(function (seguir) { setTimeout(seguir, ms); }); }

  /* a resposta que falhou: { motivo: 'demorou' (vale tentar de novo) | 'erro', frase do corte } ou null (deu certo, ou o
     banco recusou de propósito, como a permissão) */
  function falhaDaResposta(resp, ms) {
    if (resp.ok || resp.status < 500) return Promise.resolve(null);
    var M = window.RosterWork.mensagens.geral, s = Math.max(10, Math.round(ms / 10000) * 10);
    if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
      return Promise.resolve({ motivo: 'demorou', corte: M.corteServidor(resp.status, s) });
    }
    return resp.clone().json().then(function (corpo) {
      var codigo = corpo && corpo.code;
      if (CODIGOS_DE_TEMPO.indexOf(codigo) < 0) return { motivo: 'erro' };
      return { motivo: 'demorou', corte: codigo === '57014' ? M.corteTempo(s) : M.corteBanco(codigo, s) };
    }, function () { return { motivo: 'erro' }; });
  }

  /* a chamada que nem voltou: sem internet, ou o servidor desistiu no caminho depois de muito tempo */
  function falhaSemResposta(ms) {
    if (navigator.onLine === false || ms < CORTE_SEM_RESPOSTA_MS) return { motivo: 'internet' };
    var s = Math.max(10, Math.round(ms / 10000) * 10);
    return { motivo: 'demorou', corte: window.RosterWork.mensagens.geral.corteSemResposta(s) };
  }

  /* anota o motivo (a frase do que fazer) e manda o corte para a aba Erros do Programador */
  function anotarFalha(falha, caminho) {
    ultimaFalha = { motivo: falha.motivo, quando: Date.now() };
    var nome = nomeDaRpc(caminho), erros = window.RosterWork.erros;
    if (falha.corte && nome && nome !== 'erro_tela_registrar' && erros && erros.registrarCorte) erros.registrarCorte(falha.corte, 'rpc/' + nome);
  }

  /* só lê: o GET, ou a RPC da lista de leituras do site (a LEITURAS do geral-treino.js) */
  function soLe(caminho, opcoes) {
    if ((opcoes.metodo || 'GET') === 'GET') return true;
    var nome = nomeDaRpc(caminho), treino = window.RosterWork.treino;
    return !!(nome && treino && treino.ehLeitura && treino.ehLeitura(nome));
  }

  function apiFetch(caminho, opcoes) { return pedir(caminho, opcoes || {}, false); }

  /* a falha por tempo (ou sem resposta) de uma leitura, que veio antes de REPETE_ATE_MS, fora do modo treino, é pedida
     de novo uma vez (segunda), ESPERA_REPETIR_MS depois */
  function pedir(caminho, opcoes, segunda) {
    var inicio = Date.now();
    function podeRepetir(falha) {
      var treino = window.RosterWork.treino;
      return !segunda && falha.motivo !== 'erro' && Date.now() - inicio < REPETE_ATE_MS && soLe(caminho, opcoes) &&
        !(treino && treino.ligado && treino.ligado());
    }
    function deNovo() { return depois(ESPERA_REPETIR_MS).then(function () { return pedir(caminho, opcoes, true); }); }
    return chamar(caminho, opcoes).then(function (resp) {
      return falhaDaResposta(resp, Date.now() - inicio).then(function (falha) {
        if (!falha) return resp;
        anotarFalha(falha, caminho);
        return podeRepetir(falha) ? deNovo() : resp;
      });
    }, function (erro) {
      var falha = falhaSemResposta(Date.now() - inicio);
      anotarFalha(falha, caminho);
      if (podeRepetir(falha)) return deNovo();
      throw erro;
    });
  }

  function chamar(caminho, opcoes) {
    var token = obterToken();
    return requisitar(caminho, token, opcoes).then(function (resp) {
      /* o banco não reconhece mais a chamada (a função mudou e a tela aberta ficou velha): o aviso de manutenção */
      if (resp.status === 404 && caminho.indexOf('/rest/v1/rpc/') === 0 && window.RosterWork.manutencao) {
        window.RosterWork.manutencao.funcaoMudou();
      }
      /* token vencido: renova com o refresh_token e refaz a chamada uma vez. Só a chave recusada encerra a
         sessão; na falha passageira a sessão fica e a tela recebe o 401 original (o vigia renova de novo).
         A queda na repetição da chamada sobe como falha de rede comum, sem encerrar nada */
      if (resp.status === 401 && token) {
        return renovarSessao().then(function (novoToken) {
          return requisitar(caminho, novoToken, opcoes);
        }, function (erro) {
          if (erro && erro.recusada) expirarSessao();
          return resp;   /* devolve o 401 original para o chamador tratar */
        });
      }
      return resp;
    });
  }

  /* troca a senha do usuário logado. Exige a senha ATUAL (confirma com um login),
     troca via PUT /auth/v1/user, renova a sessão com a senha nova (a troca pode
     invalidar a sessão antiga) e encerra as outras sessões da conta (logout?scope=others):
     a conta sai dos outros aparelhos e este continua. Resolve num marcador:
     { ok: true, outrosSairam } (outrosSairam: o servidor confirmou a saída dos outros
     aparelhos) | { erro: 'atual' } (senha atual errada) | { erro: 'limite' } (excesso de entradas
     do mesmo endereço de internet) | { erro: 'servidor' } | { erro: 'conexao' } | { erro: 'treino' }
     (no modo treino, a senha não muda: o aviso diz) */
  function trocarSenha(email, atual, nova) {
    var treino = window.RosterWork.treino;
    if (treino && treino.recusar(window.RosterWork.mensagens.treino.senhaNaoMuda)) return Promise.resolve({ erro: 'treino' });
    return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: atual })
    }).then(function (r) {
      if (!r.ok) return { erro: r.status === 429 ? 'limite' : 'atual' };
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
            .then(function (t2) {
              if (!(t2 && t2.access_token)) return { ok: true, outrosSairam: false };
              salvarSessao(t2.access_token, t2.refresh_token);
              /* com a sessão nova guardada, as outras saem: os outros aparelhos e a sessão aberta pela conferência da senha atual */
              return fetch(SUPABASE_URL + '/auth/v1/logout?scope=others', {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + t2.access_token }
              }).then(function (s) { return { ok: true, outrosSairam: s.ok }; }, function () { return { ok: true, outrosSairam: false }; });
            })
            .catch(function () { return { ok: true, outrosSairam: false }; });   // a senha JÁ mudou; renovar a sessão é best-effort (a sessão renova depois), não é falha
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
  /* a última falha de chamada ao banco ({ motivo: 'internet' | 'demorou' | 'erro', quando } ou null; geral-falha.js) */
  window.RosterWork.ultimaFalha = function () { return ultimaFalha; };
  window.RosterWork.renovarSessao = renovarSessao;
  window.RosterWork.expirarSessao = expirarSessao;
  window.RosterWork.obterToken = obterToken;
  window.RosterWork.trocarSenha = trocarSenha;
  window.RosterWork.sair = sair;
  window.RosterWork.sairDeTodos = sairDeTodos;
})();
