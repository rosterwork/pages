/* ============================================================
   GUIA › VÉU — o escurecido do passo a passo (RosterWork.guiaVeu)
   A tela fica no véu (--veu-guia) e cada alvo do passo fica aceso
   num buraco de cantos arredondados, sem contorno. Os buracos que se
   encostam viram um só (na regra par-ímpar, a sobra entre dois
   escureceria de novo). No modo treino, a barra azul também fica
   acesa (outro buraco). O recorte vai na propriedade --guia-recorte
   (dado da tela), como as posições --guia-*.
   porNaTela(el): as peças do guia entram antes da moldura do treino,
   que fica por cima de tudo. aceso(x, y): o ponto cai num buraco (o
   guia só deixa o clique passar ali).
   Molde: #tpl-guia-veu (index.html).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var MARGEM = 4;           // folga do buraco em volta do alvo (px)
  var veu = null;
  var buracos = [];         // os buracos do último desenho (para o aceso)

  function porNaTela(el) { document.body.insertBefore(el, document.getElementById('treino-moldura')); }

  function peca() {
    if (veu) return veu;
    var molde = document.getElementById('tpl-guia-veu');
    if (!molde) return null;
    veu = molde.content.firstElementChild.cloneNode(true);
    /* na mesma camada dos balões do guia (o do passo e a dica): o véu entra antes deles, para ficar embaixo */
    document.body.insertBefore(veu, document.querySelector('body > .guia-balao') || document.getElementById('treino-moldura'));
    return veu;
  }

  /* as caixas que se encostam viram a caixa que engloba as duas; a reta (a barra do treino) contamina a junção */
  function juntar(caixas) {
    for (var juntou = true; juntou;) {
      juntou = false;
      for (var i = 0; i < caixas.length && !juntou; i++) {
        for (var j = i + 1; j < caixas.length && !juntou; j++) {
          var a = caixas[i], b = caixas[j];
          if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) {
            caixas[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), reta: a.reta || b.reta };
            caixas.splice(j, 1);
            juntou = true;
          }
        }
      }
    }
    return caixas;
  }

  /* um retângulo de cantos arredondados, no traçado do path() */
  function retangulo(c, raio) {
    var r = c.reta ? 0 : Math.min(raio, (c.x1 - c.x0) / 2, (c.y1 - c.y0) / 2);
    return 'M' + (c.x0 + r) + ' ' + c.y0 + ' H' + (c.x1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + c.x1 + ' ' + (c.y0 + r) +
      ' V' + (c.y1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (c.x1 - r) + ' ' + c.y1 +
      ' H' + (c.x0 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + c.x0 + ' ' + (c.y1 - r) +
      ' V' + (c.y0 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (c.x0 + r) + ' ' + c.y0 + ' Z';
  }

  /* caixas: [{ x0, y0, x1, y1 }] dos alvos, sem a folga (ela entra aqui) */
  function mostrar(caixas) {
    var el = peca();
    if (!el) return;
    var W = window.innerWidth, H = window.innerHeight;
    var lista = caixas.map(function (c) {
      return { x0: Math.max(0, c.x0 - MARGEM), y0: Math.max(0, c.y0 - MARGEM), x1: Math.min(W, c.x1 + MARGEM), y1: Math.min(H, c.y1 + MARGEM) };
    }).filter(function (c) { return c.x1 > c.x0 && c.y1 > c.y0; });
    var barra = document.querySelector('.treino-barra:not(.oculto)');
    if (barra) {
      var b = barra.getBoundingClientRect();
      lista.push({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, reta: true });
    }
    var raio = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--raio-medio')) || 0;
    var caminho = 'M0 0 H' + W + ' V' + H + ' H0 Z';
    buracos = juntar(lista);
    buracos.forEach(function (c) { caminho += ' ' + retangulo(c, raio); });
    el.style.setProperty('--guia-recorte', 'path(evenodd, "' + caminho + '")');
    el.classList.remove('oculto');
  }

  function esconder() { if (veu) veu.classList.add('oculto'); }
  function visivel() { return !!veu && !veu.classList.contains('oculto'); }
  function aceso(x, y) {
    return buracos.some(function (c) { return x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1; });
  }

  /* a caixa de um elemento na tela */
  function caixaDe(el) {
    var r = el.getBoundingClientRect();
    return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
  }

  RW.guiaVeu = { mostrar: mostrar, esconder: esconder, visivel: visivel, aceso: aceso, caixaDe: caixaDe, porNaTela: porNaTela };
})();
