/* ============================================================
   GUIA › BALÃO — o balão do passo a passo (RosterWork.guiaBalao)
   O balão escuro (#tpl-guia-balao) em quatro jeitos: o do passo (o nome
   do roteiro, "Passo N de M", o Sair, o texto e o Próximo; no treino,
   sem o nome e sem o Sair: o nome e a saída estão na barra azul), o do fim (o
   Concluir; no treino, o próximo treino da lista, com o Próximo treino
   e o Voltar aos treinos como link ao lado, ou, feitos todos, a frase
   e só o Voltar aos treinos), o de quando o treino não pôde seguir (a
   frase, o Recomeçar e o Voltar aos treinos; o fim e este, no treino, com
   a tela toda no véu) e o aviso de quando a
   situação do passo não está na tela (o texto e, fora do treino, o Sair, sem o véu,
   no meio da tela). posicionar(els) acende no véu (geral-guia-veu.js)
   os alvos e os menus abertos por eles e põe o balão ao lado deles:
   no computador, à direita (senão à esquerda; sem espaço dos lados,
   embaixo ou em cima); no celular, preso em cima ou embaixo, do lado
   oposto; sempre abaixo da barra do treino. As posições vão em
   --guia-balao-x/y (dado da tela).
   API: passo(guia), fim(guia), parado(guia), aviso(texto, guia), posicionar(els),
   acesos(), esconder(), peca().
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var DISTANCIA = 12;       // distância do balão aos alvos e às bordas da tela (px)
  var balao = null;
  var acesos = [];          // o que está aceso no passo (os alvos e os menus abertos por eles)

  function V() { return RW.guiaVeu; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function limitar(v, min, max) { return Math.max(min, Math.min(v, max)); }
  function peca() {
    if (!balao) {
      var molde = document.getElementById('tpl-guia-balao');
      balao = molde.content.firstElementChild.cloneNode(true);
      V().porNaTela(balao);
    }
    return balao;
  }
  function q(seletor) { return peca().querySelector(seletor); }
  /* no modo treino, a barra azul fica no alto: o balão não a cobre */
  function topo() {
    var barra = document.querySelector('.treino-barra:not(.oculto)');
    return DISTANCIA + (barra ? barra.getBoundingClientRect().bottom : 0);
  }
  function caixaDe(els) {
    var rs = els.map(function (e) { return e.getBoundingClientRect(); });
    return {
      x0: Math.min.apply(null, rs.map(function (r) { return r.left; })), y0: Math.min.apply(null, rs.map(function (r) { return r.top; })),
      x1: Math.max.apply(null, rs.map(function (r) { return r.right; })), y1: Math.max.apply(null, rs.map(function (r) { return r.bottom; }))
    };
  }
  /* o menu aberto pelo que está aceso (o botão dele, ou um campo de escolha dentro da caixa acesa) fica aceso também;
     o item de um menu aberto acende só ele, não o menu inteiro */
  function menusAbertos(els) {
    var menus = [];
    Array.prototype.forEach.call(document.querySelectorAll('.dropdown--aberto'), function (d) {
      var menu = d.querySelector(':scope > .dropdown-menu');
      if (!visivel(menu)) return;
      if (els.some(function (el) { return el.contains(d) || (d.contains(el) && !menu.contains(el)); })) menus.push(menu);
    });
    return menus;
  }

  /* o cabeçalho e o rodapé do balão: o nome do roteiro (no treino, ele está na barra azul), o "Passo N de M" e quais
     botões aparecem; sem nada para dizer, o cabeçalho some */
  function montar(guia, contador, botoes) {
    var b = peca();
    b.classList.add('guia-balao--passo');
    q('.guia-balao-titulo').textContent = guia.titulo;
    q('.guia-balao-titulo').classList.toggle('oculto', guia.treino);
    q('.guia-balao-contador').textContent = contador;
    q('.guia-balao-separador').classList.toggle('oculto', guia.treino || !contador);
    q('.guia-balao-sair').classList.toggle('oculto', !botoes.sair);
    q('.guia-balao-cabecalho').classList.toggle('oculto', guia.treino && !contador && !botoes.sair);
    q('.guia-balao-rodape').classList.toggle('oculto', !(botoes.proximo || botoes.concluir || botoes.treinos));
    q('.guia-balao-proximo').classList.toggle('oculto', !botoes.proximo);
    q('.guia-balao-concluir').classList.toggle('oculto', !botoes.concluir);
    q('.guia-balao-treinos').classList.toggle('oculto', !botoes.treinos);
    q('.guia-balao-treinos').classList.toggle('botao--texto', !!botoes.seguinte || !!botoes.recomecar);
    q('.guia-balao-seguinte-botao').classList.toggle('oculto', !botoes.seguinte);
    q('.guia-balao-recomecar').classList.toggle('oculto', !botoes.recomecar);
    Array.prototype.forEach.call(peca().querySelectorAll('.guia-balao-seguinte'), function (l) { l.classList.add('oculto'); });
  }
  /* o texto do passo vem do roteiro (o <p> do molde, com os destaques em <strong>) */
  function preencherTexto(p) {
    var texto = q('.guia-balao-texto');
    texto.textContent = '';
    Array.prototype.forEach.call(p.childNodes, function (n) { texto.appendChild(n.cloneNode(true)); });
  }
  /* no meio da tela (no celular, preso embaixo) */
  function noMeio() {
    var b = peca();
    b.classList.remove('oculto');
    b.classList.add('guia-balao--baixo');
    b.classList.remove('guia-balao--cima');
    b.style.setProperty('--guia-balao-x', Math.max(DISTANCIA, (window.innerWidth - b.offsetWidth) / 2) + 'px');
    b.style.setProperty('--guia-balao-y', Math.max(topo(), (window.innerHeight - b.offsetHeight) / 2) + 'px');
  }

  function passo(guia) {
    var p = guia.passos[guia.i].p;
    montar(guia, RW.mensagens.guia.contador(guia.i + 1, guia.passos.length), { sair: !guia.treino, proximo: p.getAttribute('data-avanca') === 'proximo' });
    preencherTexto(p);
  }
  /* no treino, a tela final fica toda no véu, só com a barra azul acesa: nada ali responde */
  function veuDoFinal(guia) {
    if (guia.treino) V().mostrar([]);
    else V().esconder();
    acesos = [];
  }
  function fim(guia) {
    veuDoFinal(guia);
    /* no treino, o fim leva ao próximo treino (ou de volta à lista) */
    var seguinte = guia.treino && guia.seguinte ? RW.guiaRoteiros.roteiro(guia.seguinte) : null;
    montar(guia, '', { concluir: !guia.treino, treinos: guia.treino, seguinte: !!seguinte });
    preencherTexto(guia.fim);
    if (seguinte) q('.guia-balao-seguinte-nome').textContent = RW.guiaRoteiros.aSeguir(guia.seguinte);
    if (guia.treino) q(seguinte ? '.guia-balao-seguinte:not(.guia-balao-todos)' : '.guia-balao-todos').classList.remove('oculto');
    noMeio();
  }
  /* o treino não pôde seguir no passo: a frase, o Recomeçar e o Voltar aos treinos */
  function parado(guia) {
    veuDoFinal(guia);
    montar(guia, '', { treinos: true, recomecar: true });
    q('.guia-balao-texto').textContent = RW.mensagens.guia.parado;
    noMeio();
  }
  /* a situação do passo não está na tela (ex.: o dia sem horário vazio): o texto que explica, sem o véu */
  function aviso(texto, guia) {
    V().esconder();
    acesos = [];
    montar(guia, '', { sair: !guia.treino });
    q('.guia-balao-texto').textContent = texto;
    noMeio();
  }

  function posicionar(els) {
    var b = peca();
    acesos = els.concat(menusAbertos(els));
    V().mostrar(acesos.map(V().caixaDe));
    b.classList.remove('oculto');
    var c = caixaDe(acesos);
    if (RW.guiaRoteiros.celular()) {
      var embaixo = (c.y0 + c.y1) / 2 < window.innerHeight / 2;
      b.classList.toggle('guia-balao--baixo', embaixo);
      b.classList.toggle('guia-balao--cima', !embaixo);
      return;
    }
    var W = window.innerWidth, H = window.innerHeight, bw = b.offsetWidth, bh = b.offsetHeight, x, y;
    c = { x0: Math.max(c.x0, 0), y0: Math.max(c.y0, 0), x1: Math.min(c.x1, W), y1: Math.min(c.y1, H) };
    if (W - c.x1 >= bw + DISTANCIA * 2) { x = c.x1 + DISTANCIA; y = c.y0; }
    else if (c.x0 >= bw + DISTANCIA * 2) { x = c.x0 - bw - DISTANCIA; y = c.y0; }
    else { x = c.x0; y = (c.y1 + DISTANCIA + bh <= H - DISTANCIA) ? c.y1 + DISTANCIA : c.y0 - bh - DISTANCIA; }
    b.style.setProperty('--guia-balao-x', limitar(x, DISTANCIA, W - bw - DISTANCIA) + 'px');
    b.style.setProperty('--guia-balao-y', limitar(y, topo(), H - bh - DISTANCIA) + 'px');
  }

  function esconder() {
    acesos = [];
    if (balao) { V().esconder(); balao.classList.add('oculto'); }
  }

  RW.guiaBalao = {
    passo: passo, fim: fim, parado: parado, aviso: aviso, posicionar: posicionar, esconder: esconder, peca: peca,
    acesos: function () { return acesos; }
  };
})();
