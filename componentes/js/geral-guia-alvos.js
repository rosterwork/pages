/* ============================================================
   GUIA › ALVOS — o que o passo acende (RosterWork.guiaAlvos)
   Acha na tela os alvos do passo do geral-guia.js: o data-alvo (na
   escolha, as entradas dos caminhos), o data-alvo-senao, o data-um e o
   data-requer. No treino, o data-exemplo, o data-treino-alvo, o
   data-treino-entrada e o passo de clique, que acende só o que responde.
   Também aqui: rolar até o alvo, o menu ou a janela aberta que não é
   do alvo (esperando) e a tela ainda carregando (carregando).
   API: alvosDo(passo, guia), elementos(seletores, anel), seletoresDo(passo),
   rolarAte(els), esperando(els), carregando(guia), todos(seletor), um(seletor).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var ESPERAR = '.dropdown--aberto, .calendario--aberto, .modal-veu--aberto';

  function R() { return RW.guiaRoteiros; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  /* o seletor escrito errado num roteiro não derruba o guia: só não acha nada */
  function todos(seletor) { try { return document.querySelectorAll(seletor); } catch (e) { return []; } }
  function um(seletor) { try { return document.querySelector(seletor); } catch (e) { return null; } }

  function seletoresDo(passo) {
    return passo.caminhos.length ? R().entradas(passo) : R().seletores(passo.p.getAttribute('data-alvo'));
  }
  /* anel: "campo" acende o campo inteiro (com o rótulo); "caixa", a caixa da pergunta (.grupo-caixa) */
  function elementos(seletores, anel) {
    var lista = [];
    seletores.forEach(function (s) {
      Array.prototype.forEach.call(todos(s), function (el) {
        if (anel === 'campo') el = el.closest('.campo') || el;
        if (anel === 'caixa') el = el.closest('.grupo-caixa') || el;
        if (visivel(el) && lista.indexOf(el) < 0) lista.push(el);
      });
    });
    return lista;
  }
  /* no treino, sem o exemplo do passo (data-exemplo) não há alvo; o data-treino-alvo acende só o primeiro que achar; na
     escolha, acende uma entrada por caminho (o data-treino-entrada, quando há). null: vale o de sempre */
  function alvosDoTreino(passo, anel) {
    var p = passo.p, doTreino = p.getAttribute('data-treino-alvo');
    if (p.hasAttribute('data-exemplo') && !R().exemplo(p)) return [];
    if (doTreino) return elementos(R().seletores(doTreino)).slice(0, 1);
    if (!passo.caminhos.length) return null;
    return passo.caminhos.map(function (secao) {
      return elementos(R().seletores(secao.getAttribute('data-treino-entrada') || secao.getAttribute('data-entrada')), anel)[0];
    }).filter(Boolean);
  }
  function naJanela(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  /* no treino, o passo de clique acende só o que responde */
  function soOPrimeiro(p, guia) {
    if (p.hasAttribute('data-um')) return true;
    var avanca = p.getAttribute('data-avanca');
    return guia.treino && (avanca === 'clique' || avanca === 'some') && !p.hasAttribute('data-clique');
  }
  /* data-um: só o primeiro alvo (o primeiro à vista, quando há); data-requer: sem a situação na tela, o passo fica sem alvo */
  function alvosDo(passo, guia) {
    var p = passo.p, anel = p.getAttribute('data-anel'), requer = p.getAttribute('data-requer');
    if (requer && !elementos(R().seletores(requer)).length) return [];
    var doTreino = guia.treino ? alvosDoTreino(passo, anel) : null;
    if (doTreino) return doTreino;
    var lista = elementos(seletoresDo(passo), anel);
    if (!lista.length && p.getAttribute('data-alvo-senao')) lista = elementos(R().seletores(p.getAttribute('data-alvo-senao')), anel);
    if (soOPrimeiro(p, guia) && lista.length > 1) lista = [lista.filter(naJanela)[0] || lista[0]];
    return lista;
  }
  /* rola a área do alvo para ele ficar a 1/4 do alto dela (o balão fica do outro lado); algum alvo já na tela, não rola */
  function rolarAte(els) {
    if (els.some(naJanela)) return;
    var el = els[0], area = el.parentElement;
    while (area && area !== document.body) {
      var rolagem = getComputedStyle(area).overflowY;
      if ((rolagem === 'auto' || rolagem === 'scroll') && area.scrollHeight > area.clientHeight) break;
      area = area.parentElement;
    }
    if (!area || area === document.body) return;
    area.scrollTop += (el.getBoundingClientRect().top - area.getBoundingClientRect().top) - area.clientHeight / 4;
  }
  /* um menu, calendário ou modal aberto que não é do alvo (nem o tem dentro): o guia espera */
  function esperando(els) {
    return Array.prototype.some.call(document.querySelectorAll(ESPERAR), function (aberto) {
      return !els.some(function (el) { return aberto.contains(el) || el.contains(aberto); });
    });
  }
  /* algo ainda carregando à vista: a troca de tela, o véu da tela, ou o círculo ou os pontos de uma área (a grade da Escala,
     a área da Extrajornada, uma lista, o painel aberto), a forma cinza, a área que espera a leitura (data-lendo, ainda sem a
     forma), a barra das etapas (o cartão, a linha, o dia sendo refeito) ou a grade que fica na tela enquanto é lida de novo.
     O círculo do véu escondido (some pela opacidade), o do painel fechado e o do cálculo da sugestão da Extrajornada (que é
     um passo do roteiro) não contam. No treino, a gravação da Extrajornada no ar também conta: a resposta dela mexe na tela
     e abre o aviso */
  function carregando(guia) {
    if (guia && guia.treino && RW.treinoExtra && RW.treinoExtra.gravando()) return true;
    if (RW.navegando && RW.navegando()) return true;
    if (document.querySelector('.conteudo > .carregando-veu--visivel')) return true;
    var sinais = '.conteudo .giratorio, .conteudo .carregando-pontos, .conteudo .esqueleto-conjunto, .conteudo [data-lendo], ' +
      '.conteudo .cobertura-viva, .conteudo .pagina-corpo[data-relendo]';
    return Array.prototype.some.call(document.querySelectorAll(sinais), function (g) {
      return visivel(g) && !g.closest('.carregando-veu, .nova-extra-calculo, .painel-lateral:not(.painel-lateral--aberto)') &&
        getComputedStyle(g).visibility !== 'hidden';
    });
  }

  RW.guiaAlvos = {
    alvosDo: alvosDo, elementos: elementos, seletoresDo: seletoresDo, rolarAte: rolarAte, esperando: esperando,
    carregando: carregando, todos: todos, um: um
  };
})();
