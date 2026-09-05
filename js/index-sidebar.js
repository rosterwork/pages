(function () {
  'use strict';


  /* itens de menu marcados com data-admin só aparecem para administradores */
  function aplicarPermissoesMenu() {
    if (RosterWork.sessao.ehAdmin()) return;
    var itens = document.querySelectorAll('.menu-item[data-admin]');
    for (var i = 0; i < itens.length; i++) itens[i].classList.add('oculto');
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

  /* selo de alertas da ESCALA no item Escala (só admin): soma "militares fora da escala"
     + "viaturas em manutenção" ao vivo. Vermelho quando há fora-da-escala (erro),
     amarelo quando só há manutenção (aviso); some quando é zero. A dica no hover diz o quê;
     clicar no selo leva a Avisos › Administração. Recarregado na carga e após todo salvar. */
  function esconderSelo(selo) {
    selo.classList.add('oculto');
    selo.classList.remove('menu-item-selo--erro');
    selo.removeAttribute('title');
  }

  function atualizarSeloEscala() {
    var item = document.querySelector('.menu-item[data-pagina="escalas"]');
    if (!item) return;
    var selo = item.querySelector('.menu-item-selo');
    if (!selo) return;
    if (!RosterWork.sessao.ehAdmin() || !RosterWork.obterToken || !RosterWork.obterToken()) { esconderSelo(selo); return; }
    RosterWork.apiFetch('/rest/v1/rpc/pendencias_listar', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (itens) {
        itens = Array.isArray(itens) ? itens : [];
        var fora = null, manut = null;
        itens.forEach(function (p) {
          if (p.tipo === 'fora_escala') fora = p;
          else if (p.tipo === 'manutencao') manut = p;
        });
        var nFora = fora ? Number(fora.contagem) || 0 : 0;
        var nManut = manut ? Number(manut.contagem) || 0 : 0;
        var total = nFora + nManut;
        if (!total) { esconderSelo(selo); return; }
        selo.textContent = total > 9 ? '9+' : String(total);
        selo.classList.remove('oculto');
        selo.classList.toggle('menu-item-selo--erro', nFora > 0);
        /* tooltip nativo (title): o .menu-item tem overflow:hidden no expandido,
           que cortaria a dica CSS (::after); o title do navegador não é cortado */
        var linhas = [];
        if (fora) linhas.push(fora.texto);
        if (manut) linhas.push(manut.texto);
        selo.setAttribute('title', linhas.join('\n'));
      })
      .catch(function () {});
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
    atualizarSeloEscala();

    /* clicar exatamente no selo leva a Avisos › Administração (sem navegar para a Escala) */
    var seloEscala = document.querySelector('.menu-item[data-pagina="escalas"] .menu-item-selo');
    if (seloEscala) {
      seloEscala.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (RosterWork.irParaPagina) RosterWork.irParaPagina('avisos', 'administracao');
      });
    }

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

  /* o resumo (abre após todo salvar) pede o refresco, para o selo refletir
     entrar/sair do ciclo, cadastro, baixa, transferência etc. na hora */
  window.RosterWork = window.RosterWork || {};
  window.RosterWork.escalaBadge = { recarregar: atualizarSeloEscala };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
