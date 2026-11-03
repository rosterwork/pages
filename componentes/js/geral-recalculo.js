/* ============================================================
   RECÁLCULO EM BLOCOS — esvazia a fila do recálculo da escala.
   Quando um salvamento muda um influenciador (viatura, modelo,
   regra, ritmo, atestado, etc.), o banco recalcula só o 1º bloco
   na hora e enfileira o resto. Aqui chamamos `recalculo_fila_processar`
   em laço (blocos rápidos, ~meio segundo cada) até a fila esvaziar.
   Assim nenhuma requisição carrega a escala inteira (some o risco de
   estouro de tempo/503).
   - Ao SALVAR: o `esconderVeuGlobal` marca pendência e esvazia em 2º plano.
   - Ao ABRIR a Escala: ela mostra na hora, lê a fila (`lerFilaRecalculo`),
     marca os dias que ainda vão ser refeitos e se redesenha quando o
     esvaziar termina (escalas.js).
   Ver BANCO.md (recalculo_fila).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var promessa = null;    /* laço em andamento (chamadores concorrentes esperam a MESMA conclusão) */
  var pendente = false;   /* pode haver recálculo a completar; some quando a fila zera */

  function umBloco() {
    return RosterWork.apiFetch('/rest/v1/rpc/recalculo_fila_processar', {
      metodo: 'POST', corpo: { p_limite_dias: 15 }
    }).then(function (resp) {
      if (!resp.ok) return false;   /* falhou: deixa o resto p/ a próxima vez */
      return resp.json().then(function (r) { return !!(r && r.pendente); });
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
