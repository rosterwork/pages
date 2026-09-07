(function () {
  'use strict';


  /* itens marcados só aparecem para o papel certo: data-admin (admin),
     data-programador (programador — item + divisória da seção) */
  function aplicarPermissoesMenu() {
    if (!RosterWork.sessao.ehAdmin()) {
      var admins = document.querySelectorAll('.menu-item[data-admin]');
      for (var i = 0; i < admins.length; i++) admins[i].classList.add('oculto');
    }
    if (!(RosterWork.sessao.ehProgramador && RosterWork.sessao.ehProgramador())) {
      var progs = document.querySelectorAll('[data-programador]');
      for (var j = 0; j < progs.length; j++) progs[j].classList.add('oculto');
    }
  }

  function salvarPreferenciaSidebar(recolhido) {
    /* atualiza cache na sessão */
    var prefs = null;
    try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}
    prefs = prefs || {};
    prefs.sidebar_recolhido = recolhido;
    sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs));

    /* persiste no banco */
    if (RosterWork.obterToken()) {
      RosterWork.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_sidebar: recolhido }
      }).catch(function () {});
    }
  }

  function inicializar() {
    var casca = document.querySelector('.casca');
    var botao = document.querySelector('.sidebar-toggle');

    if (!casca || !botao) return;

    /* lê estado inicial das preferências salvas na sessão */
    var prefs = null;
    try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}

    if (prefs && prefs.sidebar_recolhido) {
      casca.classList.add('casca--recolhida');
    }

    atualizarAria(botao, casca);
    atualizarDicas(casca);
    aplicarPermissoesMenu();

    botao.addEventListener('click', function () {
      casca.classList.toggle('casca--recolhida');
      var recolhido = casca.classList.contains('casca--recolhida');
      salvarPreferenciaSidebar(recolhido);
      atualizarAria(botao, casca);
      atualizarDicas(casca);
    });
  }

  function atualizarAria(botao, casca) {
    var recolhido = casca.classList.contains('casca--recolhida');
    botao.setAttribute('aria-label', recolhido ? 'Expandir menu' : 'Recolher menu');
  }

  function atualizarDicas(casca) {
    var recolhido = casca.classList.contains('casca--recolhida');
    var itens = document.querySelectorAll('.menu-item');
    var i;
    for (i = 0; i < itens.length; i++) {
      var label = itens[i].querySelector('.menu-item-label');
      if (!label) continue;
      if (recolhido) {
        itens[i].setAttribute('data-dica', label.textContent.trim());
        itens[i].classList.add('dica--direita');
      } else {
        itens[i].removeAttribute('data-dica');
        itens[i].classList.remove('dica--direita');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
