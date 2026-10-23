/* ============================================================
   DESLIZAR O MÊS — componente compartilhado do celular
   Na grade do mês (o calendário do Início, a Agenda e o Calendário
   da Escala e o Calendário da Extrajornada), puxar a tela para o
   lado troca de mês. O mês acompanha o dedo, andando menos que ele
   (como elástico), e da borda sai a etiqueta com o mês de destino
   ("‹ Setembro"). Passou do ponto (LIMIAR), a etiqueta escurece e o
   mês novo começa a ser lido (antecipar): soltar ali troca; soltar
   antes, ou voltar o dedo, desfaz. Na troca, o mês sai para o lado
   e o novo entra pelo outro; se o novo demora, o círculo de
   carregando aparece no lugar. Sem mês para aquele lado, só o
   elástico. Na grade que rola para o lado (o Calendário), o gesto
   só vale começando já encostado na borda; no meio, o dedo rola a
   grade: a marca data-deslize-borda de cada área escolhe o
   touch-action (geral-deslizar-mes.css), e o navegador cuida só da
   direção que ainda rola. O toque que começa na beirada da tela é
   do celular (o voltar do Android). As setas ‹ › da página usam a
   mesma troca (ir). Com "menos movimento", sem deslizar.
   Moldes #tpl-deslize-etiqueta e #tpl-deslize-carregando
   (index.html). Marcas: data-deslize-movendo, -andando e -entrando
   no que anda (o palco) e data-deslize-moldura no pai dele, que
   corta o que sai; os deslocamentos são dado da tela.
   API: RosterWork.deslizarMes.ligar(alvo, opcoes) -> { ir(direcao) } · ocupado()
        · nomeMes(data, referencia) · antecipar(chave, buscar) · usarAntecipada(chave)
   opcoes: area (seletor da área do gesto dentro do alvo; sem ele, o
   alvo) · palco() (o que anda; sem ele, o alvo) · ativo() (sem ele,
   no celular) · destino(direcao) (o nome do mês de destino, ou null)
   · antecipar(direcao) · ir(direcao) (troca; a promessa se cumpre com
   o mês novo desenhado; null = não trocou)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var LIMIAR = 96;              // quanto o dedo anda para o lado (px) para valer a troca
  var DECIDIR = 10;             // quanto o dedo anda (px) até saber se vai para o lado ou para baixo
  var BEIRADA = 24;             // a faixa de cada lado da tela (px) que é do celular (o voltar do Android)
  var ELASTICO = 0.4;           // quanto o mês anda por px do dedo, até o ponto
  var ELASTICO_DEPOIS = 0.15;   // e depois do ponto
  var ELASTICO_SEM_MES = 0.2;   // sem mês para aquele lado
  var SAIDA = 200;              // o mês saindo ou voltando (igual à transição do CSS, ms)
  var ENTRADA = 250;            // o mês novo entrando (igual à transição do CSS, ms)
  var ESPERA_CIRCULO = 150;     // o mês novo demorando mais que isso (ms), o círculo aparece
  var VALIDADE = 10000;         // quanto tempo vale a leitura antecipada (ms)

  var menosMovimento = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var etiqueta = null;          // a etiqueta do mês de destino (uma só, presa à tela)
  var circulo = null;           // o carregando do mês que demora
  var sumirEtiqueta = null;     // o fim da saída da etiqueta
  var guardada = null;          // a leitura antecipada: { chave, promessa, ate }

  function semMovimento() { return !!(menosMovimento && menosMovimento.matches); }
  function noCelular() { return !!(RosterWork.celular && RosterWork.celular()); }

  /* "Setembro"; com o ano quando ele muda ("Janeiro 2027") */
  function nomeMes(data, referencia) {
    var nome = MESES[data.getMonth()];
    return referencia && referencia.getFullYear() !== data.getFullYear() ? nome + ' ' + data.getFullYear() : nome;
  }

  /* ---------- a leitura antecipada (uma de cada vez): quem lê o mês usa a promessa guardada, se for a dele ---------- */
  function antecipar(chave, buscar) {
    var promessa = buscar();
    if (promessa && promessa.catch) promessa.catch(function () {});   // a falha fica para quem usar
    guardada = { chave: chave, promessa: promessa, ate: Date.now() + VALIDADE };
  }

  function usarAntecipada(chave) {
    var g = guardada;
    if (!g || g.chave !== chave || Date.now() > g.ate) return null;
    guardada = null;
    return g.promessa;
  }

  /* ---------- as peças presas à tela (fora do .conteudo: o roteador troca o conteúdo e elas continuam) ---------- */
  function pecas() {
    if (etiqueta || !RosterWork.tpl) return;
    etiqueta = RosterWork.tpl('tpl-deslize-etiqueta');
    circulo = RosterWork.tpl('tpl-deslize-carregando');
    if (etiqueta) document.body.appendChild(etiqueta);
    if (circulo) document.body.appendChild(circulo);
  }

  /* a altura do meio da parte da caixa que aparece na tela */
  function meioVisivel(caixa) {
    return (Math.max(caixa.top, 0) + Math.min(caixa.bottom, window.innerHeight)) / 2;
  }

  function mostrarEtiqueta(direcao, texto, zona) {
    if (sumirEtiqueta) { clearTimeout(sumirEtiqueta); sumirEtiqueta = null; }
    etiqueta.querySelector('.deslize-etiqueta-texto').textContent = texto;
    etiqueta.classList.remove('deslize-etiqueta--pronta', 'deslize-etiqueta--voltando', 'deslize-etiqueta--saindo');
    etiqueta.classList.toggle('deslize-etiqueta--anterior', direcao < 0);
    etiqueta.classList.toggle('deslize-etiqueta--proximo', direcao > 0);
    etiqueta.style.setProperty('--deslize-etiqueta-y', meioVisivel(zona.getBoundingClientRect()) + 'px');
    etiqueta.style.setProperty('--deslize-progresso', '0');
    etiqueta.classList.add('deslize-etiqueta--visivel');
  }

  /* desfez: a etiqueta volta para a borda; trocou: some no lugar */
  function esconderEtiqueta(trocou) {
    if (!etiqueta || !etiqueta.classList.contains('deslize-etiqueta--visivel')) return;
    etiqueta.classList.add(trocou ? 'deslize-etiqueta--saindo' : 'deslize-etiqueta--voltando');
    if (!trocou) etiqueta.style.setProperty('--deslize-progresso', '0');
    sumirEtiqueta = setTimeout(function () {
      sumirEtiqueta = null;
      etiqueta.classList.remove('deslize-etiqueta--visivel', 'deslize-etiqueta--pronta', 'deslize-etiqueta--voltando', 'deslize-etiqueta--saindo');
    }, SAIDA + 20);
  }

  function mostrarCirculo(caixa) {
    if (!circulo) return;
    circulo.style.setProperty('--deslize-circulo-x', (caixa.left + caixa.width / 2) + 'px');
    circulo.style.setProperty('--deslize-circulo-y', meioVisivel(caixa) + 'px');
    circulo.classList.remove('oculto');
  }

  function esconderCirculo() { if (circulo) circulo.classList.add('oculto'); }

  /* ---------- o palco: o que anda com o dedo ---------- */
  function deslocar(palco, px) { palco.style.setProperty('--deslize-deslocamento', px + 'px'); }

  function prender(palco) {
    palco.setAttribute('data-deslize-movendo', '');
    if (palco.parentElement) palco.parentElement.setAttribute('data-deslize-moldura', '');
  }

  function soltar(palco) {
    ['data-deslize-movendo', 'data-deslize-andando', 'data-deslize-entrando'].forEach(function (marca) { palco.removeAttribute(marca); });
    palco.style.removeProperty('--deslize-deslocamento');
    if (palco.parentElement) palco.parentElement.removeAttribute('data-deslize-moldura');
  }

  function ligar(alvo, opcoes) {
    opcoes = opcoes || {};
    var ativo = opcoes.ativo || noCelular;
    var palcoDe = opcoes.palco || function () { return alvo; };
    var gesto = null;
    var trocando = false;
    var marcarPedido = false;

    function zonas() { return opcoes.area ? alvo.querySelectorAll(opcoes.area) : [alvo]; }

    /* a borda de cada área (o começo, o fim, as duas ou o meio da rolagem para o lado): o CSS deixa o
       navegador rolar só para onde ainda há o que rolar; o resto do dedo é do gesto */
    function marcarBordas() {
      marcarPedido = false;
      Array.prototype.forEach.call(zonas(), function (zona) {
        var noComeco = zona.scrollLeft <= 1;
        var noFim = zona.scrollLeft >= zona.scrollWidth - zona.clientWidth - 1;
        var borda = noComeco && noFim ? 'ambas' : (noComeco ? 'inicio' : (noFim ? 'fim' : 'meio'));
        if (zona.getAttribute('data-deslize-borda') !== borda) zona.setAttribute('data-deslize-borda', borda);
      });
    }

    function marcarDepois() {
      if (marcarPedido) return;
      marcarPedido = true;
      requestAnimationFrame(marcarBordas);
    }

    function aoTocar(evento) {
      gesto = null;
      if (trocando || evento.touches.length !== 1 || !ativo()) return;
      var zona = opcoes.area ? evento.target.closest(opcoes.area) : alvo;
      if (!zona || !alvo.contains(zona)) return;
      var toque = evento.touches[0];
      if (toque.clientX < BEIRADA || toque.clientX > window.innerWidth - BEIRADA) return;
      if (!zona.hasAttribute('data-deslize-borda')) marcarBordas();
      var borda = zona.getAttribute('data-deslize-borda');
      gesto = {
        x0: toque.clientX, y0: toque.clientY, zona: zona, direcao: 0, palco: null, texto: null,
        podeAnterior: borda === 'ambas' || borda === 'inicio', podeProximo: borda === 'ambas' || borda === 'fim',
        pronto: false, antecipado: false
      };
    }

    /* o primeiro trecho do dedo decide: para o lado (e com a borda daquele lado) é do gesto; senão, rolagem */
    function aoMover(evento) {
      if (!gesto) return;
      var toque = evento.touches[0];
      var dx = toque.clientX - gesto.x0;
      if (!gesto.direcao) {
        var dy = toque.clientY - gesto.y0;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDIR) return;
        var direcao = dx > 0 ? -1 : 1;   // o dedo para a direita traz o mês anterior
        if (Math.abs(dx) <= Math.abs(dy) || !(direcao < 0 ? gesto.podeAnterior : gesto.podeProximo)) { gesto = null; return; }
        comecar(direcao);
        if (!gesto) return;
      }
      mover(Math.max(0, dx * -gesto.direcao));
    }

    function comecar(direcao) {
      gesto.direcao = direcao;
      gesto.palco = palcoDe();
      if (!gesto.palco) { gesto = null; return; }
      gesto.texto = opcoes.destino ? opcoes.destino(direcao) : null;
      pecas();
      prender(gesto.palco);
      if (gesto.texto && etiqueta) mostrarEtiqueta(direcao, gesto.texto, gesto.zona);
    }

    /* o mês acompanha o dedo, andando menos que ele; a etiqueta sai da borda e escurece no ponto */
    function mover(distancia) {
      var g = gesto;
      var ate = Math.min(distancia, LIMIAR);
      var anda = g.texto ? ate * ELASTICO + (distancia - ate) * ELASTICO_DEPOIS : distancia * ELASTICO_SEM_MES;
      if (!semMovimento()) deslocar(g.palco, anda * -g.direcao);
      if (!g.texto || !etiqueta) return;
      etiqueta.style.setProperty('--deslize-progresso', String(ate / LIMIAR));
      var pronto = distancia >= LIMIAR;
      if (pronto === g.pronto) return;
      g.pronto = pronto;
      etiqueta.classList.toggle('deslize-etiqueta--pronta', pronto);
      if (!pronto) return;
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
      if (opcoes.antecipar && !g.antecipado) { g.antecipado = true; opcoes.antecipar(g.direcao); }
    }

    function aoSoltar(evento) {
      var g = gesto;
      gesto = null;
      marcarDepois();
      if (!g || !g.direcao) return;
      if (evento.type === 'touchend' && g.pronto && g.texto) trocar(g.direcao, g.palco);
      else desfazer(g.palco);
    }

    /* soltou antes do ponto (ou sem mês para aquele lado): o mês volta ao lugar */
    function desfazer(palco) {
      esconderEtiqueta(false);
      if (semMovimento()) { soltar(palco); return; }
      trocando = true;
      palco.setAttribute('data-deslize-andando', '');
      deslocar(palco, 0);
      setTimeout(function () { soltar(palco); trocando = false; }, SAIDA + 20);
    }

    /* a troca: o mês sai para o lado, a página desenha o novo fora da tela e ele entra pelo outro lado
       (enquanto não chega, o círculo no lugar); sem troca (null), o mês volta */
    function trocar(direcao, palco) {
      trocando = true;
      esconderEtiqueta(true);
      var caixa = palco.getBoundingClientRect();
      var longe = caixa.width + 16;
      var demora = null;
      function terminar(quem) { clearTimeout(demora); esconderCirculo(); soltar(quem); trocando = false; }
      function esperar(promessa, depois) {
        demora = setTimeout(function () { mostrarCirculo(caixa); }, ESPERA_CIRCULO);
        promessa.then(depois, depois);
      }
      if (semMovimento()) {
        soltar(palco);
        var direta = opcoes.ir(direcao);
        if (direta && typeof direta.then === 'function') esperar(direta, function () { terminar(palco); });
        else trocando = false;
        return;
      }
      palco.setAttribute('data-deslize-andando', '');
      deslocar(palco, longe * -direcao);
      setTimeout(function () {
        var promessa = opcoes.ir(direcao);
        if (!promessa || typeof promessa.then !== 'function') {
          deslocar(palco, 0);
          setTimeout(function () { terminar(palco); }, SAIDA + 20);
          return;
        }
        esperar(promessa, function () {
          clearTimeout(demora);
          esconderCirculo();
          var novo = palcoDe() || palco;
          if (novo !== palco) { soltar(palco); prender(novo); }
          novo.removeAttribute('data-deslize-andando');
          deslocar(novo, longe * direcao);
          /* o ponto de partida (do outro lado) vale antes de andar */
          void getComputedStyle(novo).transform;
          novo.setAttribute('data-deslize-entrando', '');
          deslocar(novo, 0);
          setTimeout(function () { terminar(novo); }, ENTRADA + 20);
        });
      }, SAIDA + 20);
    }

    /* as setas da página: no celular, a mesma troca deslizando; false = a página troca do jeito dela */
    function ir(direcao) {
      if (!ativo()) return false;
      if (trocando) return true;
      var palco = palcoDe();
      if (!palco) return false;
      gesto = null;
      prender(palco);
      trocar(direcao, palco);
      return true;
    }

    if (!alvo) return { ir: function () { return false; } };
    if (!alvo.dataset.deslizeMesLigado) {
      alvo.dataset.deslizeMesLigado = '1';
      alvo.addEventListener('touchstart', aoTocar, { passive: true });
      alvo.addEventListener('touchmove', aoMover, { passive: true });
      alvo.addEventListener('touchend', aoSoltar, { passive: true });
      alvo.addEventListener('touchcancel', aoSoltar, { passive: true });
      /* a rolagem das áreas não sobe até o alvo: escuta na descida; a grade nova (outro mês, outra visão) marca de novo */
      alvo.addEventListener('scroll', marcarDepois, { passive: true, capture: true });
      new MutationObserver(marcarDepois).observe(alvo, { childList: true, subtree: true });
      marcarDepois();
    }
    return { ir: ir };
  }

  window.RosterWork.deslizarMes = {
    ligar: ligar,
    nomeMes: nomeMes,
    antecipar: antecipar,
    usarAntecipada: usarAntecipada,
    /* um gesto ou uma troca de mês acontecendo agora (o topo não sai no meio dele) */
    ocupado: function () { return !!document.querySelector('[data-deslize-movendo]'); }
  };
})();
