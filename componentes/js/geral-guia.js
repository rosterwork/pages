/* ============================================================
   GUIA — o passo a passo (RosterWork.guia)
   O botão ? (.pagina-ajuda) da linha do título abre a lista dos
   roteiros que passam pela tela, cada um a partir do passo desta
   tela, e o link do manual (data-manual = o id da seção). O
   Treinamento (geral-treino.js) começa os roteiros do início, no
   modo treino. Os roteiros e os atributos de cada passo estão em
   geral-guia-roteiros.js; o balão, em geral-guia-balao.js; o véu, em
   geral-guia-veu.js. Aqui, a cada 200 ms, o passo em curso: pular,
   acender os alvos, pôr o balão e avançar. Tela ou painel
   carregando: o balão espera (até 30 s); outra tela que não é a do
   passo, ou 5 s sem o alvo: o roteiro termina. O passo com
   data-sem-alvo não termina: sem o alvo (ou sem o data-requer, a
   situação que ele pede), o balão diz por que o passo não dá ali e
   espera a situação aparecer (ex.: outro dia aberto). Com menu,
   calendário ou modal aberto sem o alvo dentro, espera escondido; o
   menu aberto pelo alvo acende junto. No passo, responde só o que é
   do roteiro: no de olhar (Próximo), nada do aceso; no livre
   (data-livre), o aceso inteiro; no de clique e no de gravar (some),
   só o botão que ele pede; na escolha, só os caminhos; nos de
   preencher, o aceso inteiro. O balão, a barra do treino e a rolagem
   sempre: desistir é pelo Sair do balão ou pela barra do treino. A dica da primeira vez
   acende o ?. O que a pessoa já viu e a lista do ? ficam no
   geral-guia-ajuda.js. Moldes: #tpl-guia-balao e #tpl-guia-dica.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TIQUE = 200;          // ms entre as conferências do passo (o alvo, o valor e a posição)
  var ESPERA_ALVO = 25;     // tiques sem o alvo até o guia terminar (5 s)
  var ESPERA_OPCIONAL = 4;  // tiques sem o alvo até pular o passo opcional
  var ESPERA_AVISO = 20;    // tiques sem o alvo até o balão dizer por que o passo não dá (data-sem-alvo; 4 s: a lista que chega devagar, sem carregamento à vista, não mostra a frase antes da hora)
  var ESPERA_TELA = 150;    // tiques esperando a tela do passo carregar (30 s: o mês de treino lançado da Extrajornada leva uns 15 s)
  var DISTANCIA = 12;       // distância da dica ao ? e às bordas da tela (px)
  var ESPERAR = '.dropdown--aberto, .calendario--aberto, .modal-veu--aberto';
  var BOTAO_DA_PAGINA = '.conteudo > .pagina > .pagina-cabecalho > .pagina-ajuda > .botao';   // o ? da página (não os exemplos do Guia visual)

  var guia = null;          // o roteiro em curso: { id, titulo, passos, fim, treino, i, fase, mostrado, semAlvo, avisando, pagina }
  var dica = null;          // a dica, clonada do molde uma vez só
  var timer = null;

  function R() { return RW.guiaRoteiros; }
  function V() { return RW.guiaVeu; }
  function B() { return RW.guiaBalao; }
  function A() { return RW.guiaAjuda; }
  function conteudo() { return document.querySelector('.conteudo'); }
  function paginaAtual() { var c = conteudo(); return c ? c.querySelector('.pagina') : null; }
  function nomeDaPagina() { return RW.paginaAtual ? RW.paginaAtual() : null; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function limitar(v, min, max) { return Math.max(min, Math.min(v, max)); }
  /* o seletor escrito errado num roteiro não derruba o guia: só não acha nada */
  function todos(seletor) { try { return document.querySelectorAll(seletor); } catch (e) { return []; } }
  function um(seletor) { try { return document.querySelector(seletor); } catch (e) { return null; } }
  function pecas() {
    if (dica) return;
    B().peca();
    var molde = document.getElementById('tpl-guia-dica');
    dica = molde.content.firstElementChild.cloneNode(true);
    V().porNaTela(dica);
  }
  function esconderPecas() { if (guia) guia.avisando = false; B().esconder(); }

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
      i: 0, fase: 'passo', mostrado: false, semAlvo: 0, avisando: false, esperaTela: 0, pagina: paginaAtual()
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
  /* chegou ao fim: no treino, conta como visto (o ? é ajuda, não treino); espera os modais (ex.: o resumo do pedido)
     para o balão final */
  function concluir() {
    if (guia.treino) A().marcarVisto(guia.id);
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
      Array.prototype.forEach.call(todos(s), function (el) {
        if (anel === 'campo') el = el.closest('.campo') || el;
        if (anel === 'caixa') el = el.closest('.grupo-caixa') || el;
        if (visivel(el) && lista.indexOf(el) < 0) lista.push(el);
      });
    });
    return lista;
  }
  function naJanela(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  /* data-um: só o primeiro alvo (o primeiro à vista, quando há); data-requer: sem a situação na tela, o passo fica sem alvo */
  function alvosDo(passo) {
    var p = passo.p, anel = p.getAttribute('data-anel'), requer = p.getAttribute('data-requer');
    if (requer && !elementos(R().seletores(requer)).length) return [];
    var lista = elementos(seletoresDo(passo), anel);
    if (!lista.length && p.getAttribute('data-alvo-senao')) lista = elementos(R().seletores(p.getAttribute('data-alvo-senao')), anel);
    if (p.hasAttribute('data-um') && lista.length > 1) lista = [lista.filter(naJanela)[0] || lista[0]];
    return lista;
  }
  /* o passo é desta tela (ou do menu, que está em todas)? */
  function naTela(passo) { return !passo.pagina || passo.pagina === 'qualquer' || passo.pagina === nomeDaPagina(); }
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

  /* algo ainda carregando à vista: o véu da tela, ou o círculo ou os pontos de uma área (a grade da Escala, a área da
     Extrajornada, uma lista, o painel aberto). O círculo do véu escondido (some pela opacidade), o do painel fechado e o
     do cálculo da sugestão da Extrajornada (que é um passo do roteiro) não contam */
  function carregando() {
    if (document.querySelector('.conteudo > .carregando-veu--visivel')) return true;
    var sinais = '.conteudo .giratorio, .conteudo .carregando-pontos, .painel-lateral--aberto .painel-estado--carregando, ' +
      '.painel-lateral--aberto .carregando-pontos';
    return Array.prototype.some.call(document.querySelectorAll(sinais), function (g) {
      return visivel(g) && !g.closest('.carregando-veu, .nova-extra-calculo, .painel-lateral:not(.painel-lateral--aberto)') &&
        getComputedStyle(g).visibility !== 'hidden';
    });
  }

  /* o passo pede para ser pulado agora? */
  function pulaAgora(p) {
    var pular = p.getAttribute('data-pular-se');
    if (pular && um(pular)) return true;
    var cel = R().celular();
    return (cel && p.hasAttribute('data-so-computador')) || (!cel && p.hasAttribute('data-so-celular'));
  }

  /* sem o alvo: o passo com data-sem-alvo diz por que não dá e espera (mesmo com um menu aberto); o opcional é pulado;
     com menu ou modal aberto, os outros esperam sem contar; os demais terminam o roteiro */
  function semAlvo(p) {
    var opcional = p.hasAttribute('data-opcional'), texto = p.getAttribute('data-sem-alvo');
    if (!opcional && !texto && document.querySelector(ESPERAR)) { esconderPecas(); return; }
    if (!guia.avisando) esconderPecas();
    guia.semAlvo++;
    if (texto) {
      if (guia.semAlvo > ESPERA_AVISO && !guia.avisando) { B().aviso(texto, guia); guia.avisando = true; guia.mostrado = false; }
      return;
    }
    if (guia.semAlvo > (opcional ? ESPERA_OPCIONAL : ESPERA_ALVO)) { if (opcional) pular(); else encerrar(); }
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
    if (avanca === 'some' && guia.mostrado && condicao && !um(condicao)) {
      if (document.querySelector('.modal-veu--aberto')) concluir(); else encerrar();
      return;
    }
    if (guia.fase === 'esperaFim') {
      if (document.querySelector(ESPERAR)) { esconderPecas(); return; }
      guia.fase = 'fim';
      if (guia.treino) guia.seguinte = A().proximoTreino(guia.id);
      if (guia.fim) B().fim(guia); else encerrar();
      return;
    }
    /* a tela ainda carregando (o véu dela): o passo espera, para o clique não chegar antes de a tela estar pronta */
    if (!naTela(passo) || carregando()) {
      esconderPecas();
      guia.semAlvo = 0;
      if (++guia.esperaTela > ESPERA_TELA) encerrar();
      return;
    }
    guia.esperaTela = 0;
    if (pulaAgora(p)) { pular(); return; }
    var els = alvosDo(passo);
    if (!els.length) { semAlvo(p); return; }
    if (esperando(els)) { esconderPecas(); return; }
    guia.semAlvo = 0;
    guia.avisando = false;
    if (!guia.mostrado) { rolarAte(els); B().passo(guia); guia.mostrado = true; }
    B().posicionar(els);
    if (avanca === 'aparece') { if (Array.prototype.some.call(todos(condicao), visivel)) avancar(); return; }
    if (avanca !== 'preenchido') return;
    /* o valor é o do próprio campo (o data-condicao, ou o 1º seletor do alvo), não o da moldura do campo */
    var campo = um(condicao || seletoresDo(passo)[0]);
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

  /* o que o clique do passo pede: o data-clique ou, sem ele, o alvo (na escolha, as entradas dos caminhos) */
  function seletoresDoClique(passo) {
    var clique = passo.p.getAttribute('data-clique');
    return clique ? R().seletores(clique) : seletoresDo(passo);
  }
  function casa(el, seletores) { return seletores.some(function (s) { try { return !!el.closest(s); } catch (e) { return false; } }); }

  /* ---------- durante um passo, responde só o que é do roteiro, dentro do aceso (os alvos e os menus abertos por eles):
     no de olhar (Próximo), nada; no livre (data-livre), o aceso inteiro; no de clique, no de gravar (some: o Salvar,
     não o Cancelar ao lado) e na escolha, só o que eles pedem; nos de preencher (preenchido, aparece), o aceso inteiro.
     O balão e a barra do treino (que tira do treino)
     sempre. O toque e o mouse valem pelo ponto (cai num buraco do véu?); o clique do teclado, pelo elemento. Rolar a
     tela continua ---------- */
  function bloqueado(evento) {
    if (!guia || guia.fase !== 'passo' || !guia.mostrado || !V().visivel()) return false;
    var alvo = evento.target;
    if (!alvo.closest || alvo.closest('.guia-balao, .treino-barra')) return false;
    var noAceso = evento.type === 'click' && evento.detail === 0
      ? B().acesos().some(function (el) { return el.contains(alvo); })
      : V().aceso(evento.clientX, evento.clientY);
    if (!noAceso) return true;
    var passo = guia.passos[guia.i], p = passo.p, avanca = p.getAttribute('data-avanca');
    if (p.hasAttribute('data-livre')) return false;
    if (avanca === 'proximo') return true;
    if (avanca === 'clique' || avanca === 'escolha' || avanca === 'some') return !casa(alvo, seletoresDoClique(passo));
    return false;
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
    if (alvo.closest('.guia-balao-seguinte-botao')) {
      var seguinte = guia && guia.seguinte;
      encerrar();
      if (seguinte && RW.treino) RW.treino.seguir(seguinte);
      return;
    }
    if (alvo.closest('.guia-balao-proximo')) { avancar(); return; }
    if (!guia || guia.fase !== 'passo' || !guia.mostrado) return;
    var passo = guia.passos[guia.i];
    var acertou = casa(alvo, seletoresDoClique(passo));
    /* no treino, o clique que gravaria fica com o guia: o roteiro vai ao fim (o menu e o aviso abertos fecham, como o
       clique faria) */
    if (acertou && guia.treino && passo.p.hasAttribute('data-segurar')) {
      evento.preventDefault();
      evento.stopPropagation();
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      if (alvo.closest('.modal-veu') && RW.fecharModais) RW.fecharModais();
      concluir();
      return;
    }
    var avanca = passo.p.getAttribute('data-avanca');
    /* escolha: o caminho clicado entra na fila, logo depois deste passo. O passo deixa de ouvir na hora: o clique no
       rótulo de uma bolinha chega de novo, pela própria bolinha */
    if (avanca === 'escolha') {
      var caminho = R().caminho(passo, alvo);
      if (!caminho) return;
      guia.passos = guia.passos.slice(0, guia.i + 1).concat(caminho.passos, guia.passos.slice(guia.i + 1));
      var fim = (guia.treino && caminho.fimTreino) || caminho.fim;
      if (fim) guia.fim = fim;
      /* no treino, a entrada do caminho que já grava fica com o guia, como o clique segurado */
      if (guia.treino && caminho.segurar) { evento.preventDefault(); evento.stopPropagation(); concluir(); return; }
      guia.mostrado = false;
      setTimeout(avancar, 0);
      return;
    }
    /* passo "clique": avança depois que o clique fizer o efeito dele na página */
    if (avanca === 'clique' && acertou) { guia.mostrado = false; setTimeout(avancar, 0); }
  }, true);

  /* a página trocou: o roteiro confere a tela nova (no tique) e a dica também */
  function vigiarPaginas() {
    var c = conteudo();
    if (!c || !window.MutationObserver) return;
    new MutationObserver(function () { talvezDica(); if (guia) ligarTimer(); }).observe(c, { childList: true });
    talvezDica();
  }

  RW.guia = {
    iniciar: iniciar, encerrar: encerrar, visto: function (id) { return A().visto(id); },
    emCurso: function () { return guia ? guia.id : null; },
    proximo: function (id) { return A().proximoTreino(id || null); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiarPaginas);
  else vigiarPaginas();
})();
