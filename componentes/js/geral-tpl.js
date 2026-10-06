/* ============================================================
   TPL — clona um <template> pelo id e devolve o 1º elemento
   Devolve o firstElementChild do conteúdo
   clonado, ou null se o molde não existir.
   API: RosterWork.tpl(id)
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  window.RosterWork.tpl = function (id) {
    var t = document.getElementById(id);
    return t ? t.content.cloneNode(true).firstElementChild : null;
  };
})();
