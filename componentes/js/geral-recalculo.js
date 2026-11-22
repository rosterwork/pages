/* ============================================================
   RECÁLCULO EM BLOCOS — esvazia a fila do recálculo da escala.
   Quando um salvamento muda um influenciador (viatura, modelo,
   regra, ritmo, atestado, etc.), o banco põe os dias seguintes na
   fila sem refazer nada na hora (a Extrajornada refaz na hora só os
   dias dela). Aqui chamamos `recalculo_fila_processar` em laço
   (blocos de 5 dias) até a fila esvaziar. É trabalho de fundo: a
   gravação de alguém na escala o interrompe, e o bloco cedido espera
   um pouco antes do próximo.
   - Ao SALVAR: o `esconderVeuGlobal` marca pendência e esvazia em 2º plano.
   - Com a Escala aberta: ela mostra na hora, com a borda amarela nos dias
     que ainda podem mudar, e ajuda a esvaziar (escalas-atualizando.js).
   - Sem nenhuma tela aberta: a tarefa de cada minuto do banco esvazia.
   Ver BANCO.md (recalculo_fila).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var promessa = null;    /* laço em andamento (chamadores concorrentes esperam a MESMA conclusão) */
  var pendente = false;   /* pode haver recálculo a completar; some quando a fila zera */

  /* blocos de 5 dias: cada pedaço prende os dias por pouco tempo. O bloco que cedeu a vez (alguém gravou na escala e o
     banco o interrompeu) espera ESPERA_CEDEU_MS antes do próximo, para não disputar com a gravação. Com outro trabalho de
     fundo rodando (ocupado), o banco responde sem pendência: o laço para, e a conferência da Escala pede de novo depois */
  var DIAS_POR_BLOCO = 5;
  var ESPERA_CEDEU_MS = 3000;

  function umBloco() {
    return RosterWork.apiFetch('/rest/v1/rpc/recalculo_fila_processar', {
      metodo: 'POST', corpo: { p_limite_dias: DIAS_POR_BLOCO }
    }).then(function (resp) {
      if (!resp.ok) return false;   /* falhou: deixa o resto p/ a próxima vez */
      return resp.json().then(function (r) {
        if (r && r.cedeu) return new Promise(function (seguir) { setTimeout(function () { seguir(true); }, ESPERA_CEDEU_MS); });
        return !!(r && r.pendente);
      });
    });
  }

  function laco() {
    return umBloco().then(function (temMais) {
      if (temMais) return laco();
    });
  }

  /* um salvamento pode ter deixado recálculo a completar (o front marca ao salvar).
     Também vale enquanto um esvaziamento está em curso, para a Escala esperar. */
  function marcarRecalculoPendente() { pendente = true; }
  function temRecalculoPendente() { return pendente || promessa !== null; }

  /* Esvazia a fila de recálculo. Chamadores concorrentes esperam a MESMA
     conclusão; a pendência some quando a fila zera. Fila vazia = ida rápida. */
  function drenarRecalculo() {
    if (!RosterWork.apiFetch) { pendente = false; return Promise.resolve(); }
    if (promessa) return promessa;
    promessa = laco().catch(function () {}).then(function () {
      promessa = null;
      pendente = false;
    });
    return promessa;
  }

  /* a fila de agora, só lendo (recalculo_fila_ler): [{ contexto_id, unidades, proxima_data }], as unidades já com o
     grupo acoplado; [] sem fila, null em falha */
  function lerFilaRecalculo() {
    if (!RosterWork.apiFetch) return Promise.resolve(null);
    return RosterWork.apiFetch('/rest/v1/rpc/recalculo_fila_ler', { metodo: 'POST', corpo: {} })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; });
  }

  window.RosterWork.lerFilaRecalculo = lerFilaRecalculo;
  window.RosterWork.marcarRecalculoPendente = marcarRecalculoPendente;
  window.RosterWork.temRecalculoPendente = temRecalculoPendente;
  window.RosterWork.drenarRecalculo = drenarRecalculo;
})();
