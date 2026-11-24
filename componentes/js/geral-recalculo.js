/* ============================================================
   RECÁLCULO — a fila do recálculo da escala, só para ler.
   Quando um salvamento muda um influenciador (viatura, modelo, regra,
   ritmo, atestado, folga, etc.), o banco põe os dias seguintes na fila
   e a rotina de fundo dele (pg_cron, a cada 20 s) os refaz sozinha,
   numa conexão própria, fora das conexões do site: a tela não esvazia
   a fila. A Escala mostra na hora, com a borda amarela nos dias que
   ainda podem mudar (escalas-atualizando.js), e o Imprimir espera a
   fila acabar. Ver BANCO.md (recalculo_fila).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* a fila de agora, só lendo (recalculo_fila_ler): [{ contexto_id, unidades, proxima_data }], as unidades já com o
     grupo acoplado; [] sem fila, null em falha */
  function lerFilaRecalculo() {
    if (!RosterWork.apiFetch) return Promise.resolve(null);
    return RosterWork.apiFetch('/rest/v1/rpc/recalculo_fila_ler', { metodo: 'POST', corpo: {} })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; });
  }

  window.RosterWork.lerFilaRecalculo = lerFilaRecalculo;
})();
