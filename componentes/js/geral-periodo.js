/* ============================================================
   COMPONENTE geral-periodo — abrir as grades de datas em hoje
   Regra comum das grades com datas (computador e celular): quando o
   período da tela contém hoje, a área abre rolada até hoje, com o
   começo de hoje encostado no alto (ou na esquerda) e só uma ponta
   do que vem antes à vista (o dia, a semana ou os dias anteriores),
   que mostra que há mais para trás. Com muitos dados, o começo de
   hoje continua à vista e o resto se lê rolando. O visual do
   período (‹ rótulo › Hoje) mora no geral-periodo.css; cada página
   liga o seu. Componente compartilhado (Escala e Extrajornada).
   Mostrar uma peça inteira (o dia aberto no painel): a área rola o
   mínimo, para o lado mais perto, até a peça ficar inteira à vista
   com uma folga; já inteira, não mexe. Logo depois de abrir em hoje,
   se a área mudar de tamanho (a faixa de avisos que chega depois),
   hoje volta inteiro à vista, até o primeiro gesto (rolar, clicar,
   tecla), alguns segundos, ou outra peça ser mostrada na área.
   API: RosterWork.periodo.rolarAteHoje(area, hoje, anterior, opcoes)
        RosterWork.periodo.mostrarInteiro(area, alvo, opcoes)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PONTA_ANTERIOR = 32;   // quanto do que vem antes de hoje fica à vista (px)
  var FOLGA = 16;            // a margem em volta da peça mostrada inteira (px)
  var VIGIA_MS = 4000;       // por quanto tempo hoje é mantido à vista se a área mudar de tamanho logo depois de abrir
  var GESTOS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  var vigias = new WeakMap();   // área → as vigias de hoje ativas nela (as funções que as param)

  /* quanto o fixo (a peça ou a lista de peças que grudam no começo da área) tapa do começo dela */
  function tamanhoDoFixo(fixo, horizontal) {
    var tamanho = 0;
    (Array.isArray(fixo) ? fixo : (fixo ? [fixo] : [])).forEach(function (peca) {
      if (!peca || !peca.getClientRects().length) return;
      var caixaFixo = peca.getBoundingClientRect();
      var ondeGruda = parseFloat(getComputedStyle(peca)[horizontal ? 'left' : 'top']) || 0;
      tamanho = Math.max(tamanho, ondeGruda + (horizontal ? caixaFixo.width : caixaFixo.height));
    });
    return tamanho;
  }

  /* rola a `area` (o contêiner que rola, ainda no começo) até `hoje` (a linha, a semana ou a coluna de
     hoje), com uma ponta da peça `anterior` à vista antes dele; sem `anterior` (hoje é o primeiro), a área fica no
     começo. opcoes.horizontal: rola para o lado (colunas); opcoes.fixo: a parte que gruda no começo da
     área (o cabeçalho, ou a coluna da esquerda), que tapa o começo da rolagem e não conta como visível.
     O fixo pode ser uma lista de peças empilhadas (ex.: a trilha e os títulos da árvore, na busca): cada uma
     tapa do começo até onde gruda (o top ou o left dela) mais o seu tamanho */
  function rolarAteHoje(area, hoje, anterior, opcoes) {
    if (!area || !hoje || !anterior) return;
    var horizontal = !!(opcoes && opcoes.horizontal);
    var fixo = opcoes && opcoes.fixo;

    function inicio(el) {
      var caixa = el.getBoundingClientRect();
      return horizontal ? caixa.left : caixa.top;
    }

    var tamanhoFixo = tamanhoDoFixo(fixo, horizontal);
    var comecoVisivel = inicio(area) + (horizontal ? area.clientLeft : area.clientTop) + tamanhoFixo;
    var visivel = (horizontal ? area.clientWidth : area.clientHeight) - tamanhoFixo;
    var caixaHoje = hoje.getBoundingClientRect();
    var tamanhoHoje = horizontal ? caixaHoje.width : caixaHoje.height;
    /* o que vem antes aparece só na ponta, e só até onde hoje ainda cabe inteiro; hoje maior que a área
       encosta no começo */
    var limite = Math.max(0, Math.min(PONTA_ANTERIOR, visivel - tamanhoHoje));
    var antes = inicio(hoje) - inicio(anterior);
    var deslocamento = inicio(hoje) - comecoVisivel - Math.min(antes, limite);
    if (horizontal) area.scrollLeft += deslocamento;
    else area.scrollTop += deslocamento;
    vigiarHoje(area, hoje, horizontal ? { fixoLado: fixo, eixo: 'x' } : { fixo: fixo, eixo: 'y' });
  }

  /* depois de abrir em hoje, a área pode mudar de tamanho (a faixa de avisos ou a lista de unidades que chegam depois):
     hoje volta inteiro à vista, pelo caminho mais curto. A vigia para no primeiro gesto na área, em VIGIA_MS, com a
     área fora da página ou quando outra peça é mostrada nela (mostrarInteiro, ex.: o dia aberto no painel) */
  function vigiarHoje(area, hoje, opcoes) {
    if (!window.ResizeObserver) return;
    var parou = false, altura = area.clientHeight, largura = area.clientWidth;
    var observador = new ResizeObserver(function () {
      if (!area.isConnected || !hoje.isConnected) { parar(); return; }
      if (area.clientHeight === altura && area.clientWidth === largura) return;   // o aviso do começo: nada mudou
      altura = area.clientHeight;
      largura = area.clientWidth;
      levarAVista(area, hoje, opcoes);
    });
    var tempo = setTimeout(parar, VIGIA_MS);
    function parar() {
      if (parou) return;
      parou = true;
      observador.disconnect();
      clearTimeout(tempo);
      GESTOS.forEach(function (g) { area.removeEventListener(g, parar); });
    }
    GESTOS.forEach(function (g) { area.addEventListener(g, parar, { passive: true }); });
    observador.observe(area);
    vigias.set(area, (vigias.get(area) || []).concat([parar]));
  }
  function pararVigias(area) {
    (vigias.get(area) || []).forEach(function (parar) { parar(); });
    vigias.delete(area);
  }

  /* quanto rolar num sentido para a peça (de `ini` a `fim`) caber entre `comeco` e `final` com a folga: o mínimo, para
     o lado mais perto; maior que o espaço, encosta no começo */
  function deslocamento(ini, fim, comeco, final) {
    if (fim - ini + 2 * FOLGA > final - comeco) return ini - comeco - FOLGA;
    if (ini < comeco + FOLGA) return ini - comeco - FOLGA;
    if (fim > final - FOLGA) return fim - final + FOLGA;
    return 0;
  }

  /* rola a `area` o mínimo para `alvo` ficar inteiro à vista, com a FOLGA em volta, para o lado mais perto (para cima
     ou para baixo, e para o lado); já inteiro, não mexe. opcoes.fixo: o que gruda no alto (como no rolarAteHoje);
     opcoes.fixoLado: o que gruda na esquerda; opcoes.eixo: só 'y' (para cima ou para baixo) ou só 'x' (para o lado);
     opcoes.suave: desliza (quem pediu menos movimento no sistema vai direto). Mostrar outra peça para a vigia de hoje */
  function mostrarInteiro(area, alvo, opcoes) {
    if (area) pararVigias(area);
    levarAVista(area, alvo, opcoes);
  }
  function levarAVista(area, alvo, opcoes) {
    if (!area || !alvo || !alvo.getClientRects().length) return;
    var o = opcoes || {};
    var caixaArea = area.getBoundingClientRect(), caixaAlvo = alvo.getBoundingClientRect();
    var topo = caixaArea.top + area.clientTop, esquerda = caixaArea.left + area.clientLeft;
    var y = o.eixo === 'x' ? 0 : deslocamento(caixaAlvo.top, caixaAlvo.bottom, topo + tamanhoDoFixo(o.fixo, false), topo + area.clientHeight);
    var x = o.eixo === 'y' ? 0 : deslocamento(caixaAlvo.left, caixaAlvo.right, esquerda + tamanhoDoFixo(o.fixoLado, true), esquerda + area.clientWidth);
    if (!y && !x) return;
    var poucoMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    area.scrollTo({ top: area.scrollTop + y, left: area.scrollLeft + x, behavior: o.suave && !poucoMovimento ? 'smooth' : 'auto' });
  }

  window.RosterWork.periodo = { rolarAteHoje: rolarAteHoje, mostrarInteiro: mostrarInteiro };
})();
