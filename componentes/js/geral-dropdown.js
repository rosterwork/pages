/* ============================================================
   DROPDOWN — comportamento compartilhado
   Abre/fecha o menu no clique do gatilho; o posicionamento (flutuante,
   flip, shift, limite do modal, reposicionar ao rolar) fica no helper
   geral-flutuante. Fecha ao clicar fora, ao clicar num item, no Esc,
   ou se o gatilho sair da tela (avisado pelo helper: fecha só ele, e
   o vigia da rolagem se desliga junto, também quando um redesenho
   tirou a lista aberta da página).
   ============================================================ */
(function () {
  'use strict';

  /* o gatilho é o 1º filho do .dropdown que não seja o menu; marca o estado p/ o leitor de tela */
  function gatilhoDe(dropdown) {
    var el = dropdown.firstElementChild;
    while (el && el.classList && el.classList.contains('dropdown-menu')) el = el.nextElementSibling;
    return el;
  }
  function marcarAberto(dropdown, aberto) {
    var g = gatilhoDe(dropdown);
    if (g) { g.setAttribute('aria-haspopup', 'true'); g.setAttribute('aria-expanded', aberto ? 'true' : 'false'); }
  }

  function fechar(dropdown) {
    dropdown.classList.remove('dropdown--aberto');
    marcarAberto(dropdown, false);
    if (dropdown._desligarFlutuante) {
      dropdown._desligarFlutuante();
      dropdown._desligarFlutuante = null;
    }
  }

  function fecharTodos(excecao) {
    var abertos = document.querySelectorAll('.dropdown--aberto');
    for (var i = 0; i < abertos.length; i++) {
      if (abertos[i] !== excecao) fechar(abertos[i]);
    }
  }

  function abrir(dropdown) {
    var menu = dropdown.querySelector('.dropdown-menu');
    dropdown.classList.add('dropdown--aberto');   /* exibe antes de medir */
    marcarAberto(dropdown, true);
    if (menu && window.RosterWork.flutuante) {
      dropdown._desligarFlutuante = window.RosterWork.flutuante.ancorar(dropdown, menu, {
        limitarAltura: true,
        aoSair: function () { fechar(dropdown); }
      });
    }
  }

  document.addEventListener('click', function (evento) {
    var dropdown = evento.target.closest('.dropdown');

    if (!dropdown) {
      fecharTodos(null);
      return;
    }

    if (evento.target.closest('.dropdown-menu')) {
      if (evento.target.closest('.dropdown-item')) {
        if (!evento.target.closest('.dropdown-item--inativo')) {
          fecharTodos(null);
        }
      }
      return;
    }

    var estaAberto = dropdown.classList.contains('dropdown--aberto');
    fecharTodos(null);
    if (!estaAberto) abrir(dropdown);
  });

  /* Esc fecha o dropdown aberto e impede o fechamento do modal/calendário juntos. O foco que estava dentro do menu
     volta ao botão que o abriu (senão ele se perde quando o menu some) */
  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Escape') return;
    var abertos = document.querySelectorAll('.dropdown--aberto');
    if (!abertos.length) return;
    var comFoco = Array.prototype.filter.call(abertos, function (d) { return d.contains(document.activeElement); })[0];
    var gatilho = comFoco ? gatilhoDe(comFoco) : null;
    fecharTodos(null);
    if (gatilho && gatilho.focus) gatilho.focus();
    evento.stopImmediatePropagation();
  }, true);

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.fecharDropdowns = fecharTodos;
  /* abrir um dropdown por código (para gatilhos cujo clique não chega ao ouvinte do document,
     ex.: dentro da grade da extra, que tem stopPropagation). Fecha os outros antes. */
  window.RosterWork.abrirDropdown = function (dropdown) {
    if (!dropdown) return;
    var aberto = dropdown.classList.contains('dropdown--aberto');
    fecharTodos(null);
    if (!aberto) abrir(dropdown);
  };
})();
