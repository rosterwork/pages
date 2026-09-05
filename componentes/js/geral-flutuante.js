/* ============================================================
   FLUTUANTE — posicionamento de painéis flutuantes (compartilhado)
   Coloca um painel ancorado num gatilho: abre no lado com mais espaço
   (flip), desliza para caber (shift), respeita o limite (o modal que
   contém o gatilho, ou a janela) e — opcionalmente — limita a altura
   ao espaço (o conteúdo rola por dentro). Mantém a posição ao rolar/
   redimensionar e avisa (aoSair) se o gatilho sair da tela.

   Usado por geral-dropdown.js e geral-calendario.js. Cada componente
   cuida do próprio abrir/fechar; aqui é só a posição.

   API: RosterWork.flutuante.ancorar(gatilho, painel, opcoes) -> desligar()
        opcoes = { limitarAltura (padrão true), aoSair() }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* só escreve a variável se mudou — evita disparos extras do ResizeObserver */
  function setVar(el, nome, valor) {
    if (el.style.getPropertyValue(nome) !== valor) el.style.setProperty(nome, valor);
  }

  /* limite onde o painel pode aparecer: o modal que contém o gatilho, ou a janela */
  function obterLimite(gatilho) {
    var modal = gatilho.closest('.modal');
    if (modal) {
      var r = modal.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }
    var doc = document.documentElement;
    return { top: 0, bottom: doc.clientHeight, left: 0, right: doc.clientWidth };
  }

  function posicionar(gatilho, painel, limitarAltura) {
    var rect = gatilho.getBoundingClientRect();
    var lim = obterLimite(gatilho);
    var folga = 4;

    /* a largura do gatilho fica disponível (campos de seleção a usam) */
    setVar(painel, '--flutuante-w', rect.width + 'px');

    /* prefere ABAIXO; só abre para cima se não couber embaixo E couber melhor acima */
    var espacoAbaixo = lim.bottom - rect.bottom - folga;
    var espacoAcima = rect.top - lim.top - folga;
    var alturaDesejada = painel.scrollHeight;   /* altura natural do conteúdo (ignora o teto de rolagem) */
    /* abre para cima quando o conteúdo não cabe embaixo E há mais espaço em cima — vale com ou sem
       limite de altura (antes, no modo "limitarAltura", ele quase nunca virava: preferia encolher e
       rolar por dentro mesmo com muito espaço acima) */
    var acima = espacoAbaixo < alturaDesejada && espacoAcima > espacoAbaixo;

    /* altura máxima = espaço daquele lado (só quando o componente quer rolar por dentro) */
    if (limitarAltura) {
      var espaco = Math.max(80, Math.round(acima ? espacoAcima : espacoAbaixo));
      setVar(painel, '--flutuante-max-h', espaco + 'px');
    }

    /* horizontal: alinha pela esquerda do gatilho; desliza para caber no limite */
    var largura = painel.offsetWidth;
    var x = rect.left;
    if (x + largura > lim.right - folga) x = lim.right - largura - folga;
    if (x < lim.left + folga) x = lim.left + folga;
    setVar(painel, '--flutuante-x', Math.round(x) + 'px');

    /* âncora vertical: colada ao gatilho, no lado escolhido */
    if (acima) {
      painel.classList.add('flutuante--acima');
      setVar(painel, '--flutuante-bottom', Math.round(window.innerHeight - rect.top + folga) + 'px');
    } else {
      painel.classList.remove('flutuante--acima');
      setVar(painel, '--flutuante-top', Math.round(rect.bottom + folga) + 'px');
    }
  }

  function ancorar(gatilho, painel, opcoes) {
    opcoes = opcoes || {};
    var limitarAltura = opcoes.limitarAltura !== false;   /* padrão: limita a altura */

    painel.classList.add('flutuante');
    posicionar(gatilho, painel, limitarAltura);

    /* reposiciona ao rolar/redimensionar; fecha (aoSair) se o gatilho saiu da tela */
    function aoMexer(evento) {
      /* rolar dentro do próprio painel não mexe na posição */
      if (evento && evento.target && evento.target.closest && evento.target.closest('.flutuante') === painel) return;
      var rect = gatilho.getBoundingClientRect();
      var doc = document.documentElement;
      if (rect.bottom < 0 || rect.top > doc.clientHeight) {
        if (typeof opcoes.aoSair === 'function') opcoes.aoSair();
        return;
      }
      posicionar(gatilho, painel, limitarAltura);
    }

    document.addEventListener('scroll', aoMexer, true);
    window.addEventListener('resize', aoMexer);
    var observador = window.ResizeObserver
      ? new ResizeObserver(function () { posicionar(gatilho, painel, limitarAltura); })
      : null;
    if (observador) observador.observe(painel);

    return function desligar() {
      document.removeEventListener('scroll', aoMexer, true);
      window.removeEventListener('resize', aoMexer);
      if (observador) observador.disconnect();
      painel.classList.remove('flutuante', 'flutuante--acima');
    };
  }

  window.RosterWork.flutuante = { ancorar: ancorar, posicionar: posicionar };
})();
