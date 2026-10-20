/* ============================================================
   CELULAR — a tela está no desenho do celular agora?
   Sim quando o <html> tem a marca data-celular (posta pelo
   index-sessao.js) e a tela tem até 767px: o mesmo corte do bloco
   do celular nos CSS. API: RosterWork.celular() -> true/false
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var telaCelular = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

  window.RosterWork.celular = function () {
    return document.documentElement.hasAttribute('data-celular') && !!telaCelular && telaCelular.matches;
  };
})();
