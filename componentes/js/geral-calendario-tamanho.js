/* ============================================================
   COMPONENTE geral-calendario-tamanho — o tamanho dos calendários
   (Escala › Mês › Calendário e Colunas › Dias, e o Calendário da
   Extrajornada). O botão da barra mostra o tamanho de agora ("100%")
   e abre os níveis, os mesmos do navegador (de 50% a 150%). Em cima
   do calendário, o Ctrl e a roda do mouse aproximam e afastam em
   volta do ponto do mouse: cada clique da roda pula um nível, e a
   pinça do touchpad (que o navegador entrega como Ctrl e roda; no
   Safari do Mac, como gesto) muda aos poucos. Fora do calendário, o
   Ctrl e a roda ficam com o navegador (o zoom da página). No celular,
   os dois dedos no calendário mudam o tamanho dele: ele estica como
   uma imagem enquanto os dedos andam e, ao soltar, se redesenha
   nítido no tamanho novo. O tamanho vale para todos os
   calendários de uma vez (a custom property --calendario-tamanho no
   <html>, lida pelo geral-calendario-mes.css) e fica lembrado por
   tipo de aparelho (geral-visao-grade.js), gravado logo depois do
   último movimento.
   Molde: #tpl-calendario-tamanho (index.html)
   API: RosterWork.calendarioTamanho.montar(lugar) · ligar(area) · aplicarGuardado()
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  var RW = window.RosterWork;

  var NIVEIS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];   // os do navegador
  var MENOR = NIVEIS[0], MAIOR = NIVEIS[NIVEIS.length - 1];
  var PINCA_PASSO = 100;     // a pinça: cada evento muda o tamanho em e^(−deltaY/100)
  var REPINTAR_MS = 150;     // os gráficos repintam quando o movimento para
  var GRAVAR_MS = 800;       // e a escolha grava um pouco depois (a roda e a pinça mandam muitos passos seguidos)

  var atual = 1;             // o tamanho na tela
  var pedido = null;         // o passo da roda ou da pinça que espera o próximo quadro: { tamanho, cal, x, y }
  var quadro = 0;
  var relogioRepintar = null, relogioGravar = null;

  function limitar(t) { return Math.min(MAIOR, Math.max(MENOR, t)); }

  /* o botão e a lista de cada barra montada: o valor de agora e o nível marcado */
  function pintarBotoes() {
    Array.prototype.forEach.call(document.querySelectorAll('.calendario-tamanho'), function (caixa) {
      var valor = caixa.querySelector('.calendario-tamanho-valor');
      if (valor) valor.textContent = Math.round(atual * 100) + '%';
      Array.prototype.forEach.call(caixa.querySelectorAll('[data-tamanho]'), function (item) {
        item.classList.toggle('dropdown-item--ativo', Math.abs(Number(item.getAttribute('data-tamanho')) - atual) < 0.005);
      });
    });
  }

  /* o tamanho na tela: a custom property que o CSS do calendário lê (dado da pessoa) */
  function definir(t) {
    atual = t;
    document.documentElement.style.setProperty('--calendario-tamanho', String(t));
    pintarBotoes();
  }

  /* os gráficos de cobertura pintam no tamanho da tela (escalas-celula.js): repintam no tamanho novo quando o movimento
     para; a escolha grava depois (geral-visao-grade.js) */
  function depoisDeMudar() {
    clearTimeout(relogioRepintar);
    relogioRepintar = setTimeout(function () {
      if (!RW.escalasCelula) return;
      Array.prototype.forEach.call(document.querySelectorAll('.geral-calendario-mes'), function (cal) {
        RW.escalasCelula.desenharGraficos(cal);
      });
    }, REPINTAR_MS);
    clearTimeout(relogioGravar);
    relogioGravar = setTimeout(function () {
      if (RW.visaoGrade) RW.visaoGrade.gravar({ tamanho: Math.round(atual * 1000) / 1000 });
    }, GRAVAR_MS);
  }

  /* o ponto do calendário embaixo de (x, y) da tela: o dia e onde, dentro dele; fora de um dia (no cabeçalho dos dias),
     o ponto na rolagem e o tamanho de agora, para a conta pela proporção */
  function marcar(cal, x, y) {
    var embaixo = document.elementFromPoint(x, y);
    var dia = (embaixo && cal.contains(embaixo)) ? embaixo.closest('.geral-calendario-mes-dia') : null;
    var r = dia ? dia.getBoundingClientRect() : null;
    var caixa = cal.getBoundingClientRect();
    return {
      dia: (r && r.width && r.height) ? dia : null,
      fx: (r && r.width) ? (x - r.left) / r.width : 0,
      fy: (r && r.height) ? (y - r.top) / r.height : 0,
      x: x - caixa.left + cal.scrollLeft, y: y - caixa.top + cal.scrollTop, tamanho: atual
    };
  }

  /* muda para o tamanho t e rola até o ponto marcado ficar em (x, y) da tela */
  function mudarComPonto(cal, t, ponto, x, y) {
    definir(t);
    if (ponto.dia) {
      var r = ponto.dia.getBoundingClientRect();
      cal.scrollLeft += r.left + ponto.fx * r.width - x;
      cal.scrollTop += r.top + ponto.fy * r.height - y;
    } else {
      var caixa = cal.getBoundingClientRect(), razao = t / ponto.tamanho;
      cal.scrollLeft = ponto.x * razao - (x - caixa.left);
      cal.scrollTop = ponto.y * razao - (y - caixa.top);
    }
    depoisDeMudar();
  }

  /* muda o tamanho com o ponto (x, y) da tela parado: o dia embaixo dele continua embaixo dele */
  function mudarEmVolta(cal, t, x, y) {
    t = limitar(t);
    if (Math.abs(t - atual) < 0.0005) return;
    mudarComPonto(cal, t, marcar(cal, x, y), x, y);
  }

  /* o calendário à vista (um só por tela) */
  function calendarioNaTela() {
    var lista = document.querySelectorAll('.geral-calendario-mes');
    for (var i = 0; i < lista.length; i++) if (lista[i].getClientRects().length) return lista[i];
    return null;
  }

  /* um nível da lista: em volta do meio do calendário à vista */
  function escolher(t) {
    var cal = calendarioNaTela();
    if (!cal) { definir(limitar(t)); depoisDeMudar(); return; }
    var c = cal.getBoundingClientRect();
    mudarEmVolta(cal, t, c.left + c.width / 2, c.top + c.height / 2);
  }

  /* o nível seguinte, para cima ou para baixo, a partir de um tamanho qualquer (o da pinça não é um nível) */
  function proximoNivel(t, maior) {
    var i;
    if (maior) {
      for (i = 0; i < NIVEIS.length; i++) if (NIVEIS[i] > t + 0.004) return NIVEIS[i];
      return MAIOR;
    }
    for (i = NIVEIS.length - 1; i >= 0; i--) if (NIVEIS[i] < t - 0.004) return NIVEIS[i];
    return MENOR;
  }

  /* o Ctrl e a roda (ou a pinça do touchpad) em cima de um calendário: o clique da roda vem em passos grandes e inteiros
     (ou em linhas) e pula um nível; a pinça vem em passos pequenos e muda aos poucos. Um passo por quadro de tela */
  function aoRodar(e) {
    if (!e.ctrlKey || !e.deltaY) return;
    var cal = e.target.closest ? e.target.closest('.geral-calendario-mes') : null;
    if (!cal) return;
    e.preventDefault();
    var base = pedido ? pedido.tamanho : atual;
    var clique = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
    var novo = clique ? proximoNivel(base, e.deltaY < 0) : limitar(base * Math.exp(-e.deltaY / PINCA_PASSO));
    pedido = { tamanho: novo, cal: cal, x: e.clientX, y: e.clientY };
    if (quadro) return;
    quadro = requestAnimationFrame(function () {
      quadro = 0;
      var p = pedido;
      pedido = null;
      if (p && p.cal.isConnected) mudarEmVolta(p.cal, p.tamanho, p.x, p.y);
    });
  }

  /* ---------- a pinça no celular: os dois dedos no calendário ----------
     O calendário estica como uma imagem enquanto os dedos andam (o transform, pelas custom properties
     --calendario-pinca-*, dado da tela; geral-calendario-mes.css), em volta do ponto entre eles e acompanhando-o; ao
     soltar, o tamanho de verdade entra e o ponto do começo fica entre os dedos. O navegador não amplia a página ali
     (touch-action, no CSS); um dedo continua rolando e deslizando o mês (geral-deslizar.js) */
  var pinca = null;          // { cal, d0, z0, z, x0, y0, x, y, ponto }
  var quadroPinca = 0;

  function noCelular() { return !!(RW.celular && RW.celular()); }
  function distancia(a, b) { return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2)); }

  function esticar() {
    quadroPinca = 0;
    if (!pinca) return;
    pinca.cal.style.setProperty('--calendario-pinca-escala', String(pinca.z / pinca.z0));
    pinca.cal.style.setProperty('--calendario-pinca-x', (pinca.x - pinca.x0) + 'px');
    pinca.cal.style.setProperty('--calendario-pinca-y', (pinca.y - pinca.y0) + 'px');
  }

  function aoTocar(e) {
    if (pinca || e.touches.length !== 2 || !noCelular()) return;
    var a = e.touches[0], b = e.touches[1];
    var cal = a.target.closest ? a.target.closest('.geral-calendario-mes') : null;
    if (!cal || !b.target.closest || b.target.closest('.geral-calendario-mes') !== cal) return;
    var x = (a.clientX + b.clientX) / 2, y = (a.clientY + b.clientY) / 2;
    var caixa = cal.getBoundingClientRect();
    pinca = { cal: cal, d0: distancia(a, b) || 1, z0: atual, z: atual, x0: x, y0: y, x: x, y: y, ponto: marcar(cal, x, y) };
    cal.style.setProperty('--calendario-pinca-origem-x', (x - caixa.left) + 'px');
    cal.style.setProperty('--calendario-pinca-origem-y', (y - caixa.top) + 'px');
    esticar();
    cal.setAttribute('data-pinca', '');
  }

  function aoMoverDedos(e) {
    if (!pinca || e.touches.length < 2) return;
    var a = e.touches[0], b = e.touches[1];
    pinca.z = limitar(pinca.z0 * distancia(a, b) / pinca.d0);
    pinca.x = (a.clientX + b.clientX) / 2;
    pinca.y = (a.clientY + b.clientY) / 2;
    if (!quadroPinca) quadroPinca = requestAnimationFrame(esticar);
  }

  /* um dedo saiu: o tamanho de verdade, com o ponto do começo entre os dedos */
  function aoSoltarDedo(e) {
    if (!pinca || e.touches.length >= 2) return;
    var p = pinca;
    pinca = null;
    if (quadroPinca) { cancelAnimationFrame(quadroPinca); quadroPinca = 0; }
    p.cal.removeAttribute('data-pinca');
    if (!p.cal.isConnected) return;
    if (Math.abs(p.z - p.z0) < 0.0005 && Math.abs(p.x - p.x0) < 1 && Math.abs(p.y - p.y0) < 1) return;
    mudarComPonto(p.cal, p.z, p.ponto, p.x, p.y);
  }

  /* ---------- o Safari: a pinça chega como gesto (gesturestart · gesturechange · gestureend) ----------
     No celular, quem cuida são os dedos (acima): o gesto só fica sem a ampliação da página em cima do calendário. No
     computador (o touchpad do Mac, sem tela de toque), o gesto muda o tamanho, um passo por quadro, como a roda */
  var gestoMac = null;       // { cal, z0 }

  function aoGesto(e) {
    var cal = e.target && e.target.closest ? e.target.closest('.geral-calendario-mes') : null;
    if (!cal && !gestoMac) return;
    if (noCelular()) { if (cal) e.preventDefault(); return; }
    if (navigator.maxTouchPoints > 0) return;   // o tablet: a pinça é a da página, como no Android
    e.preventDefault();
    if (e.type === 'gesturestart') { gestoMac = { cal: cal, z0: atual }; return; }
    if (e.type === 'gestureend' || !gestoMac) { gestoMac = null; return; }
    var caixa = gestoMac.cal.getBoundingClientRect();
    pedido = {
      tamanho: limitar(gestoMac.z0 * (e.scale || 1)), cal: gestoMac.cal,
      x: e.clientX != null ? e.clientX : caixa.left + caixa.width / 2, y: e.clientY != null ? e.clientY : caixa.top + caixa.height / 2
    };
    if (quadro) return;
    quadro = requestAnimationFrame(function () {
      quadro = 0;
      var p = pedido;
      pedido = null;
      if (p && p.cal.isConnected) mudarEmVolta(p.cal, p.tamanho, p.x, p.y);
    });
  }

  /* o lugar da barra (Escala e Extrajornada) vira o botão com a lista, com o id e as classes do lugar; abre no tamanho
     guardado do tipo de aparelho em uso */
  function montar(lugar) {
    if (!lugar) return null;
    var el = lugar;
    if (!lugar.classList.contains('calendario-tamanho')) {
      el = RW.tpl('tpl-calendario-tamanho');
      if (!el) return null;
      if (lugar.id) el.id = lugar.id;
      Array.prototype.forEach.call(lugar.classList, function (classe) { el.classList.add(classe); });
      lugar.replaceWith(el);
      Array.prototype.forEach.call(el.querySelectorAll('[data-tamanho]'), function (item) {
        item.addEventListener('click', function () { escolher(Number(item.getAttribute('data-tamanho'))); });
      });
    }
    definir(RW.visaoGrade ? RW.visaoGrade.tamanho() : 1);
    return el;
  }

  /* o Ctrl e a roda, os dedos e o gesto do Safari na área da página (o calendário é redesenhado dentro dela). Os dedos
     só olham (passive): a rolagem de um dedo segue sem esperar. A marca evita ligar duas vezes */
  function ligar(area) {
    if (!area || area.hasAttribute('data-tamanho-ligado')) return;
    area.setAttribute('data-tamanho-ligado', '');
    area.addEventListener('wheel', aoRodar, { passive: false });
    area.addEventListener('touchstart', aoTocar, { passive: true });
    area.addEventListener('touchmove', aoMoverDedos, { passive: true });
    area.addEventListener('touchend', aoSoltarDedo, { passive: true });
    area.addEventListener('touchcancel', aoSoltarDedo, { passive: true });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (tipo) {
      area.addEventListener(tipo, aoGesto, { passive: false });
    });
  }

  /* o tamanho guardado de novo na tela (a saída do modo treino devolve o de antes; geral-treino-livre.js) */
  function aplicarGuardado() {
    definir(RW.visaoGrade ? RW.visaoGrade.tamanho() : 1);
  }

  window.RosterWork.calendarioTamanho = { montar: montar, ligar: ligar, aplicarGuardado: aplicarGuardado };
})();
