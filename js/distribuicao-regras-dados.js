/* ============================================================
   DISTRIBUIÇÃO / REGRAS — camada de dados (RPC)
   Só chama as funções do banco (RosterWork.distribuicaoRegrasDados):
   militares e funções do grupo, regras cadastradas, criar e remover.
   A lógica (proibido/exclusivo) é do banco (_regra_permite + motor).
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  function rpc(nome, corpo) {
    return RosterWork.rpc(nome, corpo).catch(function () { return null; });   /* engole a queda de rede (devolve null); o chamador mostra o erro */
  }
  function rpcJson(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };
        return resp.json();
      });
  }

  RW.distribuicaoRegrasDados = {
    militares: function (unidadeIds) { return rpc('dist_regras_militares', { p_unidade_ids: unidadeIds }); },
    funcoes: function (unidadeIds) { return rpc('dist_regras_funcoes', { p_unidade_ids: unidadeIds }); },
    listar: function (unidadeIds) { return rpc('dist_regras_listar', { p_unidade_ids: unidadeIds }); },
    /* grava em LOTE: adicionar = [{usuario_id, unidade_id, tipo, funcao}] · remover = [ids] */
    salvar: function (adicionar, remover, por, recalcularDesde) {
      return rpcJson('dist_regras_salvar', { p_adicionar: adicionar || [], p_remover: remover || [], p_autor: por, p_recalcular_desde: recalcularDesde || null });
    }
  };
})();
