/* ============================================================
   AFASTAMENTOS / LICENÇAS — acesso ao banco (RosterWork.licencasDados)
   Só a criação de licença; o efetivo do seletor de militar reusa
   RosterWork.atestadosDados.buscarEfetivo (mesma lista/cache). A
   leitura da lista é pela árvore (rpcConteudo: 'listar_licencas').
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* lança um período de licença; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function inserirLicenca(corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/inserir_licenca', { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };
        return resp.json();
      });
  }

  window.RosterWork.licencasDados = { inserirLicenca: inserirLicenca };
})();
