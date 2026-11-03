/* ============================================================
   GUIA — o passo a passo (RosterWork.guia)
   O botão ? (.pagina-ajuda) da linha do título abre a lista dos
   roteiros que passam pela tela, cada um a partir do passo desta
   tela, e o link do manual (data-manual = o id da seção). O
   Treinamento (geral-treino.js) começa os roteiros do início, no
   modo treino. Os roteiros e os atributos de cada passo estão em
   geral-guia-roteiros.js; o véu, em geral-guia-veu.js. Aqui, a cada
   200 ms, o passo em curso: pular, acender os alvos, pôr o balão e
   avançar. Tela ou painel carregando: o balão espera (até 15 s);
   outra tela que não é a do passo, ou 5 s sem o alvo: o roteiro
   termina. Com menu, calendário ou modal aberto sem o alvo dentro,
   espera escondido; o menu aberto pelo alvo acende junto. No passo,
   só o aceso, o balão e a barra do treino respondem ao clique.
   A dica da primeira vez acende o ?. O que a
   pessoa já viu e a lista do ? ficam no geral-guia-ajuda.js.
   Moldes: #tpl-guia-balao e #tpl-guia-dica (index.html).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TIQUE = 200;          // ms entre as conferências do passo (o alvo, o valor e a posição)
  var ESPERA_ALVO = 25;     // tiques sem o alvo até o guia terminar (5 s)
  var ESPERA_OPCIONAL = 4;  // tiques sem o alvo até pular o passo opcional
  var ESPERA_TELA = 75;     // tiques esperando a tela do passo carregar (15 s)
  var DISTANCIA = 12;       // distância do balão ao alvo e às bordas da tela (px)
  var ESPERAR = '.dropdown--aberto, .calendario--aberto, .modal-veu--aberto';
  var BOTAO_DA_PAGINA = '.conteudo > .pagina > .pagina-cabecalho > .pagina-ajuda > .botao';   // o ? da página (não os exemplos do Guia visual)

  var guia = null;          // o roteiro em curso: { id, titulo, passos, fim, treino, i, fase, mostrado, semAlvo, pagina }
  var balao = null, dica = null;   // as peças, clonadas dos moldes uma vez só
  var acesos = [];          // o que está aceso no passo (os alvos e os menus abertos por eles)
  var timer = null;

  function R() { return RW.guiaRoteiros; }
  function V() { return RW.guiaVeu; }
  function A() { return RW.guiaAjuda; }
  function conteudo() { return document.querySelector('.conteudo'); }
  function paginaAtual() { var c = conteudo(); return c ? c.querySelector('.pagina') : null; }
  function nomeDaPagina() { return RW.paginaAtual ? RW.paginaAtual() : null; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function limitar(v, min, max) { return Math.max(min, Math.min(v, max)); }
  function clonar(id) { var t = document.getElementById(id); return t ? t.content.firstElementChild.cloneNode(true) : null; }
  function pecas() {
    if (balao) return;
    balao = clonar('tpl-guia-balao');
    dica = clonar('tpl-guia-dica');
    V().porNaTela(balao);
    V().porNaTela(dica);
  }
  function esconderPecas() { if (balao) { V().esconder(); balao.classList.add('oculto'); } }
  /* no modo treino, a barra azul fica no alto: o balão não a cobre */
  function topo() {
    var barra = document.querySelector('.treino-barra:not(.oculto)');
    return DISTANCIA + (barra ? barra.getBoundingClientRect().bottom : 0);
  }

  /* ---------- o roteiro ---------- */
  /* opcoes: { pagina } começa no passo desta tela (o ?); { treino } no modo treino */
  function iniciar(id, opcoes) {
    opcoes = opcoes || {};
    var t = R().roteiro(id);
    var passos = t ? R().passos(id, opcoes.pagina || null) : null;
    if (!passos || !passos.length) return;
    pecas();
    encerrar();
    esconderDica(true);
    var treino = !!opcoes.treino || !!(RW.treino && RW.treino.ligado());
    guia = {
      id: id, titulo: t.getAttribute('data-titulo'), passos: passos, treino: treino,
      fim: (treino && R().fimDe(t.content, true)) || R().fimDe(t.content, false),
      i: 0, fase: 'passo', mostrado: false, semAlvo: 0, esperaTela: 0, pagina: paginaAtual()
    };
    ligarTimer();
  }
  function encerrar() {
    guia = null;
    esconderPecas();
    desligarTimerSeParado();
  }
  function proximoPasso() {
    guia.mostrado = false;
    guia.semAlvo = 0;
    esconderPecas();
    if (guia.i >= guia.passos.length) concluir();
  }
  function avancar() { if (guia) { guia.i++; proximoPasso(); } }
  /* o passo pulado sai da fila (a contagem diminui) */
  function pular() { guia.passos.splice(guia.i, 1); proximoPasso(); }
  /* chegou ao fim: conta como visto e espera os modais (ex.: o resumo do pedido) para o balão final */
  function concluir() {
    A().marcarVisto(guia.id);
    guia.fase = 'esperaFim';
    esconderPecas();
  }

  function seletoresDo(passo) {
    return passo.caminhos.length ? R().entradas(passo) : R().seletores(passo.p.getAttribute('data-alvo'));
  }
  /* anel: "campo" acende o campo inteiro (com o rótulo); "caixa", a caixa da pergunta (.grupo-caixa) */
  function elementos(seletores, anel) {
    var lista = [];
    seletores.forEach(function (s) {
      Array.prototype.forEach.call(document.querySelectorAll(s), function (el) {
        if (anel === 'campo') el = el.closest('.campo') || el;
        if (anel === 'caixa') el = el.closest('.grupo-caixa') || el;
        if (visivel(el) && lista.indexOf(el) < 0) lista.push(el);
      });
    });
    return lista;
  }
  function naJanela(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  /* data-um: só o primeiro alvo (o primeiro à vista, quando há) */
  function alvosDo(passo) {
    var p = passo.p, anel = p.getAttribute('data-anel');
    var lista = elementos(seletoresDo(passo), anel);
    if (!lista.length && p.getAttribute('data-alvo-senao')) lista = elementos(R().seletores(p.getAttribute('data-alvo-senao')), anel);
    if (p.hasAttribute('data-um') && lista.length > 1) lista = [lista.filter(naJanela)[0] || lista[0]];
    return lista;
  }
  /* o passo é desta tela (ou do menu, que está em todas)? */
  function naTela(passo) { return !passo.pagina || passo.pagina === 'qualquer' || passo.pagina === nomeDaPagina(); }
  function caixaDe(els) {
    var rs = els.map(function (e) { return e.getBoundingClientRect(); });
    return {
      x0: Math.min.apply(null, rs.map(function (r) { return r.left; })), y0: Math.min.apply(null, rs.map(function (r) { return r.top; })),
      x1: Math.max.apply(null, rs.map(function (r) { return r.right; })), y1: Math.max.apply(null, rs.map(function (r) { return r.bottom; }))
    };
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

  function mostrarPasso() {
    var p = guia.passos[guia.i].p;
    balao.classList.add('guia-balao--passo');
    balao.querySelector('.guia-balao-titulo').textContent = guia.titulo;
    balao.querySelector('.guia-balao-contador').textContent = RW.mensagens.guia.contador(guia.i + 1, guia.passos.length);
    balao.querySelector('.guia-balao-separador').classList.remove('oculto');
    balao.querySelector('.guia-balao-sair').classList.remove('oculto');
    preencherTexto(p);
    var comProximo = p.getAttribute('data-avanca') === 'proximo';
    balao.querySelector('.guia-balao-rodape').classList.toggle('oculto', !comProximo);
    balao.querySelector('.guia-balao-proximo').classList.toggle('oculto', !comProximo);
    balao.querySelector('.guia-balao-concluir').classList.add('oculto');
    balao.querySelector('.guia-balao-treinos').classList.add('oculto');
  }
  /* o texto do passo vem do roteiro (o <p> do molde, com os destaques em <strong>) */
  function preencherTexto(p) {
    var texto = balao.querySelector('.guia-balao-texto');
    texto.textContent = '';
    Array.prototype.forEach.call(p.childNodes, function (n) { texto.appendChild(n.cloneNode(true)); });
  }
  function posicionar(els) {
    acesos = els.concat(menusAbertos(els));
    V().mostrar(acesos.map(V().caixaDe));
    var c = caixaDe(acesos);
    if (R().celular()) {
      var embaixo = (c.y0 + c.y1) / 2 < window.innerHeight / 2;
      balao.classList.toggle('guia-balao--baixo', embaixo);
      balao.classList.toggle('guia-balao--cima', !embaixo);
      return;
    }
    /* no computador: ao lado dos alvos (direita, senão esquerda); sem espaço dos lados, embaixo ou em cima */
    var W = window.innerWidth, H = window.innerHeight, bw = balao.offsetWidth, bh = balao.offsetHeight, x, y;
    c = { x0: Math.max(c.x0, 0), y0: Math.max(c.y0, 0), x1: Math.min(c.x1, W), y1: Math.min(c.y1, H) };
    if (W - c.x1 >= bw + DISTANCIA * 2) { x = c.x1 + DISTANCIA; y = c.y0; }
    else if (c.x0 >= bw + DISTANCIA * 2) { x = c.x0 - bw - DISTANCIA; y = c.y0; }
    else { x = c.x0; y = (c.y1 + DISTANCIA + bh <= H - DISTANCIA) ? c.y1 + DISTANCIA : c.y0 - bh - DISTANCIA; }
    balao.style.setProperty('--guia-balao-x', limitar(x, DISTANCIA, W - bw - DISTANCIA) + 'px');
    balao.style.setProperty('--guia-balao-y', limitar(y, topo(), H - bh - DISTANCIA) + 'px');
  }
  function mostrarFim() {
    if (!guia.fim) { encerrar(); return; }
    V().esconder();
    balao.classList.add('guia-balao--passo');
    balao.querySelector('.guia-balao-titulo').textContent = guia.titulo;
    balao.querySelector('.guia-balao-contador').textContent = '';
    balao.querySelector('.guia-balao-separador').classList.add('oculto');
    balao.querySelector('.guia-balao-sair').classList.add('oculto');
    preencherTexto(guia.fim);
    balao.querySelector('.guia-balao-rodape').classList.remove('oculto');
    balao.querySelector('.guia-balao-proximo').classList.add('oculto');
    /* no treino, o fim leva de volta à lista dos treinos */
    balao.querySelector('.guia-balao-concluir').classList.toggle('oculto', guia.treino);
    balao.querySelector('.guia-balao-treinos').classList.toggle('oculto', !guia.treino);
    balao.classList.remove('oculto');
    /* no meio da tela (no celular, preso embaixo) */
    balao.classList.add('guia-balao--baixo');
    balao.classList.remove('guia-balao--cima');
    balao.style.setProperty('--guia-balao-x', Math.max(DISTANCIA, (window.innerWidth - balao.offsetWidth) / 2) + 'px');
    balao.style.setProperty('--guia-balao-y', Math.max(topo(), (window.innerHeight - balao.offsetHeight) / 2) + 'px');
  }

  /* a tela (o véu dela) ou o painel (o carregando dele, o geral e o do dia) ainda carregando */
  function carregando() {
    return !!document.querySelector('.conteudo > .carregando-veu--visivel') ||
      Array.prototype.some.call(document.querySelectorAll('.painel-lateral--aberto .painel-estado--carregando, .painel-lateral--aberto .escala-distribuicao-carregando'), visivel);
  }

  /* o passo pede para ser pulado agora? */
  function pulaAgora(p) {
    var pular = p.getAttribute('data-pular-se');
    if (pular && document.querySelector(pular)) return true;
    var cel = R().celular();
    return (cel && p.hasAttribute('data-so-computador')) || (!cel && p.hasAttribute('data-so-celular'));
  }

  /* a cada tique: confere a tela e o passo (pular, sumir, valor) e acompanha os alvos na tela */
  function tique() {
    conferirDica();
    if (!guia) { desligarTimerSeParado(); return; }
    var passo = guia.fase === 'passo' ? guia.passos[guia.i] : null;
    var pagina = paginaAtual();
    /* trocou de tela: segue quando o passo é da tela nova; senão, a pessoa saiu do caminho */
    if (pagina && guia.pagina !== pagina) {
      if (passo && naTela(passo)) guia.pagina = pagina;
      else { encerrar(); return; }
    }
    if (guia.fase === 'fim') return;
    var p = passo ? passo.p : null;
    var avanca = p ? p.getAttribute('data-avanca') : null;
    var condicao = p ? p.getAttribute('data-condicao') : null;
    /* passo "some": o formulário saiu da tela; com o resumo aberto, foi enviado; sem ele, a pessoa desistiu */
    if (avanca === 'some' && guia.mostrado && condicao && !document.querySelector(condicao)) {
      if (document.querySelector('.modal-veu--aberto')) concluir(); else encerrar();
      return;
    }
    if (guia.fase === 'esperaFim') {
      if (document.querySelector(ESPERAR)) { esconderPecas(); return; }
      guia.fase = 'fim'; mostrarFim(); return;
    }
    /* a tela ainda carregando (o véu dela): o passo espera, para o clique não chegar antes de a tela estar pronta */
    if (!naTela(passo) || carregando()) {
      esconderPecas();
      if (++guia.esperaTela > ESPERA_TELA) encerrar();
      return;
    }
    guia.esperaTela = 0;
    if (naTela(passo) && pulaAgora(p)) { pular(); return; }
    var els = alvosDo(passo);
    if (!els.length) {
      esconderPecas();
      var opcional = p.hasAttribute('data-opcional');
      if (++guia.semAlvo > (opcional ? ESPERA_OPCIONAL : ESPERA_ALVO)) {
        if (opcional) pular(); else encerrar();
      }
      return;
    }
    if (esperando(els)) { esconderPecas(); return; }
    guia.semAlvo = 0;
    if (!guia.mostrado) { rolarAte(els); mostrarPasso(); guia.mostrado = true; }
    balao.classList.remove('oculto');
    posicionar(els);
    if (avanca === 'aparece') { if (visivel(document.querySelector(condicao))) avancar(); return; }
    if (avanca !== 'preenchido') return;
    /* o valor é o do próprio campo (o data-condicao, ou o 1º seletor do alvo), não o da moldura do campo */
    var campo = document.querySelector(condicao || seletoresDo(passo)[0]);
    var marcavel = campo && (campo.type === 'radio' || campo.type === 'checkbox');
    if (campo && (marcavel ? campo.checked : (typeof campo.value === 'string' && campo.value.trim() !== ''))) avancar();
  }
  function ligarTimer() { if (!timer) timer = setInterval(tique, TIQUE); }
  function desligarTimerSeParado() {
    if (timer && !guia && !(dica && !dica.classList.contains('oculto'))) { clearInterval(timer); timer = null; }
  }

  /* ---------- a dica da primeira vez: o ? aceso, com o resto da tela no véu ---------- */
  function conferirDica() {
    if (!dica) return;
    var botao = document.querySelector(BOTAO_DA_PAGINA);
    var mostrar = visivel(botao) && !guia && !A().dicaVista() && !document.querySelector(ESPERAR);
    var estava = !dica.classList.contains('oculto');
    dica.classList.toggle('oculto', !mostrar);
    if (!mostrar) { if (estava && !guia) V().esconder(); return; }
    var r = botao.getBoundingClientRect(), W = window.innerWidth;
    V().mostrar([V().caixaDe(botao)]);
    dica.style.setProperty('--guia-balao-x', limitar(r.right - dica.offsetWidth, DISTANCIA, W - dica.offsetWidth - DISTANCIA) + 'px');
    dica.style.setProperty('--guia-balao-y', (r.bottom + DISTANCIA / 2) + 'px');
  }
  function talvezDica() {
    if (A().dicaVista() || !document.querySelector(BOTAO_DA_PAGINA)) return;
    pecas();
    ligarTimer();
  }
  function esconderDica(gravar) {
    if (dica && !dica.classList.contains('oculto')) { dica.classList.add('oculto'); if (!guia) V().esconder(); }
    if (gravar) A().marcarDica();
  }

  /* ---------- durante um passo, só o que está aceso responde: os alvos, os menus abertos por eles, o balão e a barra
     do treino (que tira do treino). O toque e o mouse valem pelo ponto (cai num buraco do véu?); o clique do teclado,
     pelo elemento. Rolar a tela continua ---------- */
  function bloqueado(evento) {
    if (!guia || guia.fase !== 'passo' || !guia.mostrado || !V().visivel()) return false;
    var alvo = evento.target;
    if (!alvo.closest || alvo.closest('.guia-balao, .treino-barra')) return false;
    if (evento.type === 'click' && evento.detail === 0) return !acesos.some(function (el) { return el.contains(alvo); });
    return !V().aceso(evento.clientX, evento.clientY);
  }
  function segurar(evento) {
    if (!bloqueado(evento)) return false;
    evento.preventDefault();
    evento.stopPropagation();
    return true;
  }
  document.addEventListener('mousedown', segurar, true);
  /* o dedo: só para a propagação (sem preventDefault, para a rolagem continuar) */
  ['pointerdown', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function (evento) {
      var toque = evento.touches && evento.touches[0];
      var ponto = toque ? { type: tipo, target: evento.target, clientX: toque.clientX, clientY: toque.clientY } : evento;
      if (bloqueado(ponto)) evento.stopPropagation();
    }, { capture: true, passive: true });
  });

  /* ---------- cliques (na captura: o menu do ? se monta antes de o dropdown abrir, e o clique segurado do treino
     não chega à tela) ---------- */
  document.addEventListener('click', function (evento) {
    if (segurar(evento)) return;
    var alvo = evento.target;
    var gatilho = alvo.closest('.pagina-ajuda > .botao');
    if (gatilho) { esconderDica(true); A().montarMenu(gatilho.parentElement); return; }
    var item = alvo.closest('.guia-menu-item');
    if (item) { iniciar(item.getAttribute('data-guia'), { pagina: nomeDaPagina() }); return; }
    if (alvo.closest('.guia-menu-manual')) {
      var ajuda = alvo.closest('.pagina-ajuda');
      if (RW.irParaPagina) RW.irParaPagina('manual', null, ajuda ? ajuda.getAttribute('data-manual') : null);
      return;
    }
    if (alvo.closest('.guia-dica-entendi')) { esconderDica(true); return; }
    if (alvo.closest('.guia-balao-sair') || alvo.closest('.guia-balao-concluir')) { encerrar(); return; }
    if (alvo.closest('.guia-balao-treinos')) { encerrar(); if (RW.treino) RW.treino.voltarAosTreinos(); return; }
    if (alvo.closest('.guia-balao-proximo')) { avancar(); return; }
    if (!guia || guia.fase !== 'passo' || !guia.mostrado) return;
    var passo = guia.passos[guia.i];
    var clique = passo.p.getAttribute('data-clique');
    var acertou = (clique ? R().seletores(clique) : seletoresDo(passo)).some(function (s) { return alvo.closest(s); });
    /* no treino, o clique que gravaria fica com o guia: o roteiro vai ao fim */
    if (acertou && guia.treino && passo.p.hasAttribute('data-segurar')) {
      evento.preventDefault();
      evento.stopPropagation();
      concluir();
      return;
    }
    var avanca = passo.p.getAttribute('data-avanca');
    /* escolha: o caminho clicado entra na fila, logo depois deste passo */
    if (avanca === 'escolha') {
      var caminho = R().caminho(passo, alvo);
      if (!caminho) return;
      guia.passos = guia.passos.slice(0, guia.i + 1).concat(caminho.passos, guia.passos.slice(guia.i + 1));
      var fim = (guia.treino && caminho.fimTreino) || caminho.fim;
      if (fim) guia.fim = fim;
      setTimeout(avancar, 0);
      return;
    }
    /* passo "clique": avança depois que o clique fizer o efeito dele na página */
    if (avanca === 'clique' && acertou) setTimeout(avancar, 0);
  }, true);

  /* a página trocou: o roteiro confere a tela nova (no tique) e a dica também */
  function vigiarPaginas() {
    var c = conteudo();
    if (!c || !window.MutationObserver) return;
    new MutationObserver(function () { talvezDica(); if (guia) ligarTimer(); }).observe(c, { childList: true });
    talvezDica();
  }

  RW.guia = { iniciar: iniciar, encerrar: encerrar, visto: function (id) { return A().visto(id); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiarPaginas);
  else vigiarPaginas();
})();
