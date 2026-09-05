/* ============================================================
   NOVO USUÁRIO — acesso ao banco
   Busca os graus hierárquicos (Tipo/Posto/Promoções) e insere o
   usuário. Camada isolada: a UI (usuarios-novo-usuario.js) só chama
   RosterWork.novoUsuarioDados.buscarGraus()/inserir(payload).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function chamarRpc(nome, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (resposta) {
        return resposta.ok ? resposta.json() : null;
      });
  }

  /* graus em cache — a lista não muda durante a sessão */
  var grausCache = null;

  function buscarGraus() {
    if (grausCache) return Promise.resolve(grausCache);
    return chamarRpc('buscar_graus_hierarquicos', {}).then(function (lista) {
      grausCache = Array.isArray(lista) ? lista : [];
      return grausCache;
    }).catch(function () {
      return [];
    });
  }

  function inserir(payload) {
    return chamarRpc('inserir_usuario_admin', payload);
  }

  window.RosterWork.novoUsuarioDados = {
    buscarGraus: buscarGraus,
    inserir: inserir
  };
})();
