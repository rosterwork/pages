/* ============================================================
   COMPONENTE geral-anteriores — grupo "Anteriores (N)"
   Numa lista com histórico, junta os itens que já passaram atrás
   de um botão que abre e fecha. montar(itens, aberto) clona o
   molde #tpl-anteriores, põe a quantidade e liga o clique; os itens
   (já montados pela página) ficam .oculto enquanto fechado. A
   página insere o botão e os itens na lista, nessa ordem.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function montar(itens, aberto) {
    var botao = RosterWork.tpl('tpl-anteriores');
    if (!botao) return null;
    botao.querySelector('.anteriores-qtd').textContent = '(' + itens.length + ')';
    var mostrar = function (sim) {
      botao.setAttribute('aria-expanded', sim ? 'true' : 'false');
      itens.forEach(function (el) { el.classList.toggle('oculto', !sim); });
    };
    botao.addEventListener('click', function () { mostrar(botao.getAttribute('aria-expanded') !== 'true'); });
    mostrar(!!aberto);
    return botao;
  }

  window.RosterWork.anteriores = { montar: montar };
})();
