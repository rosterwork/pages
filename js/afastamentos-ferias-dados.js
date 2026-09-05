/* ============================================================
   AFASTAMENTOS / FÉRIAS — acesso ao banco (RosterWork.feriasDados)
   Só a criação de férias; o efetivo do seletor de militar reusa
   RosterWork.atestadosDados.buscarEfetivo (mesma lista/cache). A
   leitura da lista é pela árvore (rpcConteudo: 'listar_ferias').
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* lança um período de férias; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function inserirFerias(corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/inserir_ferias', { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };
        return resp.json();
      });
  }

  window.RosterWork.feriasDados = { inserirFerias: inserirFerias };
})();
