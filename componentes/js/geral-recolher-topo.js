/* ============================================================
   RECOLHER O TOPO — componente compartilhado do celular
   Rolar a lista para baixo (48px, com o dedo) recolhe o topo: a barra
   do sistema, o título com as abas e a barra de controles saem, e a
   lista ocupa o lugar deles. Rolar para cima no meio da lista não traz
   o topo: ele volta pela abinha no alto da tela (tocar ou puxar para
   baixo), no começo da lista, ao trocar de tela e quando a página pede
   (mostrar(), ex.: o seletor de unidade). A rolagem do sistema (como o
   abrir em hoje) não recolhe; com menu aberto, busca em uso ou painel
   aberto, o topo não sai. O leiaute muda uma vez só e o movimento é
   só deslocamento (geral-recolher-topo.css): ao recolher, a página
   muda e o topo desliza para fora; ao mostrar, o topo desliza para
   dentro e a página muda no fim. Com "menos movimento" no aparelho,
   sem deslizar. Marcas no <html>: data-topo-recolhido, -movendo e
   -andando; as alturas e os deslocamentos são dado da tela.
   API: RosterWork.recolherTopo.mostrar()
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PARA_RECOLHER = 48;    // quanto rolar para baixo (px) até o topo sair
  var PERTO_DO_COMECO = 8;   // a menos disso do começo da lista, o topo volta
  var PUXAR_ABINHA = 24;     // quanto puxar a abinha para baixo (px) para o topo voltar
  var FOLGA_DO_DEDO = 1200;  // depois de soltar o dedo, a rolagem que continua sozinha ainda conta (ms)
  var DURACAO = 250;         // o deslizar (igual à transição do CSS, ms)

  var raiz = document.documentElement;
  var menosMovimento = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var dedoNaTela = false;
  var dedoAte = 0;           // até quando a rolagem conta como do dedo
  var ignorarAte = 0;        // até quando a rolagem não conta (o leiaute mudando)
  var acumulado = 0;         // quanto rolou para baixo desde a última mudança
  var ultimoTopo = new WeakMap();   // a última rolagem de cada área
  var fimDoMovimento = null;
  var mostrando = false;

  function recolhido() { return raiz.hasAttribute('data-topo-recolhido'); }

  function deslocar(app, pagina) {
    raiz.style.setProperty('--topo-app-deslocamento', app + 'px');
    raiz.style.setProperty('--topo-pagina-deslocamento', pagina + 'px');
  }

  /* o fim do movimento: sai o deslocamento e a página fica só no leiaute */
  function terminar() {
    if (fimDoMovimento) { clearTimeout(fimDoMovimento); fimDoMovimento = null; }
    raiz.removeAttribute('data-topo-andando');
    raiz.removeAttribute('data-topo-movendo');
    raiz.style.removeProperty('--topo-app-deslocamento');
    raiz.style.removeProperty('--topo-pagina-deslocamento');
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

  function mostrar() {
    acumulado = 0;
    if (!recolhido() || mostrando) return;
    mostrando = true;
    var app = parseFloat(raiz.style.getPropertyValue('--topo-app-altura')) || 0;
    var pagina = parseFloat(raiz.style.getPropertyValue('--topo-pagina-altura')) || 0;
    ignorarAte = Date.now() + DURACAO + 150;
    mover(0, 0, app, pagina, function () {
      raiz.removeAttribute('data-topo-recolhido');
      mostrando = false;
    });
  }

  /* algo na tela pede o topo à vista: um menu aberto, a busca em uso, o painel aberto, a folha do "Mais" */
  function topoPreso() {
    if (document.querySelector('.dropdown--aberto, .busca--aberta, .painel-lateral--aberto, .casca--mais-aberto')) return true;
    var ativo = document.activeElement;
    return !!(ativo && ativo.matches && ativo.matches('input, textarea, select'));
  }

  /* mede o que sai (a barra do sistema e, na página da área que rola, tudo o que fica acima do corpo), muda o
     leiaute de uma vez e desliza do lugar de antes até o novo */
  function recolher(area) {
    var cabecalho = document.querySelector('.casca > .cabecalho');
    var pagina = area.closest('.pagina');
    var corpo = pagina && pagina.querySelector('.pagina-corpo');
    if (!cabecalho || !corpo) return;
    var alturaApp = cabecalho.getBoundingClientRect().height;
    var alturaPagina = corpo.getBoundingClientRect().top - pagina.getBoundingClientRect().top;
    /* só recolhe se a lista tem o que rolar além do espaço que ganha */
    if (area.scrollHeight - area.clientHeight < alturaApp + alturaPagina + PARA_RECOLHER) return;
    raiz.style.setProperty('--topo-app-altura', alturaApp + 'px');
    raiz.style.setProperty('--topo-pagina-altura', alturaPagina + 'px');
    raiz.setAttribute('data-topo-recolhido', '');
    ignorarAte = Date.now() + DURACAO + 150;
    mover(alturaApp, alturaPagina, 0, 0, null);
  }

  function aoRolar(evento) {
    var area = evento.target;
    if (!area || area.nodeType !== 1 || !area.closest('.conteudo .pagina-corpo, .conteudo .pagina-corpo *')) return;
    if (area.closest('.painel-lateral')) return;
    var topo = area.scrollTop;
    var antes = ultimoTopo.has(area) ? ultimoTopo.get(area) : topo;
    ultimoTopo.set(area, topo);
    if (!(RosterWork.celular && RosterWork.celular())) { mostrar(); return; }
    if (topo <= PERTO_DO_COMECO) { mostrar(); return; }
    var agora = Date.now();
    if (recolhido() || agora < ignorarAte || !(dedoNaTela || agora < dedoAte)) { acumulado = 0; return; }
    var passo = topo - antes;
    if (passo <= 0) { acumulado = 0; return; }
    acumulado += passo;
    if (acumulado >= PARA_RECOLHER && !topoPreso()) { acumulado = 0; recolher(area); }
  }

  document.addEventListener('touchstart', function () { dedoNaTela = true; }, { passive: true, capture: true });
  document.addEventListener('touchend', function () { dedoNaTela = false; dedoAte = Date.now() + FOLGA_DO_DEDO; }, { passive: true, capture: true });
  document.addEventListener('touchcancel', function () { dedoNaTela = false; dedoAte = Date.now() + FOLGA_DO_DEDO; }, { passive: true, capture: true });
  /* a rolagem das áreas não sobe até o document: escuta na descida */
  document.addEventListener('scroll', aoRolar, { passive: true, capture: true });

  /* a abinha fica fora do .conteudo (o roteador troca o conteúdo e ela continua): tocar ou puxar traz o topo */
  function prepararAbinha() {
    var abinha = RosterWork.tpl ? RosterWork.tpl('tpl-topo-abinha') : null;
    if (!abinha) return;
    document.body.appendChild(abinha);
    abinha.addEventListener('click', mostrar);
    var inicioY = null;
    abinha.addEventListener('touchstart', function (evento) { inicioY = evento.touches[0].clientY; }, { passive: true });
    abinha.addEventListener('touchmove', function (evento) {
      if (inicioY !== null && evento.touches[0].clientY - inicioY >= PUXAR_ABINHA) { inicioY = null; mostrar(); }
    }, { passive: true });
  }

  /* trocou de tela (o roteador troca o conteúdo): o topo volta */
  function iniciar() {
    prepararAbinha();
    var conteudo = document.querySelector('.conteudo');
    if (conteudo) new MutationObserver(mostrar).observe(conteudo, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.RosterWork.recolherTopo = { mostrar: mostrar };
})();
