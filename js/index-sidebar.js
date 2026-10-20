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

  /* folha "Mais" (só no celular): o "Mais" da barra de baixo abre o menu lateral como uma
     folha de baixo para cima; ela fecha ao tocar no véu, ao escolher uma tela, no Esc e no
     voltar do navegador (RosterWork.voltar, do roteador: o voltar só fecha a folha, a tela
     fica). A navegação em si é a do roteador (os itens são os do menu) */
  function ligarFolhaMais(casca) {
    var botaoMais = document.querySelector('.barra-celular-mais');
    var veu = document.querySelector('.sidebar-folha-veu');
    var menu = document.querySelector('.sidebar');
    if (!botaoMais || !menu) return;

    function aberta() { return casca.classList.contains('casca--mais-aberto'); }

    function abrir() {
      casca.classList.add('casca--mais-aberto');
      botaoMais.setAttribute('aria-expanded', 'true');
      if (window.RosterWork.voltar) window.RosterWork.voltar.empilhar(fechar);
    }

    function fechar() {
      if (!aberta()) return;
      if (window.RosterWork.voltar) window.RosterWork.voltar.desempilhar(fechar);   /* fechou de outro jeito: tira a entrada do voltar */
      casca.classList.remove('casca--mais-aberto');
      botaoMais.setAttribute('aria-expanded', 'false');
    }

    botaoMais.addEventListener('click', function () {
      if (aberta()) fechar(); else abrir();
    });
    if (veu) veu.addEventListener('click', fechar);
    menu.addEventListener('click', function (evento) {
      if (evento.target.closest('.menu-item')) fechar();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') fechar();
    });
  }

  /* o "Mais" mostra o mesmo número do item Pendências (que mora na folha): copia o
     número e se ele aparece toda vez que o selo do item muda */
  function espelharSeloPendencias() {
    var origem = document.querySelector('.sidebar .menu-item[data-pagina="pendencias"] .menu-item-selo');
    var destino = document.querySelector('.barra-celular-selo');
    if (!origem || !destino || !window.MutationObserver) return;

    function copiar() {
      destino.textContent = origem.textContent;
      destino.classList.toggle('oculto', origem.classList.contains('oculto'));
    }

    copiar();
    new MutationObserver(copiar).observe(origem, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  }

  function inicializar() {
    var casca = document.querySelector('.casca');
    var botao = document.querySelector('.sidebar-toggle');

    if (!casca || !botao) return;

    ligarFolhaMais(casca);
    espelharSeloPendencias();

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
