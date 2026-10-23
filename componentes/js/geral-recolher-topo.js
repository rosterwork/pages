/* ============================================================
   RECOLHER O TOPO — componente compartilhado do celular
   Rolar a lista para baixo com o dedo leva o topo (a barra do
   sistema, o título com as abas e a barra de controles) junto: o
   topo sobe na medida do dedo, para quando o dedo para e desce
   quando o dedo volta. Enquanto o topo anda, o gesto é dele (a lista
   anda com ele, sem rolar por dentro); saiu inteiro, a lista rola no
   mesmo gesto. Soltando no meio, ele termina para o lado mais perto,
   ou para o lado do impulso do dedo. Rolar para cima no meio da
   lista não traz o topo: ele volta pela abinha no alto da tela
   (tocar ou puxar para baixo), pela etiqueta do período (no alto, à
   esquerda, com o período da barra da página), ao voltar ao começo
   da lista (rolando até ele, ou puxando para baixo já nele), ao
   trocar de tela e quando a página pede (mostrar()). Com menu
   aberto, busca em uso, campo, painel ou folha "Mais" abertos, ou no
   meio da troca de mês pelo dedo (geral-deslizar-mes.js), o topo não
   sai; nem quando a lista não tem o que rolar. O leiaute muda uma
   vez só, no começo do gesto, e o movimento é só deslocamento
   (geral-recolher-topo.css). Com "menos movimento" no aparelho, o
   fim é sem deslizar. Marcas no <html>: data-topo-recolhido,
   -movendo e -andando; as alturas e os deslocamentos são dado da tela.
   API: RosterWork.recolherTopo.mostrar()
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PARA_RECOLHER = 48;    // a lista precisa rolar ao menos isso (px) além do espaço que ganha, senão o topo fica
  var PERTO_DO_COMECO = 8;   // rolando para cima, a menos disso do começo da lista, o topo volta
  var PUXAR = 24;            // quanto puxar para baixo (px) a abinha, ou a lista já no começo, para o topo voltar
  var IMPULSO = 0.3;         // o dedo soltando mais rápido que isso (px/ms) escolhe o lado, em vez do mais perto
  var PAUSA = 100;           // o dedo parado mais que isso (ms) antes de soltar não dá impulso
  var DURACAO = 250;         // o deslizar (igual à transição do CSS, ms)

  var raiz = document.documentElement;
  var menosMovimento = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var ignorarAte = 0;        // até quando a rolagem não conta (o leiaute mudando)
  var ultimoTopo = new WeakMap();   // a última rolagem de cada área
  var fimDoMovimento = null;
  var mostrando = false;
  var alturas = null;        // o que sai: { app, pagina } (px), medido no começo do gesto
  var gesto = null;          // o toque de agora no conteúdo
  var etiqueta = null;       // a etiqueta do período (topo recolhido)
  var vigiaPeriodo = null;   // acompanha o nome do período enquanto o topo está fora

  function recolhido() { return raiz.hasAttribute('data-topo-recolhido'); }
  function noCelular() { return !!(RosterWork.celular && RosterWork.celular()); }

  /* o deslocamento fica em cada peça que anda (a barra do sistema e o corpo da casca juntos; a página por
     dentro do conteúdo): mudar a cada quadro refaz só o estilo delas */
  function deslocar(app, pagina) {
    Array.prototype.forEach.call(document.querySelectorAll('.casca > .cabecalho, .casca-corpo'), function (peca) {
      peca.style.setProperty('--topo-app-deslocamento', app + 'px');
    });
    var paginaEl = document.querySelector('.conteudo > .pagina');
    if (paginaEl) paginaEl.style.setProperty('--topo-pagina-deslocamento', pagina + 'px');
  }

  /* o fim do movimento: sai o deslocamento e a página fica só no leiaute */
  function terminar() {
    if (fimDoMovimento) { clearTimeout(fimDoMovimento); fimDoMovimento = null; }
    raiz.removeAttribute('data-topo-andando');
    raiz.removeAttribute('data-topo-movendo');
    Array.prototype.forEach.call(document.querySelectorAll('.casca > .cabecalho, .casca-corpo, .conteudo > .pagina'), function (peca) {
      peca.style.removeProperty('--topo-app-deslocamento');
      peca.style.removeProperty('--topo-pagina-deslocamento');
    });
  }

  /* desliza do deslocamento (deApp, dePagina) até (paraApp, paraPagina) e, no fim, roda `depois` junto com
     a saída do deslocamento (no mesmo quadro, sem pulo) */
  function mover(deApp, dePagina, paraApp, paraPagina, depois) {
    terminar();
    if (menosMovimento && menosMovimento.matches) { if (depois) depois(); return; }
    deslocar(deApp, dePagina);
    raiz.setAttribute('data-topo-movendo', '');
    /* o ponto de partida vale antes de andar (lê o estilo calculado) */
    var corpo = document.querySelector('.casca-corpo');
    if (corpo) void getComputedStyle(corpo).transform;
    raiz.setAttribute('data-topo-andando', '');
    deslocar(paraApp, paraPagina);
    fimDoMovimento = setTimeout(function () {
      fimDoMovimento = null;
      if (depois) depois();
      terminar();
    }, DURACAO + 20);
  }

  /* o topo escondido em p px (0 = todo à vista): a barra do sistema sai primeiro, depois o resto */
  function posicao(p) {
    return { app: Math.max(0, alturas.app - p), pagina: Math.min(alturas.pagina, alturas.app + alturas.pagina - p) };
  }

  function mostrar() {
    if (gesto && gesto.modo === 'topo') { var p = gesto.escondido; gesto = null; soltarTopo(false, p); return; }
    if (!recolhido() || mostrando) return;
    mostrando = true;
    var app = parseFloat(raiz.style.getPropertyValue('--topo-app-altura')) || 0;
    var pagina = parseFloat(raiz.style.getPropertyValue('--topo-pagina-altura')) || 0;
    ignorarAte = Date.now() + DURACAO + 150;
    acompanharPeriodo(false);
    mover(0, 0, app, pagina, function () {
      raiz.removeAttribute('data-topo-recolhido');
      mostrando = false;
    });
  }

  /* algo na tela pede o topo à vista: um menu aberto, a busca em uso, o painel aberto, a folha do "Mais", a
     troca de mês pelo dedo */
  function topoPreso() {
    if (document.querySelector('.dropdown--aberto, .busca--aberta, .painel-lateral--aberto, .casca--mais-aberto')) return true;
    if (RosterWork.deslizarMes && RosterWork.deslizarMes.ocupado()) return true;
    var ativo = document.activeElement;
    return !!(ativo && ativo.matches && ativo.matches('input, textarea, select'));
  }

  /* a lista que rola sob o dedo: a área de rolagem mais perto, no corpo da página (fora do painel) */
  function areaQueRola(elemento) {
    if (!elemento || !elemento.closest || elemento.closest('.painel-lateral')) return null;
    for (var e = elemento; e && !e.classList.contains('conteudo'); e = e.parentElement) {
      if (e.scrollHeight > e.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) {
        return e.closest('.conteudo .pagina-corpo') ? e : null;
      }
    }
    return null;
  }

  /* mede o que sai (a barra do sistema e, na página da área, tudo o que fica acima do corpo); null quando a
     lista não tem o que rolar além do espaço que ganha */
  function medir(area) {
    var cabecalho = document.querySelector('.casca > .cabecalho');
    var pagina = area.closest('.pagina');
    var corpo = pagina && pagina.querySelector('.pagina-corpo');
    if (!cabecalho || !corpo) return null;
    var app = cabecalho.getBoundingClientRect().height;
    var paginaAltura = corpo.getBoundingClientRect().top - pagina.getBoundingClientRect().top;
    if (area.scrollHeight - area.clientHeight < app + paginaAltura + PARA_RECOLHER) return null;
    return { app: app, pagina: paginaAltura };
  }

  /* o começo do gesto do topo: o leiaute recolhido de uma vez, com o topo deslocado para o lugar de antes
     (nada muda na tela); daí em diante, só o deslocamento anda */
  function comecarTopo(medidas) {
    terminar();
    alturas = medidas;
    raiz.style.setProperty('--topo-app-altura', medidas.app + 'px');
    raiz.style.setProperty('--topo-pagina-altura', medidas.pagina + 'px');
    deslocar(medidas.app, medidas.pagina);
    raiz.setAttribute('data-topo-recolhido', '');
    raiz.setAttribute('data-topo-movendo', '');
  }

  /* o topo saiu inteiro com o dedo: fica o leiaute recolhido, sem deslocamento */
  function acabarRecolhido() {
    terminar();
    ignorarAte = Date.now() + 150;
    acompanharPeriodo(true);
  }

  /* o topo voltou inteiro com o dedo */
  function acabarMostrado() {
    raiz.removeAttribute('data-topo-recolhido');
    terminar();
    ignorarAte = Date.now() + 150;
  }

  /* soltou no meio: o topo termina para o lado escolhido, deslizando */
  function soltarTopo(esconder, p) {
    var de = posicao(p);
    ignorarAte = Date.now() + DURACAO + 150;
    if (esconder) { mover(de.app, de.pagina, 0, 0, function () { acompanharPeriodo(true); }); return; }
    mostrando = true;
    mover(de.app, de.pagina, alturas.app, alturas.pagina, function () {
      raiz.removeAttribute('data-topo-recolhido');
      mostrando = false;
    });
  }

  /* o primeiro trecho do dedo decide de quem é o gesto: do topo (para cima, com o topo à vista), da volta do
     topo (para baixo, com ele recolhido e a lista já no começo) ou da página (o resto: para o lado, para baixo) */
  function decidir(g, dx, dy) {
    if (!g.area || Math.abs(dx) >= Math.abs(dy) || Date.now() < ignorarAte || fimDoMovimento || mostrando) return 'livre';
    if (recolhido()) return (dy > 0 && g.area.scrollTop <= 0) ? 'puxar' : 'livre';
    if (dy > 0 || topoPreso()) return 'livre';
    var medidas = medir(g.area);
    if (!medidas) return 'livre';
    comecarTopo(medidas);
    return 'topo';
  }

  function aoTocar(evento) {
    gesto = null;
    if (evento.touches.length !== 1 || !noCelular()) return;
    var toque = evento.touches[0];
    gesto = { area: areaQueRola(evento.target), x0: toque.clientX, y0: toque.clientY, y: toque.clientY,
      t: evento.timeStamp, velocidade: 0, modo: null, escondido: 0 };
  }

  /* não passivo: enquanto o topo anda com o dedo, a lista não rola por dentro (preventDefault); no resto, o
     navegador rola como sempre */
  function aoMover(evento) {
    var g = gesto;
    if (!g || g.modo === 'livre') return;
    var toque = evento.touches[0];
    var passo = g.y - toque.clientY;   // > 0: o dedo subiu (a lista desce)
    if (evento.timeStamp > g.t) g.velocidade = 0.6 * passo / (evento.timeStamp - g.t) + 0.4 * g.velocidade;
    g.y = toque.clientY;
    g.t = evento.timeStamp;
    if (g.modo === null) {
      var dx = toque.clientX - g.x0, dy = toque.clientY - g.y0;
      if (!dx && !dy) return;
      g.modo = decidir(g, dx, dy);
    }
    if (g.modo === 'puxar') {
      if (toque.clientY - g.y0 >= PUXAR) { g.modo = 'livre'; mostrar(); }
      return;
    }
    if (g.modo !== 'topo') return;
    /* a rolagem do navegador começou (o toque não é mais do topo): ele termina sozinho */
    if (!evento.cancelable) { gesto = null; aoSoltarGesto(g, false); return; }
    evento.preventDefault();
    var total = alturas.app + alturas.pagina;
    g.escondido = Math.min(total, Math.max(0, g.escondido + passo));
    if (g.escondido >= total) { g.modo = 'livre'; acabarRecolhido(); return; }
    if (g.escondido <= 0) { g.modo = 'livre'; acabarMostrado(); return; }
    var pos = posicao(g.escondido);
    deslocar(pos.app, pos.pagina);
  }

  /* soltou o dedo com o topo no meio: o lado do impulso (se o dedo ia rápido) ou o mais perto */
  function aoSoltarGesto(g, comImpulso) {
    var total = alturas.app + alturas.pagina;
    var impulso = comImpulso ? g.velocidade : 0;
    soltarTopo(impulso > IMPULSO || (impulso >= -IMPULSO && g.escondido >= total / 2), g.escondido);
  }

  function aoSoltar(evento) {
    var g = gesto;
    gesto = null;
    if (!g || g.modo !== 'topo') return;
    aoSoltarGesto(g, evento.timeStamp - g.t <= PAUSA);
  }

  function aoRolar(evento) {
    var area = evento.target;
    if (!area || area.nodeType !== 1 || !area.closest('.conteudo .pagina-corpo') || area.closest('.painel-lateral')) return;
    var topo = area.scrollTop;
    var antes = ultimoTopo.has(area) ? ultimoTopo.get(area) : topo;
    ultimoTopo.set(area, topo);
    if (!noCelular()) { mostrar(); return; }
    if (Date.now() < ignorarAte || raiz.hasAttribute('data-topo-movendo')) return;
    /* voltou ao começo da lista: o topo volta */
    if (recolhido() && topo < antes && topo <= PERTO_DO_COMECO) mostrar();
  }

  /* a rolagem das áreas não sobe até o document: escuta na descida */
  document.addEventListener('scroll', aoRolar, { passive: true, capture: true });

  /* ---------- a etiqueta do período: o nome do período da barra da página (o mês, a semana ou o dia), à vista
     só com o topo recolhido (geral-recolher-topo.css); acompanha a troca de período com o topo fora ---------- */
  function nomeDoPeriodo() {
    var nomes = document.querySelectorAll('.conteudo > .pagina .pagina-subcabecalho .geral-periodo-nome');
    for (var i = 0; i < nomes.length; i++) {
      if (nomes[i].getClientRects().length) return nomes[i];
    }
    return null;
  }

  function copiarPeriodo(nome) {
    var texto = nome ? nome.textContent.trim() : '';
    etiqueta.querySelector('.topo-periodo-texto').textContent = texto;
    etiqueta.classList.toggle('oculto', !texto);
  }

  function acompanharPeriodo(ligar) {
    if (vigiaPeriodo) { vigiaPeriodo.disconnect(); vigiaPeriodo = null; }
    if (!etiqueta) return;
    var nome = ligar ? nomeDoPeriodo() : null;
    copiarPeriodo(nome);
    if (!nome) return;
    vigiaPeriodo = new MutationObserver(function () { copiarPeriodo(nome); });
    vigiaPeriodo.observe(nome, { childList: true, characterData: true, subtree: true });
  }

  /* a abinha e a etiqueta ficam fora do .conteudo (o roteador troca o conteúdo e elas continuam): tocar traz o
     topo; a abinha também se puxa */
  function prepararPecas() {
    var abinha = RosterWork.tpl ? RosterWork.tpl('tpl-topo-abinha') : null;
    if (abinha) {
      document.body.appendChild(abinha);
      abinha.addEventListener('click', mostrar);
      var inicioY = null;
      abinha.addEventListener('touchstart', function (evento) { inicioY = evento.touches[0].clientY; }, { passive: true });
      abinha.addEventListener('touchmove', function (evento) {
        if (inicioY !== null && evento.touches[0].clientY - inicioY >= PUXAR) { inicioY = null; mostrar(); }
      }, { passive: true });
    }
    etiqueta = RosterWork.tpl ? RosterWork.tpl('tpl-topo-periodo') : null;
    if (etiqueta) {
      document.body.appendChild(etiqueta);
      etiqueta.addEventListener('click', mostrar);
    }
  }

  /* o toque no conteúdo (as páginas trocam por dentro; o .conteudo fica) e a troca de tela, que traz o topo */
  function iniciar() {
    prepararPecas();
    var conteudo = document.querySelector('.conteudo');
    if (!conteudo) return;
    conteudo.addEventListener('touchstart', aoTocar, { passive: true });
    conteudo.addEventListener('touchmove', aoMover, { passive: false });
    conteudo.addEventListener('touchend', aoSoltar, { passive: true });
    conteudo.addEventListener('touchcancel', aoSoltar, { passive: true });
    new MutationObserver(mostrar).observe(conteudo, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.RosterWork.recolherTopo = { mostrar: mostrar };
})();
