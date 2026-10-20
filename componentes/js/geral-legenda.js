/* ============================================================
   LEGENDA — o botão Legenda da barra de controles
   A página escreve o lugar (<div id="..."></div>) onde ele fica;
   montar(lugar) troca o lugar pelo molde #tpl-legenda (botão
   quadrado com o ícone + a caixa), mantendo o id e as classes do
   lugar (ex.: oculto). A página preenche a caixa
   [data-legenda-conteudo] com o que a tela mostra.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function montar(lugar) {
    if (!lugar) return null;
    if (lugar.classList.contains('legenda')) return lugar;   /* já montado */
    var el = RosterWork.tpl('tpl-legenda');
    if (!el) return null;
    if (lugar.id) el.id = lugar.id;
    Array.prototype.forEach.call(lugar.classList, function (classe) { el.classList.add(classe); });
    lugar.replaceWith(el);
    return el;
  }

  window.RosterWork.legenda = { montar: montar };
})();
