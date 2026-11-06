/* ============================================================
   GUIA › VIDRO — a trava do treino (RosterWork.guiaVidro)
   Uma peça transparente por cima da tela inteira, ligada do começo ao
   fim do treino. Ela engole o clique, o
   toque, o botão direito e o arrasto; no recorte dela fica no máximo
   uma porta, o controle que o passo pede. O balão e o Sair do treino
   ficam fora da regra e sempre respondem; o Recomeçar da barra azul
   também, menos com uma janela aberta.

   A porta (porta()), perguntada a cada desenho e a cada clique:
   - passo de olhar, tela carregando, entre um passo e outro, tela
     final e treino parado: nenhuma;
   - data-porta do passo: os estágios, separados por ponto e vírgula;
     vale o último que está à vista (o campo; com a lista aberta, o
     item dela); vazio, nenhuma (o passo espera sozinho);
   - sem data-porta: o data-treino-alvo, o data-clique ou o alvo, só o
     primeiro à vista; na escolha, uma por caminho;
   - com uma janela aberta: a porta do passo, quando ela está dentro da
     janela; senão, um botão só (o Cancelar, quando há; senão, o botão
     principal). A porta de fora fecha no instante em que a janela abre.

   A segunda trava (conferirClique): na janela do navegador, antes de
   qualquer outro código, o que não é da porta é engolido, mesmo que
   caia num buraco atrasado. Só vale o clique simples do botão esquerdo.
   O gesto que começou na porta termina nela, mesmo que a porta mude no
   meio (a lista abre no clique do campo).

   Teclado (aoTeclar): só na porta e no balão, também com uma janela
   aberta. O Tab anda só por eles; o Enter e o Espaço valem como o
   clique; o Esc e os atalhos não fazem nada. Escrever, só no passo com
   data-escrever. Ficam de fora as teclas do navegador (F5, Ctrl+R e o
   zoom).

   Rolagem: a rodinha e o dedo passam para a área embaixo do vidro, e a
   porta acompanha.

   O passo com data-so-mouse ("passe o mouse") abre o buraco no alvo só
   para o mouse passar: o clique continua engolido pela segunda trava.

   A janela que o passo não pede (avisoNaFrente): o balão ao lado dela
   diz o que fazer e o passo espera. A mesma janela de novo no mesmo
   passo para o treino, quando ela fechar.

   API: ligar(guia, ferramentas), desligar(), porta(), avisoNaFrente().
   Molde: #tpl-guia-vidro. O recorte vai em --guia-recorte (dado da tela).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var REDESENHO = 100;      // ms entre as conferências da porta (ela acompanha a tela)
  var LINHA_RODINHA = 16;   // px de uma linha da rodinha do mouse
  var JANELA = '.modal-veu--aberto';
  var SEMPRE = '.guia-balao, .treino-barra-sair';
  var RECOMECAR_DA_BARRA = '.treino-barra-recomecar';
  /* em cada janela, na ordem do HTML: o Cancelar vem antes do botão principal */
  var SAIDA_DA_JANELA = '.aviso-cancelar:not(.oculto), .data-modal-cancelar, .aviso-confirmar, .modal-rodape .botao--primario';
  var FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var vidro = null;
  var guia = null;           // o roteiro em curso, enquanto o vidro está ligado
  var ferramentas = null;    // do geral-guia.js: alvosDo, elementos, carregando, parar, balaoFinal, esconderPecas
  var relogio = null;
  var gesto = null;          // a porta onde o clique em curso começou
  var dedo = null;           // o último ponto do dedo que rola
  var portaVista = null;     // a porta que a tela já rolou para mostrar
  var recorteDesenhado = '';

  function R() { return RW.guiaRoteiros; }
  function V() { return RW.guiaVeu; }
  function B() { return RW.guiaBalao; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function janelaAberta() { return document.querySelector(JANELA); }
  function passoEmCurso() { return guia && guia.fase === 'passo' ? guia.passos[guia.i] : null; }

  function peca() {
    if (vidro) return vidro;
    vidro = RW.tpl('tpl-guia-vidro');
    document.body.insertBefore(vidro, document.querySelector('body > .guia-balao') || document.getElementById('treino-moldura'));
    vidro.addEventListener('wheel', aoRolar, { passive: true });
    vidro.addEventListener('touchmove', aoMoverDedo, { passive: true });
    return vidro;
  }

  /* ---------- a porta ---------- */
  function portaDoPasso(passo) {
    var p = passo.p, avanca = p.getAttribute('data-avanca');
    if (avanca === 'proximo') return [];
    if (p.hasAttribute('data-porta')) {
      var partes = p.getAttribute('data-porta').split(';');
      for (var i = partes.length - 1; i >= 0; i--) {
        var achados = ferramentas.elementos(R().seletores(partes[i]));
        if (achados.length) return achados.slice(0, 1);
      }
      return [];
    }
    var clique = !p.hasAttribute('data-treino-alvo') && p.getAttribute('data-clique');
    var lista = clique ? ferramentas.elementos(R().seletores(clique)) : ferramentas.alvosDo(passo);
    return avanca === 'escolha' ? lista : lista.slice(0, 1);
  }
  /* o buraco do passo "passe o mouse": não é porta, o clique continua engolido */
  function soParaOMouse() {
    var passo = passoEmCurso();
    return passo && guia.mostrado && !janelaAberta() && passo.p.hasAttribute('data-so-mouse') ? ferramentas.alvosDo(passo) : [];
  }
  function porta() {
    if (!guia) return [];
    var janela = janelaAberta(), passo = passoEmCurso();
    if (janela) {
      var prevista = passo ? portaDoPasso(passo).filter(function (el) { return janela.contains(el); }) : [];
      if (prevista.length) return guia.mostrado ? prevista : [];
      var saida = janela.querySelector(SAIDA_DA_JANELA);
      return saida ? [saida] : [];
    }
    if (!passo || !guia.mostrado || ferramentas.carregando()) return [];
    return portaDoPasso(passo);
  }

  /* o buraco só abre no que está mesmo por cima: uma folha ou uma janela pode cobrir a barra, e a rolagem pode pôr a porta
     embaixo do cabeçalho que gruda (o pedaço que ainda cai em outra peça, a segunda trava engole) */
  function porCima(el) {
    var c = V().caixaDe(el);
    var topo = document.elementsFromPoint((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2).filter(function (e) { return e !== vidro; })[0];
    return !!topo && (el.contains(topo) || !!topo.closest('.guia-balao'));
  }
  function botoesDaBarra() {
    var botoes = [document.querySelector('.treino-barra:not(.oculto) .treino-barra-sair')];
    if (!janelaAberta()) botoes.push(document.querySelector('.treino-barra:not(.oculto) ' + RECOMECAR_DA_BARRA));
    return botoes.filter(function (b) { return visivel(b) && porCima(b); });
  }
  /* o que responde em qualquer passo */
  function sempreResponde(alvo) { return !!alvo.closest(SEMPRE) || (!!alvo.closest(RECOMECAR_DA_BARRA) && !janelaAberta()); }

  /* a porta nova entra na tela: fora dela, ou embaixo do que gruda ou do rodapé, ninguém chegaria nela (na escolha, todas) */
  function mostrarPorta(lista) {
    if ((lista[0] || null) === portaVista) return;
    portaVista = lista[0] || null;
    if (janelaAberta()) return;
    lista.slice().reverse().forEach(function (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (!porCima(el)) el.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  }

  function desenhar() {
    if (!guia) return;
    var lista = porta();
    mostrarPorta(lista);
    var caixas = lista.filter(porCima).concat(botoesDaBarra(), soParaOMouse()).map(V().caixaDe);
    var recorte = V().recorteDe(caixas);
    if (recorte !== recorteDesenhado) {
      recorteDesenhado = recorte;
      vidro.style.setProperty('--guia-recorte', recorte);
    }
    /* na janela, o foco fica no que responde: ela mesma põe o foco em outro botão, um pouco depois de abrir */
    if (janelaAberta() && lista[0] && !respondeAoTeclado(document.activeElement)) lista[0].focus();
  }

  /* ---------- a segunda trava: o que não é da porta é engolido na janela do navegador ---------- */
  function deixaPassar(evento) {
    var alvo = evento.target, tipo = evento.type;
    if (!alvo || !alvo.closest) return false;
    if (sempreResponde(alvo)) return true;
    if (tipo === 'dblclick' || tipo === 'auxclick' || tipo === 'contextmenu' || tipo === 'dragstart') return false;
    if (evento.button > 0 || evento.detail >= 2) return false;
    if (tipo === 'pointerdown' || tipo === 'touchstart') gesto = null;
    var janela = janelaAberta();
    if (gesto && gesto.contains(alvo) && (!janela || janela.contains(alvo))) return true;
    var daPorta = porta().filter(function (el) { return el.contains(alvo); })[0];
    if (!daPorta) return false;
    gesto = daPorta;
    return true;
  }
  function conferirClique(evento) {
    if (!guia || evento.isTrusted === false) return;
    if (evento.type === 'touchstart' && evento.target === vidro) dedo = { x: evento.touches[0].clientX, y: evento.touches[0].clientY };
    if (deixaPassar(evento)) return;
    evento.stopImmediatePropagation();
    if (evento.cancelable && evento.type.indexOf('touch') !== 0) evento.preventDefault();
  }
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'dragstart'].forEach(function (tipo) {
    window.addEventListener(tipo, conferirClique, true);
  });
  ['touchstart', 'touchend'].forEach(function (tipo) {
    window.addEventListener(tipo, conferirClique, { capture: true, passive: true });
  });

  /* ---------- o teclado ---------- */
  function respondeAoTeclado(alvo) {
    return !!alvo && !!alvo.closest && (sempreResponde(alvo) || porta().some(function (el) { return el.contains(alvo); }));
  }
  function barrar(evento) {
    evento.preventDefault();
    evento.stopImmediatePropagation();
  }
  function doNavegador(tecla, comando) { return /^F\d+$/.test(tecla) || (comando && /^[r+\-=0]$/i.test(tecla)); }
  /* a tecla fica com o campo: só no passo de escrever, menos o que sairia dele ou mexeria na tela */
  function ficaNoCampo(evento, comando) {
    var alvo = evento.target, passo = passoEmCurso();
    if (!passo || !passo.p.hasAttribute('data-escrever') || !/^(INPUT|TEXTAREA)$/.test(alvo.tagName)) return false;
    if (evento.key === 'Escape' || (comando && /^[zy]$/i.test(evento.key))) return false;
    return !(evento.key === 'Enter' && alvo.tagName === 'INPUT');
  }
  function moverFoco(paraTras) {
    var caixas = porta().concat(Array.prototype.slice.call(document.querySelectorAll('.guia-balao:not(.oculto)')), botoesDaBarra());
    var lista = [];
    caixas.forEach(function (caixa) {
      var dentro = Array.prototype.slice.call(caixa.querySelectorAll(FOCAVEIS));
      (caixa.matches(FOCAVEIS) ? [caixa].concat(dentro) : dentro).forEach(function (el) {
        if (visivel(el) && lista.indexOf(el) < 0) lista.push(el);
      });
    });
    if (!lista.length) return;
    var i = lista.indexOf(document.activeElement);
    lista[i < 0 ? (paraTras ? lista.length - 1 : 0) : (i + (paraTras ? -1 : 1) + lista.length) % lista.length].focus();
  }
  function aoTeclar(evento) {
    if (!guia) return;
    var tecla = evento.key, comando = evento.ctrlKey || evento.metaKey;
    if (doNavegador(tecla, comando)) return;
    if (tecla === 'Tab') {
      barrar(evento);
      if (evento.type === 'keydown') moverFoco(evento.shiftKey);
      return;
    }
    var alvo = evento.target;
    if (respondeAoTeclado(alvo) && ficaNoCampo(evento, comando)) return;
    barrar(evento);
    if (evento.type === 'keydown' && !evento.repeat && !comando && !evento.altKey && (tecla === 'Enter' || tecla === ' ') && respondeAoTeclado(alvo)) alvo.click();
  }
  ['keydown', 'keypress', 'keyup'].forEach(function (tipo) { window.addEventListener(tipo, aoTeclar, true); });

  /* ---------- a rolagem: passa para a área embaixo do vidro ---------- */
  function rolar(x, y, dx, dy) {
    var el = document.elementsFromPoint(x, y).filter(function (e) { return e !== vidro; })[0];
    for (; el && (dx || dy); el = el.parentElement) {
      var estilo = getComputedStyle(el), antes;
      if (dy && /auto|scroll/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight) {
        antes = el.scrollTop;
        el.scrollTop += dy;
        if (el.scrollTop !== antes) dy = 0;
      }
      if (dx && /auto|scroll/.test(estilo.overflowX) && el.scrollWidth > el.clientWidth) {
        antes = el.scrollLeft;
        el.scrollLeft += dx;
        if (el.scrollLeft !== antes) dx = 0;
      }
    }
  }
  function aoRolar(evento) {
    if (evento.ctrlKey) return;
    var escala = evento.deltaMode === 1 ? LINHA_RODINHA : (evento.deltaMode === 2 ? window.innerHeight : 1);
    rolar(evento.clientX, evento.clientY, evento.deltaX * escala, evento.deltaY * escala);
  }
  function aoMoverDedo(evento) {
    var t = evento.touches[0];
    if (!t || !dedo) return;
    rolar(t.clientX, t.clientY, dedo.x - t.clientX, dedo.y - t.clientY);
    dedo = { x: t.clientX, y: t.clientY };
  }
  window.addEventListener('scroll', desenhar, { capture: true, passive: true });

  /* ---------- a janela que o passo não pede ---------- */
  function avisoNaFrente() {
    var janela = janelaAberta(), passo = passoEmCurso();
    var prevista = janela && passo && portaDoPasso(passo).some(function (el) { return janela.contains(el); });
    if (!janela || prevista) {
      if (!guia.avisoFora) return false;
      guia.avisoFora = false;
      guia.mostrado = false;
      ferramentas.esconderPecas();
      if (guia.avisoRepetido) { guia.avisoRepetido = false; ferramentas.parar(); return true; }
      if (guia.fase === 'parado' || guia.fase === 'fim') ferramentas.balaoFinal();
      return false;
    }
    if (!guia.avisoFora) {
      var chave = janela.id + '|' + janela.textContent.trim();
      if (guia.avisosVistos.indexOf(chave) >= 0) guia.avisoRepetido = true;
      else guia.avisosVistos.push(chave);
      guia.avisoFora = true;
      B().avisoFora(guia);
    }
    B().posicionar([janela.querySelector('.modal') || janela]);
    return true;
  }

  /* ---------- ligar e desligar ---------- */
  function ligar(g, f) {
    guia = g;
    ferramentas = f;
    gesto = null;
    dedo = null;
    portaVista = null;
    peca().classList.remove('oculto');
    desenhar();
    if (!relogio) relogio = setInterval(desenhar, REDESENHO);
  }
  function desligar() {
    guia = null;
    if (relogio) { clearInterval(relogio); relogio = null; }
    if (vidro) vidro.classList.add('oculto');
  }

  RW.guiaVidro = { ligar: ligar, desligar: desligar, porta: porta, avisoNaFrente: avisoNaFrente };
})();
