(function () {
  'use strict';


  /* itens marcados só aparecem para o papel certo: data-admin (qualquer administrador: o Histórico,
     que mostra a área dele), data-programador (programador — item + divisória da seção) */
  function aplicarPermissoesMenu() {
    if (!RosterWork.sessao.temPapel('pelotao')) {
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
     folha de baixo para cima; ela fecha ao arrastar para baixo (pela alça e pelo título, ou
     pela lista quando ela está no começo), ao tocar no véu, ao escolher uma tela, no Esc e no
     voltar do navegador (RosterWork.voltar, do roteador: o voltar só fecha a folha, a tela
     fica). A navegação em si é a do roteador (os itens são os do menu) */
  var FOLHA_FECHA_FRACAO = 0.25;   // arrastada mais que 1/4 da altura dela, a folha fecha ao soltar
  var FOLHA_PUXAO = 0.5;           // ou num puxão rápido (px por ms)
  var FOLHA_DESLIZE = 200;         // o deslizar ao soltar ou fechar (igual à transição do CSS, ms)

  function ligarFolhaMais(casca) {
    var botaoMais = document.querySelector('.barra-celular-mais');
    var veu = document.querySelector('.sidebar-folha-veu');
    var menu = document.querySelector('.sidebar');
    var lista = menu && menu.querySelector('.sidebar-itens');
    if (!botaoMais || !menu) return;
    var menosMovimento = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var fechando = false;
    var fimDoDeslize = null;

    function aberta() { return casca.classList.contains('casca--mais-aberto'); }

    /* a posição da folha arrastada (dado da tela): quanto desceu e o véu clareando junto */
    function arrastar(distancia, altura) {
      menu.style.setProperty('--folha-arrasto', distancia + 'px');
      if (veu) veu.style.setProperty('--folha-veu', String(Math.max(0, 1 - distancia / altura)));
    }

    function limparArrasto() {
      if (fimDoDeslize) { clearTimeout(fimDoDeslize); fimDoDeslize = null; }
      casca.classList.remove('casca--mais-soltando', 'casca--mais-fechando');
      menu.style.removeProperty('--folha-arrasto');
      if (veu) veu.style.removeProperty('--folha-veu');
    }

    function abrir() {
      limparArrasto();
      casca.classList.add('casca--mais-aberto');
      botaoMais.setAttribute('aria-expanded', 'true');
      if (window.RosterWork.voltar) window.RosterWork.voltar.empilhar(fechar);
    }

    /* fecha deslizando para baixo; na hora com "menos movimento" no aparelho e ao escolher uma tela (o
       carregando da tela nova aparece na hora, numa camada acima da folha) */
    function fechar() { fecharFolha(false); }
    function fecharNaHora() { fecharFolha(true); }

    function fecharFolha(naHora) {
      if (!aberta() || fechando) return;
      if (window.RosterWork.voltar) window.RosterWork.voltar.desempilhar(fechar);   /* fechou de outro jeito: tira a entrada do voltar */
      botaoMais.setAttribute('aria-expanded', 'false');
      function concluir() {
        fechando = false;
        limparArrasto();
        casca.classList.remove('casca--mais-aberto');
      }
      if (naHora || (menosMovimento && menosMovimento.matches)) { concluir(); return; }
      fechando = true;
      casca.classList.add('casca--mais-soltando', 'casca--mais-fechando');
      fimDoDeslize = setTimeout(concluir, FOLHA_DESLIZE + 20);
    }

    /* soltou sem fechar: a folha desliza de volta ao lugar */
    function voltarAoLugar() {
      casca.classList.add('casca--mais-soltando');
      arrastar(0, 1);
      fimDoDeslize = setTimeout(limparArrasto, FOLHA_DESLIZE + 20);
    }

    /* arrastar para baixo: pela alça e pelo título sempre; pela lista só quando ela está no começo e o
       dedo desce (senão é a rolagem da lista) */
    var inicioY = null;
    var ultimoY = 0;
    var ultimaHora = 0;
    var rapidez = 0;           // a rapidez do último trecho do dedo (px por ms)
    var altura = 1;
    var distancia = 0;
    var arrastando = false;
    menu.addEventListener('touchstart', function (evento) {
      inicioY = null;
      if (!aberta() || fechando || evento.touches.length !== 1) return;
      var pelaAlca = !!evento.target.closest('.sidebar-folha-topo');
      if (!pelaAlca && lista && lista.scrollTop > 0) return;
      limparArrasto();
      inicioY = evento.touches[0].clientY;
      ultimoY = inicioY;
      ultimaHora = Date.now();
      rapidez = 0;
      altura = menu.getBoundingClientRect().height || 1;
      distancia = 0;
      arrastando = pelaAlca;
    }, { passive: true });
    menu.addEventListener('touchmove', function (evento) {
      if (inicioY === null) return;
      var andou = evento.touches[0].clientY - inicioY;
      if (!arrastando) {
        if (andou < 0) { inicioY = null; return; }   /* o dedo subiu: é a rolagem da lista */
        if (andou < 8) return;
        arrastando = true;
      }
      if (evento.cancelable) evento.preventDefault();   /* a folha anda; a lista e o navegador não */
      var agora = Date.now();
      if (agora > ultimaHora) rapidez = (evento.touches[0].clientY - ultimoY) / (agora - ultimaHora);
      ultimoY = evento.touches[0].clientY;
      ultimaHora = agora;
      distancia = Math.max(0, andou);
      arrastar(distancia, altura);
    }, { passive: false });
    function soltar() {
      if (inicioY === null) return;
      inicioY = null;
      if (!arrastando) return;
      arrastando = false;
      /* o puxão conta se o dedo ainda estava andando rápido ao soltar */
      var puxao = rapidez > FOLHA_PUXAO && Date.now() - ultimaHora < 100 && distancia > 24;
      if (distancia > altura * FOLHA_FECHA_FRACAO || puxao) fechar();
      else voltarAoLugar();
    }
    menu.addEventListener('touchend', soltar, { passive: true });
    menu.addEventListener('touchcancel', soltar, { passive: true });

    botaoMais.addEventListener('click', function () {
      if (aberta()) fechar(); else abrir();
    });
    if (veu) veu.addEventListener('click', fechar);
    menu.addEventListener('click', function (evento) {
      if (evento.target.closest('.menu-item')) fecharNaHora();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') fechar();
    });
  }

  /* o item Pendências da barra de baixo mostra o mesmo número do item do menu: copia o
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
