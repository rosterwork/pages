/* ============================================================
   RECOLHER O TOPO — componente compartilhado do celular
   Rolar a tela para baixo (24px) recolhe o topo: a barra do sistema,
   o título com as abas e a barra de controles sobem e saem, e a lista
   ocupa o lugar deles; rolar um pouco para cima (12px) traz o topo de
   volta. O topo volta sempre no começo da lista, ao trocar de tela e
   quando a página pede (mostrar(), ex.: o seletor de unidade). Só a
   rolagem feita pelo dedo conta (a do sistema, como o abrir em hoje,
   não); com menu aberto, busca em uso ou painel aberto, o topo não
   some. A marca data-topo-recolhido no <html> e as alturas medidas
   (--topo-app-altura e --topo-pagina-altura, dado da tela) ligam o
   bloco do celular de index-cabecalho.css e geral-pagina-cabecalho.css.
   API: RosterWork.recolherTopo.mostrar()
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PARA_RECOLHER = 24;    // quanto rolar para baixo (px) até o topo sair
  var PARA_MOSTRAR = 12;     // quanto rolar para cima (px) até o topo voltar
  var PERTO_DO_COMECO = 8;   // a menos disso do começo da lista, o topo fica à vista
  var FOLGA_DO_DEDO = 1200;  // depois de soltar o dedo, a rolagem que continua sozinha ainda conta (ms)
  var DURACAO = 400;         // enquanto o topo anda (0,3s no CSS), a rolagem que ele causa não conta (ms)

  var raiz = document.documentElement;
  var dedoNaTela = false;
  var dedoAte = 0;           // até quando a rolagem conta como do dedo
  var ignorarAte = 0;        // até quando a rolagem não conta (o topo andando)
  var acumulado = 0;         // quanto rolou na mesma direção desde a última mudança
  var ultimoTopo = new WeakMap();   // a última rolagem de cada área

  function recolhido() { return raiz.hasAttribute('data-topo-recolhido'); }

  function mostrar() {
    acumulado = 0;
    if (!recolhido()) return;
    raiz.removeAttribute('data-topo-recolhido');
    ignorarAte = Date.now() + DURACAO;
  }

  /* algo na tela pede o topo à vista: um menu aberto, a busca em uso, o painel aberto, a folha do "Mais" */
  function topoPreso() {
    if (document.querySelector('.dropdown--aberto, .busca--aberta, .painel-lateral--aberto, .casca--mais-aberto')) return true;
    var ativo = document.activeElement;
    return !!(ativo && ativo.matches && ativo.matches('input, textarea, select'));
  }

  /* mede o que sai: a barra do sistema e, na página da área que rola, tudo o que fica acima do corpo */
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
    ignorarAte = Date.now() + DURACAO;
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
    if (agora < ignorarAte || !(dedoNaTela || agora < dedoAte)) { acumulado = 0; return; }
    var passo = topo - antes;
    if (!passo) return;
    /* trocou de direção: a conta recomeça */
    if ((passo > 0) !== (acumulado > 0)) acumulado = 0;
    acumulado += passo;
    if (acumulado >= PARA_RECOLHER && !recolhido() && !topoPreso()) { acumulado = 0; recolher(area); }
    else if (acumulado <= -PARA_MOSTRAR && recolhido()) mostrar();
  }

  document.addEventListener('touchstart', function () { dedoNaTela = true; }, { passive: true, capture: true });
  document.addEventListener('touchend', function () { dedoNaTela = false; dedoAte = Date.now() + FOLGA_DO_DEDO; }, { passive: true, capture: true });
  document.addEventListener('touchcancel', function () { dedoNaTela = false; dedoAte = Date.now() + FOLGA_DO_DEDO; }, { passive: true, capture: true });
  /* a rolagem das áreas não sobe até o document: escuta na descida */
  document.addEventListener('scroll', aoRolar, { passive: true, capture: true });

  /* trocou de tela (o roteador troca o conteúdo): o topo volta */
  function vigiarTelas() {
    var conteudo = document.querySelector('.conteudo');
    if (!conteudo) return;
    new MutationObserver(mostrar).observe(conteudo, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiarTelas);
  else vigiarTelas();

  window.RosterWork.recolherTopo = { mostrar: mostrar };
})();
